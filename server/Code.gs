// JK Video Call: Apps Script backend (the "JK caller" project in Google Drive).
// The push key below is blanked out because this repository is public: the real key is in the
// Apps Script project and in the private Google Doc "JK caller - new server code" in Drive.
// doGet serves the app page; doPost is a small JSON API that keeps each person's
// contacts, chats and call history, an inbox for messages sent while they were away,
// and wakes their phone with a push notification for calls and messages.
// Everything is stored in Script Properties (no Google Sheet).

// Phone number -> name. The PIN is the same as the number.
// These four are built in; anyone else who taps "Add account" is kept in the
// 'u_extra' property as { number: { name: , av: } } and can sign in the same way.
// A new name or picture for a built-in account is kept in 'u_base' the same way.
var USERS = { '2019': 'Krishna', '2017': 'Jagannath', '1988': 'Suraj', '1989': 'Tulasi' };
var BASE_AV = { '2017': 'boy', '2019': 'girl', '1988': 'man', '1989': 'woman' };
var AV_KINDS = ['boy', 'girl', 'man', 'woman', 'grandpa', 'grandma', 'cat', 'dog', 'robot', 'hero', 'princess', 'astronaut'];
var MAX_EXTRA = 1000;      // added accounts: no real limit, only a guard against runaway sign-ups

// a built-in account's name and face, with any change made in the app
function baseOf(all, k) {
  var b = (readJ(all, 'u_base') || {})[k] || {};
  return { name: b.name || USERS[k], av: AV_KINDS.indexOf(b.av) >= 0 ? b.av : BASE_AV[k] };
}

// every account that can sign in: number -> name
function users(all) {
  var u = {}, k;
  for (k in USERS) u[k] = baseOf(all, k).name;
  var ex = readJ(all, 'u_extra') || {};
  for (k in ex) if (!u[k] && ex[k] && ex[k].name) u[k] = ex[k].name;
  return u;
}

// the login screen's picture list: number, name and which drawn face to use
function peopleList(all) {
  var list = [], k, ex = readJ(all, 'u_extra') || {};
  for (k in BASE_AV) { var b = baseOf(all, k); list.push({ num: k, name: b.name, av: b.av }); }
  for (k in ex) if (!USERS[k] && ex[k] && ex[k].name) list.push({ num: k, name: ex[k].name, av: ex[k].av || 'man' });
  return list;
}

var cleanName = function (s) { return String(s || '').replace(/[\u0000-\u001f<>&"'\\\/]/g, '').trim().slice(0, 14); };
var CHUNK = 8000;          // Script Properties allow about 9 KB per value
var MAX_STATE = 100000;    // characters of saved state per person
var MAX_INBOX = 200;       // waiting messages per person
var VAPID_PRIVATE = 'PASTE_THE_KEY_HERE';   // signs push requests; handed only to logged-in people
var PUSH_HOSTS = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com)\//;

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('JK Video Call')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var out;
  try { out = handle(JSON.parse(e.postData.contents)); }
  catch (err) { out = { ok: false, error: String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function handle(q) {
  var P = PropertiesService.getScriptProperties();
  // A phone that was woken by a push asks what it is about. It is identified by its push address, not a login.
  if (q.op === 'ringinfo') {
    var a0 = P.getProperties(), ep0 = String(q.endpoint || ''), U0 = users(a0);
    for (var u in U0) {
      if ((readJ(a0, 'p_' + u) || []).indexOf(ep0) < 0) continue;
      var info = readJ(a0, 'n_' + u);
      if (info && Date.now() - info.ts < (info.kind === 'call' ? 90000 : 86400000)) return { ok: true, info: info };
      return { ok: true, info: null };
    }
    return { ok: true, info: null };
  }
  // the login screen asks who exists; no login needed for that
  if (q.op === 'people') return { ok: true, people: peopleList(P.getProperties()) };
  // "Add account": a new 4-digit number with its own name and face. The PIN is the number.
  if (q.op === 'newuser') {
    var nn = String(q.num || ''),
        nm = cleanName(q.name),
        nav = String(q.av || 'man');
    if (!/^\d{4}$/.test(nn)) return { ok: false, error: 'bad number' };
    if (nm.length < 2) return { ok: false, error: 'bad name' };
    if (AV_KINDS.indexOf(nav) < 0) nav = 'man';
    var lk = LockService.getScriptLock();
    lk.waitLock(15000);
    try {
      var a2 = P.getProperties(), ex2 = readJ(a2, 'u_extra') || {}, cnt = 0, k2;
      if (USERS[nn] || ex2[nn]) return { ok: false, error: 'taken' };
      for (k2 in ex2) cnt++;
      if (cnt >= MAX_EXTRA) return { ok: false, error: 'full' };
      ex2[nn] = { name: nm, av: nav };
      writeS(P, a2, 'u_extra', ascii(JSON.stringify(ex2)));
      return { ok: true, num: nn, name: nm, av: nav };
    } finally { lk.releaseLock(); }
  }
  // Change an account's name or picture (hold its picture on the login screen). The PIN is the number.
  if (q.op === 'edituser') {
    var en = String(q.num || ''), enm = cleanName(q.name), eav = String(q.av || '');
    if (String(q.pin) !== en) return { ok: false, error: 'login' };
    if (enm.length < 2) return { ok: false, error: 'bad name' };
    if (AV_KINDS.indexOf(eav) < 0) eav = 'man';
    var le = LockService.getScriptLock();
    le.waitLock(15000);
    try {
      var a3 = P.getProperties();
      if (USERS[en]) {
        var bs = readJ(a3, 'u_base') || {};
        bs[en] = { name: enm, av: eav };
        writeS(P, a3, 'u_base', ascii(JSON.stringify(bs)));
      } else {
        var ex3 = readJ(a3, 'u_extra') || {};
        if (!ex3[en]) return { ok: false, error: 'no such number' };
        ex3[en] = { name: enm, av: eav };
        writeS(P, a3, 'u_extra', ascii(JSON.stringify(ex3)));
      }
      return { ok: true, num: en, name: enm, av: eav };
    } finally { le.releaseLock(); }
  }
  // Remove an added account and everything kept for it. The four built-in accounts can't be removed.
  if (q.op === 'deluser') {
    var dn = String(q.num || '');
    if (String(q.pin) !== dn) return { ok: false, error: 'login' };
    if (USERS[dn]) return { ok: false, error: 'built in' };
    var ld = LockService.getScriptLock();
    ld.waitLock(15000);
    try {
      var a4 = P.getProperties(), ex4 = readJ(a4, 'u_extra') || {};
      if (!ex4[dn]) return { ok: false, error: 'no such number' };
      delete ex4[dn];
      writeS(P, a4, 'u_extra', ascii(JSON.stringify(ex4)));
      ['s_', 'i_', 'p_', 'n_'].forEach(function (pre) {
        var key = pre + dn, n = Number(a4[key + '_n'] || 0);
        for (var i = 0; i < n; i++) P.deleteProperty(key + '_' + i);
        if (n) P.deleteProperty(key + '_n');
      });
      return { ok: true };
    } finally { ld.releaseLock(); }
  }
  var num = String(q.num || '');
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var all = P.getProperties(), U = users(all);
    if (!U[num] || String(q.pin) !== num) return { ok: false, error: 'login' };
    if (q.op === 'load' || q.op === 'poll') {
      var inbox = readJ(all, 'i_' + num) || [];
      if (inbox.length) writeS(P, all, 'i_' + num, '[]');
      var r = { ok: true, name: U[num], inbox: inbox };
      if (q.op === 'load') { r.state = readJ(all, 's_' + num); r.dir = U; r.vk = VAPID_PRIVATE; }
      return r;
    }
    if (q.op === 'save') {
      var s = ascii(JSON.stringify(q.state || {}));
      if (s.length > MAX_STATE) return { ok: false, error: 'too big' };
      writeS(P, all, 's_' + num, s);
      return { ok: true };
    }
    if (q.op === 'sub') {   // this device wants push notifications for this person
      var ep = String(q.endpoint || '');
      if (!PUSH_HOSTS.test(ep) || ep.length > 700) return { ok: false, error: 'bad endpoint' };
      for (var v in U) {
        var list = readJ(all, 'p_' + v) || [], i = list.indexOf(ep), changed = false;
        if (i >= 0) { list.splice(i, 1); changed = true; }
        if (v === num) { list.unshift(ep); list = list.slice(0, 5); changed = true; }
        if (changed) writeS(P, all, 'p_' + v, JSON.stringify(list));
      }
      return { ok: true };
    }
    if (q.op === 'ring') {  // tell someone's phone that a call is coming in
      var to0 = String(q.to || '');
      if (!U[to0]) return { ok: false, error: 'no such number' };
      writeS(P, all, 'n_' + to0, ascii(JSON.stringify({ kind: 'call', from: num, name: U[num], video: !!q.video, ts: Date.now() })));
      return { ok: true, pushed: push_(P, all, to0, q.jwts, q.k) };
    }
    if (q.op === 'send') {
      var to = String(q.to || '');
      if (!U[to]) return { ok: false, error: 'no such number' };
      var m = q.msg || {};
      var text = String(m.text || '').slice(0, 2000);
      var box = readJ(all, 'i_' + to) || [];
      box.push({ id: String(m.id || '').slice(0, 48), text: text, ts: Number(m.ts) || Date.now(), from: num, name: U[num] });
      if (box.length > MAX_INBOX) box = box.slice(-MAX_INBOX);
      writeS(P, all, 'i_' + to, ascii(JSON.stringify(box)));
      writeS(P, all, 'n_' + to, ascii(JSON.stringify({ kind: 'msg', from: num, name: U[num], text: text.slice(0, 120), ts: Date.now() })));
      return { ok: true, pushed: push_(P, all, to, q.jwts, q.k) };
    }
    return { ok: false, error: 'unknown op' };
  } finally { lock.releaseLock(); }
}

// Sends an empty "wake up" push to every device registered for that person.
// jwts: { push service origin -> signed token }, made by the caller's browser; k: the public key.
function push_(P, all, to, jwts, k) {
  var eps = readJ(all, 'p_' + to) || [], keep = [], n = 0;
  if (!eps.length || !jwts) return 0;
  for (var i = 0; i < eps.length; i++) {
    var ep = eps[i], mt = PUSH_HOSTS.exec(ep), jwt = mt && jwts['https://' + mt[1]];
    if (!jwt) { keep.push(ep); continue; }
    try {
      var res = UrlFetchApp.fetch(ep, { method: 'post', muteHttpExceptions: true,
        headers: { Authorization: 'vapid t=' + jwt + ', k=' + k, TTL: '60', Urgency: 'high' } });
      var c = res.getResponseCode();
      if (c === 404 || c === 410) continue;      // that device unsubscribed: forget it
      keep.push(ep);
      if (c >= 200 && c < 300) n++;
    } catch (e) { keep.push(ep); }
  }
  if (keep.length !== eps.length) writeS(P, all, 'p_' + to, JSON.stringify(keep));
  return n;
}

// Emoji and other non-ASCII characters become \uXXXX so every chunk stays under the byte limit.
function ascii(s) {
  return s.replace(/[\u0080-￿]/g, function (c) { return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4); });
}

function readJ(all, key) {
  var n = Number(all[key + '_n'] || 0);
  if (!n) return null;
  var s = '';
  for (var i = 0; i < n; i++) s += all[key + '_' + i] || '';
  try { return JSON.parse(s); } catch (e) { return null; }
}

function writeS(P, all, key, s) {
  var old = Number(all[key + '_n'] || 0), n = Math.ceil(s.length / CHUNK) || 1, o = {};
  for (var i = 0; i < n; i++) o[key + '_' + i] = s.substr(i * CHUNK, CHUNK);
  o[key + '_n'] = String(n);
  P.setProperties(o);
  for (var j = n; j < old; j++) P.deleteProperty(key + '_' + j);
}
