const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronBridge', {
  onDeepLink: (callback) => {
    ipcRenderer.on('deep-link-url', (_event, url) => callback(url));
  },
});
