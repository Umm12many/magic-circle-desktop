const { app, BrowserWindow } = require('electron');
const path = require('node:path');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#2b3035',
      symbolColor: '#fc4eb8',
      height: 40
    },
    icon: path.join(__dirname, 'logo.png'),
  });

  // and load the index.html of the app.
  mainWindow.loadURL('https://magiccircle.gg/r/desktop')
  // Open the DevTools.
  mainWindow.webContents.openDevTools();
  mainWindow.webContents.insertCSS(`
  .titlebar {
    height: 40px;
    background: #2b3035;
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    app-region: drag;
    position: fixed;
    top: 0;
    width: 100%;
    z-index: 10000000000; /* Ensure it's on top of other elements */
    font-family: Arial, serif;
  }
  #root {
  margin-top: 40px;
  }
`);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
