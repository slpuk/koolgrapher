const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            devTools: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    win.loadFile('src/index.html');

    const notifyStateChange = () => {
        win.webContents.send('window-state-changed', win.isMaximized());
    };

    win.on('maximize', notifyStateChange);
    win.on('unmaximize', notifyStateChange);
    win.on('resize', notifyStateChange);

    ipcMain.handle('is-maximized', () => win.isMaximized());

    ipcMain.on('minimize', () => win.minimize());
    ipcMain.on('maximize', () => {
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    });
    ipcMain.on('close', () => win.close());

    ipcMain.handle('save-file', async (event, data) => {
        const { canceled, filePath } = await dialog.showSaveDialog(win, {
            title: 'Сохранить граф',
            defaultPath: 'graph.kgraph',
            filters: [
                { name: 'KGraph Files', extensions: ['kgraph'] },
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        
        if (!canceled && filePath) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            return { success: true, path: filePath };
        }
        return { success: false, canceled };
    });

    ipcMain.handle('load-file', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
            title: 'Загрузить граф',
            filters: [
                { name: 'KGraph Files', extensions: ['kgraph'] },
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
            ],
            properties: ['openFile']
        });
        
        if (!canceled && filePaths.length > 0) {
            const content = fs.readFileSync(filePaths[0], 'utf8');
            return { success: true, content, path: filePaths[0] };
        }
        return { success: false, canceled };
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});