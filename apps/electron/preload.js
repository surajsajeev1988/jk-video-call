// The only thing the page can ask of the desktop app: bring the window up when a call rings.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('jkDesktop', { ring: () => ipcRenderer.send('jk-ring') });
