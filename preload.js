const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    minimize: () => ipcRenderer.send('minimize'),
    maximize: () => ipcRenderer.send('maximize'),
    close: () => ipcRenderer.send('close'),
    isMaximized: () => ipcRenderer.invoke('is-maximized'),
    onWindowStateChange: (callback) => {
        ipcRenderer.on('window-state-changed', (event, isMaximized) => callback(isMaximized));
    },
    saveFile: (data) => ipcRenderer.invoke('save-file', data),
    loadFile: () => ipcRenderer.invoke('load-file')
});