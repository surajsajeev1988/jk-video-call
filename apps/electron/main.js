// Windows (and Mac/Linux) desktop app: opens the live JK Video Call site full screen, so it is always the
// newest version. If the site can't be reached it shows a "No internet" page that retries by itself.
const { app, BrowserWindow, protocol, net, session, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// a private, secure "app://" address, so the camera, microphone and storage work like on a website
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
if (process.platform === 'win32') app.setAppUserModelId('com.jkfamily.videocall');   // notifications show the app's name

const WWW = path.join(__dirname, '..', 'www');
const LIVE = 'https://surajsajeev1988.github.io/jk-video-call/';
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 480, height: 860, minWidth: 360, minHeight: 600, fullscreen: true,
    backgroundColor: '#0b141a', title: 'JK Video Call', autoHideMenuBar: true,
    icon: path.join(WWW, 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false }
  });
  // no internet: show the built-in "No internet" page, which goes back to the live site when it can
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (isMain && code !== -3 && url.startsWith(LIVE)) win.loadURL('app://jk/offline.html');
  });
  // full screen at all times (Alt+F4 still closes it)
  win.on('leave-full-screen', () => setTimeout(() => { if (win && !win.isDestroyed()) win.setFullScreen(true); }, 50));
  // fetch the newest version each time the app opens
  win.webContents.session.clearCache().finally(() => win && win.loadURL(LIVE));
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
