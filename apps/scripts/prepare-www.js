// Copies the web app into www/ for the phone and desktop builds, and bundles PeerJS
// so the app opens without downloading anything first.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', '..'), www = path.join(__dirname, '..', 'www');
fs.rmSync(www, { recursive: true, force: true }); fs.mkdirSync(www);
for (const f of ['index.html', 'manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(root, f), path.join(www, f));
fs.copyFileSync(require.resolve('peerjs/dist/peerjs.min.js'), path.join(www, 'peerjs.min.js'));
const idx = path.join(www, 'index.html');
const html = fs.readFileSync(idx, 'utf8');
const out = html.replace(/<script src="https:\/\/unpkg\.com\/peerjs@[^"]+"><\/script>/, '<script src="peerjs.min.js"></script>');
if (out === html) throw new Error('PeerJS script tag not found in index.html');
fs.writeFileSync(idx, out);
console.log('www/ ready');
