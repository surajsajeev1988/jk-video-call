// JK Video Call server on Cloudflare Workers.
// A small JSON API (POST, body = {op, ...}) that keeps each person's contacts, chats and call history,
// an inbox for messages sent while they were away, and wakes their phone with a push notification for
// calls and messages. All data lives in one Durable Object, so every request sees the latest data.
// It replaces the Google Apps Script server (server/Code.gs) and answers the same way.

const USERS = { '2019': 'Krishna', '2017': 'Jagannath', '1988': 'Suraj', '1989': 'Tulasi' };
const BASE_AV = { '2017': 'boy', '2019': 'girl', '1988': 'man', '1989': 'woman' };
const AV_KINDS = ['boy', 'girl', 'man', 'woman', 'grandpa', 'grandma', 'cat', 'dog', 'robot', 'hero', 'princess', 'astronaut'];
const MAX_EXTRA = 1000;      // added accounts: no real limit, only a guard against runaway sign-ups
const MAX_STATE = 100000;    // characters of saved state per person
const MAX_INBOX = 200;       // waiting messages per person
const PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)\//;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = o => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json', ...CORS } });
const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>&"'\\/]/g, '').trim().slice(0, 14);

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return new Response('JK Video Call server', { headers: CORS });
    const body = await req.text();
    if (body.length > 200000) return json({ ok: false, error: 'too big' });
    const stub = env.STORE.get(env.STORE.idFromName('jk'));
    return stub.fetch('https://store/', { method: 'POST', body });
  }
};

export class Store {
  constructor(ctx, env) { this.s = ctx.storage; this.env = env; }

  async fetch(req) {
    let out;
    try { out = await this.handle(JSON.parse(await req.text())); }
    catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
    return json(out);
  }

  get(k) { return this.s.get(k); }
  put(k, v) { return this.s.put(k, v); }

  // a built-in account's name and face, with any change made in the app
  async baseAll() { return (await this.get('u_base')) || {}; }
  baseOf(bs, k) { const b = bs[k] || {}; return { name: b.name || USERS[k], av: AV_KINDS.includes(b.av) ? b.av : BASE_AV[k] }; }

  // every account that can sign in: number -> name
  async users() {
    const u = {}, bs = await this.baseAll(), ex = (await this.get('u_extra')) || {};
    for (const k in USERS) u[k] = this.baseOf(bs, k).name;
    for (const k in ex) if (!u[k] && ex[k] && ex[k].name) u[k] = ex[k].name;
    return u;
  }

  // the login screen's picture list: number, name and which drawn face to use
  async peopleList() {
    const list = [], bs = await this.baseAll(), ex = (await this.get('u_extra')) || {};
    for (const k in BASE_AV) { const b = this.baseOf(bs, k); list.push({ num: k, name: b.name, av: b.av }); }
    for (const k in ex) if (!USERS[k] && ex[k] && ex[k].name) list.push({ num: k, name: ex[k].name, av: ex[k].av || 'man' });
    return list;
  }

  async handle(q) {
    const op = q.op;
    // A phone that was woken by a push asks what it is about. It is identified by its push address, not a login.
    if (op === 'ringinfo') {
      const ep = String(q.endpoint || ''), U = await this.users();
      for (const u in U) {
        if (!((await this.get('p_' + u)) || []).includes(ep)) continue;
        const info = await this.get('n_' + u);
        if (info && Date.now() - info.ts < (info.kind === 'call' ? 90000 : 86400000)) return { ok: true, info };
        return { ok: true, info: null };
      }
      return { ok: true, info: null };
    }
    // the login screen asks who exists; no login needed for that
    if (op === 'people') return { ok: true, people: await this.peopleList() };
    // "Add account": a new 4-digit number with its own name and face. The PIN is the number.
    if (op === 'newuser') {
      const nn = String(q.num || ''), nm = cleanName(q.name);
      let nav = String(q.av || 'man');
      if (!/^\d{4}$/.test(nn)) return { ok: false, error: 'bad number' };
      if (nm.length < 2) return { ok: false, error: 'bad name' };
      if (!AV_KINDS.includes(nav)) nav = 'man';
      const ex = (await this.get('u_extra')) || {};
      if (USERS[nn] || ex[nn]) return { ok: false, error: 'taken' };
      if (Object.keys(ex).length >= MAX_EXTRA) return { ok: false, error: 'full' };
      ex[nn] = { name: nm, av: nav };
      await this.put('u_extra', ex);
      return { ok: true, num: nn, name: nm, av: nav };
    }
    // Change an account's name or picture (hold its picture on the login screen).
    if (op === 'edituser') {
      const en = String(q.num || ''), enm = cleanName(q.name);
      let eav = String(q.av || '');
      if (String(q.pin) !== en) return { ok: false, error: 'login' };
      if (enm.length < 2) return { ok: false, error: 'bad name' };
      if (!AV_KINDS.includes(eav)) eav = 'man';
      if (USERS[en]) {
        const bs = await this.baseAll(); bs[en] = { name: enm, av: eav }; await this.put('u_base', bs);
      } else {
        const ex = (await this.get('u_extra')) || {};
        if (!ex[en]) return { ok: false, error: 'no such number' };
        ex[en] = { name: enm, av: eav }; await this.put('u_extra', ex);
      }
      return { ok: true, num: en, name: enm, av: eav };
    }
    // Remove an added account and everything kept for it. The four built-in accounts can't be removed.
    if (op === 'deluser') {
      const dn = String(q.num || '');
      if (String(q.pin) !== dn) return { ok: false, error: 'login' };
      if (USERS[dn]) return { ok: false, error: 'built in' };
      const ex = (await this.get('u_extra')) || {};
      if (!ex[dn]) return { ok: false, error: 'no such number' };
      delete ex[dn];
      await this.put('u_extra', ex);
      await this.s.delete(['s_', 'i_', 'p_', 'n_'].map(p => p + dn));
      return { ok: true };
    }
    // everything else needs a sign-in: the number, with the number as the PIN
    const num = String(q.num || ''), U = await this.users();
    if (!U[num] || String(q.pin) !== num) return { ok: false, error: 'login' };
    if (op === 'load' || op === 'poll') {
      const inbox = (await this.get('i_' + num)) || [];
      if (inbox.length) await this.put('i_' + num, []);
      const r = { ok: true, name: U[num], inbox };
      if (op === 'load') { r.state = (await this.get('s_' + num)) || null; r.dir = U; r.vk = this.env.VAPID_PRIVATE; }
      return r;
    }
    if (op === 'save') {
      const st = q.state || {};
      if (JSON.stringify(st).length > MAX_STATE) return { ok: false, error: 'too big' };
      await this.put('s_' + num, st);
      return { ok: true };
    }
    if (op === 'sub') {   // this device wants push notifications for this person
      const ep = String(q.endpoint || '');
      if (!PUSH_HOSTS.test(ep) || ep.length > 700) return { ok: false, error: 'bad endpoint' };
      for (const v in U) {
        let list = (await this.get('p_' + v)) || [], changed = false;
        const i = list.indexOf(ep);
        if (i >= 0) { list.splice(i, 1); changed = true; }
        if (v === num) { list.unshift(ep); list = list.slice(0, 5); changed = true; }
        if (changed) await this.put('p_' + v, list);
      }
      return { ok: true };
    }
    if (op === 'ring') {  // tell someone's phone that a call is coming in
      const to = String(q.to || '');
      if (!U[to]) return { ok: false, error: 'no such number' };
      await this.put('n_' + to, { kind: 'call', from: num, name: U[num], video: !!q.video, ts: Date.now() });
      return { ok: true, pushed: await this.push(to, q.jwts, q.k) };
    }
    if (op === 'send') {
      const to = String(q.to || '');
      if (!U[to]) return { ok: false, error: 'no such number' };
      const m = q.msg || {}, text = String(m.text || '').slice(0, 2000);
      let box = (await this.get('i_' + to)) || [];
      box.push({ id: String(m.id || '').slice(0, 48), text, ts: Number(m.ts) || Date.now(), from: num, name: U[num] });
      if (box.length > MAX_INBOX) box = box.slice(-MAX_INBOX);
      await this.put('i_' + to, box);
      await this.put('n_' + to, { kind: 'msg', from: num, name: U[num], text: text.slice(0, 120), ts: Date.now() });
      return { ok: true, pushed: await this.push(to, q.jwts, q.k) };
    }
    return { ok: false, error: 'unknown op' };
  }

  // Sends an empty "wake up" push to every device registered for that person.
  // jwts: { push service origin -> signed token }, made by the caller's browser; k: the public key.
  async push(to, jwts, k) {
    const eps = (await this.get('p_' + to)) || [];
    if (!eps.length || !jwts) return 0;
    const results = await Promise.all(eps.map(async ep => {
      const mt = PUSH_HOSTS.exec(ep), jwt = mt && jwts['https://' + mt[1]];
      if (!jwt) return { ep, keep: true, sent: false };
      try {
        const res = await fetch(ep, { method: 'POST', headers: { Authorization: 'vapid t=' + jwt + ', k=' + k, TTL: '60', Urgency: 'high' } });
        if (res.status === 404 || res.status === 410) return { ep, keep: false, sent: false };   // that device unsubscribed: forget it
        return { ep, keep: true, sent: res.status >= 200 && res.status < 300 };
      } catch (e) { return { ep, keep: true, sent: false }; }
    }));
    const keep = results.filter(r => r.keep).map(r => r.ep);
    if (keep.length !== eps.length) await this.put('p_' + to, keep);
    return results.filter(r => r.sent).length;
  }
}
