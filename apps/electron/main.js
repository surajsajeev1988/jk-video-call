// Windows (and Mac/Linux) desktop app: shows the bundled JK Video Call page in its own window.
const { app, BrowserWindow, protocol, net, session, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// a private, secure "app://" address, so the camera, microphone and storage work like on a website
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
if (process.platform === 'win32') app.setAppUserModelId('com.jkfamily.videocall');   // notifications show the app's name

const WWW = path.join(__dirname, '..', 'www');
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 480, height: 860, minWidth: 360, minHeight: 600,
    backgroundColor: '#0b141a', title: 'JK Video Call', autoHideMenuBar: true,
    icon: path.join(WWW, 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false }
  });
  win.loadURL('app://jk/index.html');
  // links to other sites open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    protocol.handle('app', req => {
      const p = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.normalize(path.join(WWW, p));
      if (!file.startsWith(WWW)) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });
    const allowed = new Set(['media', 'notifications', 'clipboard-sanitized-write', 'fullscreen', 'mediaKeySystem']);
    session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(allowed.has(perm)));
    session.defaultSession.setPermissionCheckHandler((wc, perm) => allowed.has(perm));
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
