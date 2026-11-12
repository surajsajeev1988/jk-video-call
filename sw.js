// JK Video Call service worker: shows call and message notifications, including when the app is closed.
const API = 'https://script.google.com/macros/s/AKfycbyGO3qxiGOBa5Q2RTZ4jGA64BHosfiwHQUwX8_Dk468RVXhDYa6iPVic6eZFjx5cY0/exec';
const ICON = 'icon-192.png';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const windows = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true });

// A push carries no content. Ask the backend what it is about (a call or a message) using this device's push address.
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let info = null;
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const r = await fetch(API, { method: 'POST', body: JSON.stringify({ op: 'ringinfo', endpoint: sub.endpoint }) });
        const j = await r.json(); info = j && j.info;
      }
    } catch (err) {}
    const cs = await windows();
    if (cs.some(c => c.visibilityState === 'visible')) { cs.forEach(c => c.postMessage({ t: 'push', info })); return; }
    if (info && info.kind === 'call') {
      return self.registration.showNotification('\u{1F4DE} ' + info.name + ' is calling', {
        body: (info.video ? 'Video' : 'Voice') + ' call. Tap Accept to answer.',
        tag: 'jk-call', renotify: true, requireInteraction: true, icon: ICON, badge: ICON,
        vibrate: [600, 300, 600, 300, 600, 300, 600, 300, 600, 300, 600],
        actions: [{ action: 'accept', title: 'Accept' }, { action: 'decline', title: 'Decline' }],
        data: { kind: 'call', from: info.from }
      });
    }
    if (info && info.kind === 'msg') {
      return self.registration.showNotification('\u{1F4AC} ' + info.name, {
        body: info.text || 'New message', tag: 'jk-msg-' + info.from, renotify: true, icon: ICON, badge: ICON,
        vibrate: [200, 100, 200], data: { kind: 'msg', from: info.from }
      });
    }
    return self.registration.showNotification('JK Video Call', { body: 'Tap to open', tag: 'jk-misc', icon: ICON, badge: ICON });
  })());
});

self.addEventListener('notificationclick', e => {
  const d = e.notification.data || {};
  e.notification.close();
  e.waitUntil((async () => {
    const cs = await windows();
    if (e.action === 'decline') { cs.forEach(c => c.postMessage({ t: 'decline' })); return; }
    const msg = { t: e.action === 'accept' ? 'accept' : 'open', kind: d.kind, from: d.from };
    if (cs.length) { try { await cs[0].focus(); } catch (x) {} cs[0].postMessage(msg); return; }
    await self.clients.openWindow('./' + (d.kind === 'msg' && d.from ? '?chat=' + encodeURIComponent(d.from) : ''));
  })());
});
