const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const isWebLink = value => /^https?:\/\//i.test(value);

function createWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#071018',
    autoHideMenuBar: true,
    show: false,
    title: 'BitWire',
    icon: path.join(__dirname, '..', 'dist', 'favicon.svg'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      devTools: !app.isPackaged,
    },
  });

  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isWebLink(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL() && isWebLink(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
  window.once('ready-to-show', () => window.show());
  void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  app.setAppUserModelId('io.github.alejandropico.bitwire');
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
