const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const DiscordRPC = require('discord-rpc');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {

  function insertToApp() {
    const cssToInject = fs.readFileSync(path.join(__dirname, 'inject.css'), 'utf8');

    mainWindow.webContents.insertCSS(cssToInject);
  }
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
  mainWindow.webContents.setUserAgent("McDesktopClient");
  mainWindow.loadURL('https://magiccircle.gg/').then(r => {
    console.log(r);
  })


  app.on('browser-window-focus', function () {
    globalShortcut.register("CommandOrControl+R", async () => {

      await mainWindow.reload()
      insertToApp();
      console.log("CommandOrControl+R is pressed: Shortcut Disabled");
    });
    globalShortcut.register("CommandOrControl+Shift+I", () => {
      console.log("CommandOrControl+Shift+I is pressed: Shortcut Disabled, (DevTools)");
  });
    globalShortcut.register("CommandOrControl+M", () => {
     mainWindow.webContents.openDevTools();
      console.log("Opening Devtools");
  });
    globalShortcut.register("F5", () => {
        insertToApp();
        console.log("F5 is pressed: Shortcut Disabled");
    });
});
  app.on('browser-window-blur', function () {
    globalShortcut.unregister('CommandOrControl+R');
    globalShortcut.unregister('CommandOrControl+Shift+I');
    globalShortcut.unregister('CommandOrControl+M');
    globalShortcut.unregister('F5');
});
  // Set this to your Client ID.
  const clientId = '1227719606223765687';


  // Only needed if you want to use spectate, join, or ask to join
  DiscordRPC.register(clientId);

  const rpc = new DiscordRPC.Client({ transport: 'ipc' });

  const startTimestamp = new Date();

  async function setActivity() {
    if (!rpc || !mainWindow) {
      return;
    }

    const roomID = mainWindow.webContents.getURL().substring(25, mainWindow.webContents.getURL().length);
    const gameActive = await mainWindow.webContents.executeJavaScript('window.mc_desktop_current_game_name');
    const finalGameActive = gameActive !== 'Lobby' && gameActive !== undefined ? `Playing ${gameActive}` : `Browsing games in Lobby`

    // You'll need to have snek_large and snek_small assets uploaded to
    // https://discord.com/developers/applications/<application_id>/rich-presence/assets
    await rpc.setActivity({
      details: `Magic Circle Desktop Client(Alpha)`,
      state: `${finalGameActive}`,
      startTimestamp,
      largeImageKey: 'app_image',
      largeImageText: 'Magic Circle Icon',
      instance: false,
    });
  }
  insertToApp();
  rpc.on('ready', () => {
    setActivity();

    // activity can only be set every 15 seconds
    setInterval(() => {
      setActivity();
    }, 15e3);
  });

  rpc.login({ clientId }).catch(console.error);
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
