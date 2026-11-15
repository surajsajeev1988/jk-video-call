// Windows (and Mac/Linux) desktop app. It opens the live JK Video Call site full screen, so it is always
// the newest version. Closing the window keeps it running in the system tray and it starts with Windows,
// so calls still come in: an incoming call brings the window back up, ringing.
const { app, BrowserWindow, Tray, Menu, ipcMain, protocol, net, session, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// a private, secure "app://" address for the built-in "No internet" page
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
if (process.platform === 'win32') app.setAppUserModelId('com.jkfamily.videocall');   // notifications show the app's name

const WWW = path.join(__dirname, '..', 'www');
const LIVE = 'https://surajsajeev1988.github.io/jk-video-call/';
const startHidden = process.argv.includes('--hidden');   // started with Windows: wait in the tray
let win = null, tray = null, quitting = false;

function showWindow() {
  if (!win) return createWindow(true);
  if (win.isMinimized()) win.restore();
  win.show(); win.setFullScreen(true); win.focus();
}

function createWindow(show) {
  win = new BrowserWindow({
    width: 480, height: 860, minWidth: 360, minHeight: 600, fullscreen: !!show, show: !!show,
    backgroundColor: '#0b141a', title: 'JK Video Call', autoHideMenuBar: true,
    icon: path.join(WWW, 'icon-512.png'),
    webPreferences: {
      contextIsolation: true, sandbox: true, backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',   // the ringtone plays even before anyone touches the app
      preload: path.join(__dirname, 'preload.js')
    }
  });
  // no internet: show the built-in "No internet" page, which goes back to the live site when it can
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (isMain && code !== -3 && url.startsWith(LIVE)) win.loadURL('app://jk/offline.html');
  });
  // full screen at all times while it is open
  win.on('leave-full-screen', () => setTimeout(() => { if (win && !win.isDestroyed() && win.isVisible()) win.setFullScreen(true); }, 50));
  // closing the window only hides it, so calls can still come in; "Quit" in the tray menu really closes it
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.setFullScreen(false); win.hide(); } });
  // links to other sites open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.on('closed', () => { win = null; });
  // fetch the newest version each time the app starts
  win.webContents.session.clearCache().finally(() => win && win.loadURL(LIVE));
}

function createTray() {
  tray = new Tray(path.join(WWW, 'icon-192.png'));
  tray.setToolTip('JK Video Call: ready for calls');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Open JK Video Call', click: showWindow },
    { type: 'separator' },
    {
      label: 'Start with Windows', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: item => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] })
    },
    { label: 'Quit (calls stop ringing)', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu());
  tray.on('right-click', () => tray.setContextMenu(menu()));
  tray.on('click', showWindow);
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showWindow);
  app.on('before-quit', () => { quitting = true; });
  ipcMain.on('jk-ring', () => { showWindow(); if (win) { win.flashFrame(true); win.moveTop(); } });
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
    // first run: start with Windows, waiting quietly in the tray, so calls ring after a restart too
    if (app.isPackaged && !app.getLoginItemSettings().openAtLogin && !require('fs').existsSync(path.join(app.getPath('userData'), 'login-set'))) {
      app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
      require('fs').writeFileSync(path.join(app.getPath('userData'), 'login-set'), '1');
    }
    createTray();
    createWindow(!startHidden);
    app.on('activate', showWindow);
  });
  // keep running in the tray when the window is closed
  app.on('window-all-closed', () => {});
}
