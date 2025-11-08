const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const DiscordRPC = require('discord-rpc');
const WindowsToaster = require('node-notifier').WindowsToaster;

const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');
const modSettingsPath = path.join(userDataPath, 'mod-settings.json');

function getSettings() {
    try {
        const data = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(data);
        // Ensure sfxVolume exists, otherwise set default
        if (settings.sfxVolume === undefined) {
            settings.sfxVolume = 1.0;
        }
        // Ensure disableMods and disableController exist, otherwise set defaults
        if (settings.disableMods === undefined) {
            settings.disableMods = false;
        }
        if (settings.disableController === undefined) {
            settings.disableController = false;
        }
        if (settings.mods === undefined) {
            settings.mods = {};
        }
        return settings;
    } catch (error) {
        const defaultSettings = {
            domain: 'magiccircle.gg',
            isBeta: false,
            sfxVolume: 1.0, // Default SFX volume
            disableMods: false, // Default disable mods
            disableController: false, // Default disable controller
            mods: {}
        };
        saveSettings(defaultSettings);
        return defaultSettings;
    }
}

function saveSettings(settings) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2)); // Added null, 2 for pretty printing
}

function getModSettings() {
    try {
        const data = fs.readFileSync(modSettingsPath, 'utf8');
        const settings = JSON.parse(data);
        return settings;
    } catch (error) {
        const defaultSettings = {
          
        };
        saveModSettings(defaultSettings);
        return defaultSettings;
    }
}

function saveModSettings(settings) {
    fs.writeFileSync(modSettingsPath, JSON.stringify(settings, null, 2)); // Added null, 2 for pretty printing
}

//var serviceAccount = require("./backend-modules/firebase-credentials.json");

//admin.initializeApp({
  //  credential: admin.credential.cert(serviceAccount),
  //  databaseURL: "https://public-rooms-default-rtdb.firebaseio.com"
 // });

// The app only has access as defined in the Security Rules
//const db = admin.database();


var notifier = new WindowsToaster({
  withFallback: false, // Fallback to Growl or Balloons?
  customPath: undefined // Relative/Absolute path if you want to use your fork of SnoreToast.exe
});
app.setAppUserModelId('com.umm12many.magicgarden');
let mainWindow; // Module-scoped variable to hold the main window
let devConsoleWindow = null; // New module-scoped variable for the dev console
let settingsWindow = null;

// Variable to hold the URL from the deep link, if any, before the window is ready
let deepLinkUrlToLoad = null;

// Function to handle the deep link logic
function handleProtocolUrl(url) {
  // Expected format: 'magic-garden://r/ROOMCODE' or similar
  console.log('Received deep link URL:', url);

  // Use URL object to safely parse the URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    console.error('Failed to parse URL:', e);
    return;
  }

  // The path part will be something like '/r/ROOMCODE'
  // We want to extract 'ROOMCODE' or the whole path if it's the room part
  const path = parsedUrl.pathname;

  // Assuming your deep link format is 'magic-garden://r/ROOMCODE'
  // and you want to navigate to 'https://magiccircle.gg/r/ROOMCODE'
  // A simple way to get the relevant path (e.g., '/r/ROOMCODE')
  const finalPath = path.startsWith('/') ? path : `/${path}`;
  const targetUrl = `https://magiccircle.gg/r${finalPath}`;

  console.log('Target navigation URL:', targetUrl);

  if (mainWindow) {
    // If the main window exists, load the new URL
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.loadURL(targetUrl).then(() => updateTitle(mainWindow));
  } else {
    // If the window isn't ready yet (e.g., on first launch with a deep link),
    // save the URL to be loaded later in createWindow
    deepLinkUrlToLoad = targetUrl;
  }
}

// --- Rest of the unchanged code ---
function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Function to safely execute JS and return the value
async function getCosmeticObjectFromRenderer(win) {
    if (!win) {
        return null;
    }

    // The JavaScript code to execute in the renderer process.
    // It uses optional chaining and nullish coalescing (??) to ensure a safe return.
    const jsCode = `
        // Access the nested property safely.
        // If any part of the chain is null/undefined, the expression evaluates to undefined.
        // We use '|| null' to ensure a null is returned if undefined, which is cleaner.
        window.MagicCircle_RoomConnection?.lastRoomStateJsonable?.data?.players?.[0]?.cosmetic || null;
    `;

    try {
        // executeJavaScript returns a Promise that resolves with the result of the script.
        // If the script evaluates to an object/JSON, it will be automatically deserialized
        // into a JavaScript object for use in the main process.
        const cosmeticObject = await win.webContents.executeJavaScript(jsCode);

        // You can check here if it's the expected type before returning.
        if (cosmeticObject && typeof cosmeticObject === 'object') {
            return cosmeticObject;
        }

        return null; // Return null if the value wasn't found or wasn't an object

    } catch (error) {
        console.error("Error executing JavaScript to get cosmetic object:", error);
        return null;
    }
}

async function setPlayerCosmetic(win, slot, filename) {
  if (slot  === "top") {
    const cosmetic = await getCosmeticObjectFromRenderer(win);
    await win.webContents.executeJavaScript(`MagicCircle_RoomConnection.sendMessage({
    "scopePath": [
        "Room"
    ],
    "type": "SetPlayerData",
    "cosmetic": {
        "color": "${cosmetic.color}",
        "avatar": [
            "${cosmetic.avatar[0]}",
            "${cosmetic.avatar[1]}",
            "${filename}",
            "${cosmetic.avatar[3]}"
        ]
    }
})`);
    return "Successfully Set Top Cosmetic";
  } else if (slot  === "bottom") {
    const cosmetic = await getCosmeticObjectFromRenderer(win);
    await win.webContents.executeJavaScript(`MagicCircle_RoomConnection.sendMessage({
    "scopePath": [
        "Room"
    ],
    "type": "SetPlayerData",
    "cosmetic": {
        "color": "${cosmetic.color}",
        "avatar": [
            "${filename}",
            "${cosmetic.avatar[1]}",
            "${cosmetic.avatar[2]}",
            "${cosmetic.avatar[3]}"
        ]
    }
})`);
    return "Successfully Set Bottom Cosmetic";
  } else if (slot  === "mid") {
    const cosmetic = await getCosmeticObjectFromRenderer(win);
    await win.webContents.executeJavaScript(`MagicCircle_RoomConnection.sendMessage({
    "scopePath": [
        "Room"
    ],
    "type": "SetPlayerData",
    "cosmetic": {
        "color": "${cosmetic.color}",
        "avatar": [
            "${cosmetic.avatar[0]}",
            "${filename}",
            "${cosmetic.avatar[2]}",
            "${cosmetic.avatar[3]}"
        ]
    }
})`);
    return "Successfully Set Mid Cosmetic";
  } else if (slot  === "expression") {
    const cosmetic = await getCosmeticObjectFromRenderer(win);
    await win.webContents.executeJavaScript(`MagicCircle_RoomConnection.sendMessage({
    "scopePath": [
        "Room"
    ],
    "type": "SetPlayerData",
    "cosmetic": {
        "color": "${cosmetic.color}",
        "avatar": [
            "${cosmetic.avatar[0]}",
            "${cosmetic.avatar[1]}",
            "${cosmetic.avatar[2]}",
            "${filename}"
        ]
    }
})`);
    return "Successfully Set Expression Cosmetic";
  } else {
    const cosmetic = await getCosmeticObjectFromRenderer(win);
    await win.webContents.executeJavaScript(`MagicCircle_RoomConnection.sendMessage({
    "scopePath": [
        "Room"
    ],
    "type": "SetPlayerData",
    "cosmetic": {
        "color": "${cosmetic.color}",
        "avatar": [
            "${cosmetic.avatar[0]}",
            "${cosmetic.avatar[1]}",
            "${cosmetic.avatar[2]}",
            "${cosmetic.avatar[3]}"
        ]
    }
})`);
    return "Successfully Set _ Cosmetic";
  }
}
// --- Custom Command Configuration (UNCHANGED) ---
const commandConfig = {
  'reload': {
    description: 'Reloads the main app window.',
    function: () => {
      if (mainWindow) {
        mainWindow.webContents.reload();
        return 'Main window reloaded.';
      }
      return 'Error: Main window not found.';
    },
    args: []
  },
  'insert-css': {
    description: 'Re-runs the CSS injection function.',
    function: () => {
      if (mainWindow) {
        insertToApp(mainWindow);
        return 'CSS re-injected.';
      }
      return 'Error: Main window not found.';
    },
    args: []
  },
  'join-room': {
    description: 'Joins a specific room, type "join-room random" to join a random room (generates a random code)',
    // Arguments are passed as an array to the function
    function: (args) => {
      if (args && args.length > 0) {
        // The setActivity function has been modified to accept an overrideState
        if (mainWindow && args[0].toLowerCase()  !== 'random') {
          mainWindow.loadURL("https://magiccircle.gg/r/"+args[0]);
          return `Room set to: ${args[0]}`;
        } else if (mainWindow && args[0].toLowerCase()  === 'random') {
          const roomToJoin = generateRandomString(4);
          mainWindow.loadURL("https://magiccircle.gg/r/"+roomToJoin);
          return `Room set to: ${roomToJoin}`;
        }
          else {
          return 'Error: No MainWindow';
        }

      }
      return 'Error: No room provided.';
    },
    args: ['<room code>']
  },
  'set-player-cosmetic': {
    description: 'Set the players specified cosmetic to a specific file name',
    // Arguments are passed as an array to the function
    function: (args) => {
      if (args && args.length > 1) {
        // The setActivity function has been modified to accept an overrideState
        if (mainWindow) {
          if (args[0].toLowerCase()  === "top" || args[0].toLowerCase()  === "mid" || args[0].toLowerCase()  === "bottom" || args[0].toLowerCase()  === "expression") {
            const returnStatement = `${args[0]} was successfully set to ${args[1]}`;
            setPlayerCosmetic(mainWindow, args[0].toLowerCase(), args[1]);
            return returnStatement;
          } else {
            return "Error: specified cosmetic slot does not exist";
          }
        }
          else {
          return 'Error: No MainWindow';
        }

      }
        return 'Error: No data or not enough data provided.';

    },
    args: ['<top/bottom/mid/expression> <filename.png>']
  },
  'join-beta-room': {
    description: 'Joins a specific beta room, type "join-beta-room random" to join a random room (generates a random code)',
    // Arguments are passed as an array to the function
    function: (args) => {
      if (args && args.length > 0) {
        // The setActivity function has been modified to accept an overrideState
        if (mainWindow && args[0].toLowerCase()  !== 'random') {
          mainWindow.loadURL("https://preview.magiccircle.gg/r/"+args[0]);
          return `Room set to: ${args[0]}`;
        } else if (mainWindow && args[0].toLowerCase()  === 'random') {
          const roomToJoin = generateRandomString(4);
          mainWindow.loadURL("https://preview.magiccircle.gg/r/"+roomToJoin);
          return `Room set to: ${roomToJoin}`;
        }
          else {
          return 'Error: No MainWindow';
        }

      }
      return 'Error: No room provided.';
    },
    args: ['<room code>']
  },
  'send-chat-message': {
    description: 'Sends a chat message (No chat limit lol)',
    // Arguments are passed as an array to the function
    function: (args) => {
      if (args && args.length > 0) {
        // The setActivity function has been modified to accept an overrideState
        if (mainWindow && args[0].toLowerCase()  !== 'random') {
          mainWindow.webContents.executeJavaScript(`MagicCircle_RoomConnection.sendMessage({
    "scopePath": [
        "Room"
    ],
    "type": "Chat",
    "message": "${args[0]}"
})`);
          return `Sent Message: ${args[0]}`;
        } else {
          return 'Error: No MainWindow';
        }

      }
      return 'Error: No message provided.';
    },
    args: ['<chat message>']
  },
  'help': {
    description: 'Lists all available commands.',
    // Returns the commandConfig object for structured display in the renderer
    function: () => commandConfig,
    args: []
  },
  'usurp-host': {
    description: 'Become Host!',
    // Returns the commandConfig object for structured display in the renderer
    function: () => {
      if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`MagicCircle_RoomConnection.sendMessage({"scopePath": ["Room"],"type": "UsurpHost"})`);
        return "You are now host!";
      } else {
        return "Error: No main window!!!!";
      }
    },
    args: []
  },
  'set-player-name': {
    description: 'Sets the players name',
    // Arguments are passed as an array to the function
    function: (args) => {
      if (args && args.length > 0) {
        // The setActivity function has been modified to accept an overrideState
        if (mainWindow) {
          mainWindow.webContents.executeJavaScript(`MagicCircle_RoomConnection.sendMessage({"scopePath": ["Room"],"type": "SetPlayerData","name": "${args[0]}"});`);
          return `Player name set to: ${args[0]}`;
        }
          else {
          return 'Error: No MainWindow';
        }

      }
      return 'Error: No name provided.';
    },
    args: ['<player name>']
  },
  'error': {
    description: 'Returns an error ',
    // Returns the commandConfig object for structured display in the renderer
    function: () => {
        mainWindow.loadFile(path.join(__dirname, '../error-page/dist/index.html'));
      return "Error: blank";
    },
    args: []
  }, 'send-notification': {
      description: 'Sends a notification as magic garden',
      function: (args) => {
          if (args && args.length > 0) {
              notifier.notify({
                  title: 'Magic Garden',
                  message: `${args[0]}`,
                  appID: 'Magic Garden',
                  icon: path.join(__dirname, 'logo.ico'),
                  sound: true, // Play a sound
                  wait: false // Don't wait for user interaction
                });
              return 'Notification Sent!';
          } else {
              return "Error: No Arguments"
          }
      },
      args: ['<message>']
  }, 'firebase-pull': {
      description: 'Inits firebase',
      function: (args) => {
          //const ref = db.ref("/public-rooms");
          // ref.once("value", function(snapshot) {
            //  console.log(snapshot.val())
           // return snapshot.val();
          // });
              return 'Something Happened';
      },
      args: []
  }, 'firebase-write': {
      description: 'Sends a notification as magic garden',
      function: (args) => {
          if (args && args.length > 0) {
          //    const ref = db.ref(`/public-rooms/${args[0]}`);
          // ref.set({
           //   creator: 'umm12many',
            //  tags: args[1]
          // });
              return 'Data Written!';
          } else {
              return "Error: No Arguments"
          }
      },
      args: ['<roomcode> <tags>']
  }
};

// --- Main App Logic Functions (UNCHANGED) ---

// 1. insertToApp function (moved to module scope and accepts mainWindow for clarity)
function insertToApp(win) {
  try {
    const cssToInject = fs.readFileSync(path.join(__dirname, 'styles/inject.css'), 'utf8');
    win.webContents.insertCSS(cssToInject);
    const appStyles = fs.readFileSync(path.join(__dirname, 'styles/app-styles.css'), 'utf8');
    win.webContents.insertCSS(appStyles);
    console.log('CSS injected.');
    //Injecting a modified version of MGTools to test notifications, will eventually fix up better system tho:
    //mainWindow.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'MGToolsModifiedNotifications.js'), 'utf-8'));
    //console.log('MGTools injected.');
  } catch (error) {
    console.error('Error injecting CSS: Ensure inject.css exists in the same directory.', error.message);
  }
}

function throwJoinPage(win) {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
}
function throwErrorPage(win) {
    win.loadFile(path.join(__dirname, '../error-page/dist/index.html'));
}

// 2. Dev Console Window Creation
function createDevConsoleWindow() {
  if (devConsoleWindow) {
    if (devConsoleWindow.isMinimized()) devConsoleWindow.restore();
    devConsoleWindow.focus();
    return;
  }

  devConsoleWindow = new BrowserWindow({
    width: 600,
    height: 400,
    title: "Custom Dev Console",
    webPreferences: {
      preload: path.join(__dirname, 'dev-console-preload.js'),
      // Security best practices for Electron
      nodeIntegration: false,
      contextIsolation: true,
    },
    parent: mainWindow,
    modal: false,
    show: false, // Start hidden, show when ready
    autoHideMenuBar: true,
  });

  devConsoleWindow.loadFile(path.join(__dirname, 'dev-console.html'));

  devConsoleWindow.once('ready-to-show', () => {
    devConsoleWindow.show();
  });

  devConsoleWindow.on('closed', () => {
    devConsoleWindow = null;
  });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}
// Define the path to your settings file
const windowStatePath = path.join(userDataPath, 'window-state.json');
let windowState = {};
const defaultBounds = { width: 900, height: 700, x: undefined, y: undefined };

function loadWindowState() {
    try {
      const data = fs.readFileSync(windowStatePath, 'utf8');
      windowState = JSON.parse(data);
      // Ensure bounds are present, otherwise use defaults
      if (!windowState.bounds) {
          windowState.bounds = defaultBounds;
      }
    } catch (e) {
      // File doesn't exist or is invalid, use default state
      windowState.bounds = defaultBounds;
      windowState.isMaximized = false;
    }
  }


function updateTitle(win) {
  if (!win) return;
  const url = win.webContents.getURL();
  const isBeta = url.includes('preview.magiccircle.gg') || url.includes('preview.magicgarden.gg');
  const roomCodeMatch = url.match(/\/r\/([^?#]*)/);

  if (roomCodeMatch) {
    const roomCode = roomCodeMatch[1];
    const title = `Magic Garden - ${isBeta ? 'Beta ' : ''}${roomCode}`;
    win.setTitle(title);
    win.webContents.send('update-title', title);
  } else {
    const title = 'Magic Garden';
    win.setTitle(title);
    win.webContents.send('update-title', title);
  }
}

const createWindow = () => {
      loadWindowState();

  // Create the browser window.
  mainWindow = new BrowserWindow({
      // Assigned to module-scoped variable
      ...windowState.bounds,
      // Add other necessary window options here
      show: false, // Don't show until ready, which helps with re-maximizing
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Recommended for security
      nodeIntegration: true,
      backgroundThrottling: false // Keep timers running in background  
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#2b3035',
      symbolColor: '#fc4eb8',
      height: 40
    },
    icon: path.join(__dirname, 'logo.ico'),
  });
  //Load Magic Garden - Loads the deep link URL if one was provided before the window was created
  const { domain, isBeta } = getSettings();
  let initialUrl = deepLinkUrlToLoad || `https://${isBeta ? 'preview.' : ''}${domain}`;
  if (domain === 'starweaver.org' && isBeta) {
    initialUrl = 'https://preview.magiccircle.gg';
  }

  mainWindow.webContents.setUserAgent("McDesktopClient");
  mainWindow.loadURL(initialUrl).then(r => {
    console.log('Initial URL loaded:', initialUrl);
    updateTitle(mainWindow);
  }).catch(e => {
    console.error('Error loading initial URL:', e);
  });

  mainWindow.webContents.on('did-navigate', () => {
    updateTitle(mainWindow);
  });

  // Restore maximized state after the window is created and ready
  mainWindow.once('ready-to-show', () => {
    if (windowState.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  // Save window state before the window is closed
  mainWindow.on('close', () => {
    // 1. Check if the window is currently maximized
    const isMaximized = mainWindow.isMaximized();

    // 2. If it's maximized, unmaximize it to get the normal bounds
    if (isMaximized) {
      mainWindow.unmaximize();
    }

    // 3. Get the current bounds (width, height, x, y)
    const bounds = mainWindow.getBounds();

    // 4. Save the state to the JSON object
    const stateToSave = {
      bounds: bounds,
      isMaximized: isMaximized
    };

    try {
      fs.writeFileSync(windowStatePath, JSON.stringify(stateToSave));
    } catch (e) {
      console.error('Failed to save window state:', e);
    }

    // Dereference the window object
    mainWindow = null;
  });


  // Clear the variable after use
  deepLinkUrlToLoad = null;

  // --- IPC Handlers (UNCHANGED) ---

  // IPC handler for main app's preload.js to run insertToApp
  ipcMain.handle('main-process-function:insertToApp', () => {
    console.log('IPC event received: insertToApp');
    insertToApp(mainWindow);
    return 'insertToApp completed.';
  });

  ipcMain.handle('main-process-function:throwJoinPage', () => {
      console.log('IPC event received: Throwing Join Page');
      throwJoinPage(mainWindow);
      return 'insertToApp completed.';
  })

  ipcMain.handle('main-process-function:throwErrorPage', () => {
      console.log('IPC event received: Error');
      if (mainWindow.webContents.window.location.pathname !== "index.html") {
          throwErrorPage(mainWindow);
      }
      return 'insertToApp completed.';
  })
  // IPC handler for Dev Console to execute commands
  ipcMain.handle('dev-console:execute-command', async (event, commandName, args) => {
    try {
      const command = commandConfig[commandName];
      if (!command) {
        return `Error: Command "${commandName}" not found. Type "help" for help.`;
      }

      const result = await command.function(args);

      // Return a string representation of the result for the console
      return `${commandName}: ${JSON.stringify(result, null, 2)}`;

    } catch (error) {
      console.error(`Dev Console command error for ${commandName}:`, error);
      return `Execution Error for "${commandName}": ${error.message}`;
    }
  });

  ipcMain.handle('read-file-content', (event, relativePath) => {
    const filePath = path.join(__dirname, relativePath);
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Failed to read file: ${filePath}`, error);
        return null;
    }
  });

  ipcMain.handle('settings:get-current-domain', () => {
      return getSettings();
  });

  ipcMain.handle('settings:set-domain', (event, domain, isBeta) => {
      const settings = getSettings();
      settings.domain = domain;
      settings.isBeta = isBeta;
      saveSettings(settings);
  });

  ipcMain.handle('settings:get-sfx-volume', () => {
      return getSettings().sfxVolume;
  });

  ipcMain.handle('settings:set-sfx-volume', (event, volume) => {
      const settings = getSettings();
      settings.sfxVolume = volume;
      saveSettings(settings);
      return true; // Indicate success
  });

  ipcMain.handle('settings:get-mod-settings', () => {
      const settings = getSettings();
      return {
          disableMods: settings.disableMods,
          disableController: settings.disableController
      };
  });

  ipcMain.handle('settings:set-mod-settings', (event, disableMods, disableController) => {
      const settings = getSettings();
      settings.disableMods = disableMods;
      settings.disableController = disableController;
      saveSettings(settings);
      return true; // Indicate success
  });

  ipcMain.handle('settings:set-mod-enabled', (event, modName, isEnabled) => {
    const settings = getSettings();
    if (!settings.mods) {
      settings.mods = {};
    }
    settings.mods[modName] = isEnabled;
    saveSettings(settings);
    return true;
  });

  ipcMain.handle('settings:get-mod-enabled', (event, modName) => {
    const settings = getSettings();
    return settings.mods && settings.mods[modName];
  });

  ipcMain.handle('settings:get-mod-setting', (event, modName, settingKey) => {
    const settings = getModSettings();
    return settings.mods && settings.mods[modName] && settings.mods[modName][settingKey];
  });

  ipcMain.handle('settings:set-mod-setting', (event, modName, settingKey, value) => {
    const settings = getModSettings();
    if (!settings.mods) {
      settings.mods = {};
    }
    if (!settings.mods[modName]) {
      settings.mods[modName] = {};
    }
    settings.mods[modName][settingKey] = value;
    saveModSettings(settings);
    return true;
  });

  ipcMain.on('app:relaunch', () => {
      app.relaunch();
      app.quit();
  });

  ipcMain.handle('get-audio-base64', (event, filename) => {
    const audioFilePath = path.join(__dirname, 'audio', filename);
    try {
      const fileContent = fs.readFileSync(audioFilePath);
      const base64 = fileContent.toString('base64');
      return `data:audio/mpeg;base64,${base64}`;
    } catch (error) {
      console.error(`Failed to read or encode audio file: ${audioFilePath}`, error);
      return null;
    }
  });

  ipcMain.handle('preload:get-main-injection', () => {
      const scriptPath = path.join(__dirname, 'preload-scripts', 'main-injection.js');
      try {
          return fs.readFileSync(scriptPath, 'utf8');
      } catch (error) {
          console.error('Failed to read main-injection.js:', error);
          return null;
      }
  });

  ipcMain.handle('preload:get-controller-handler', () => {
      const scriptPath = path.join(__dirname, 'preload-scripts', 'gamepad-preload.js'); // controller-handler.js renamed to gamepad-preload.js but only for now because i need to change code references later
      try {
          return fs.readFileSync(scriptPath, 'utf8');
      } catch (error) {
          console.error('Failed to read controller-handler.js:', error);
          return null;
      }
  });

  ipcMain.handle('get-mods', () => {
    const modsDir = path.join(__dirname, 'mods');
    try {
        const modFolders = fs.readdirSync(modsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        const mods = modFolders.map(folder => {
            const modPath = path.join(modsDir, folder);
            const metadataPath = path.join(modPath, 'mod.json');

            try {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                const mainFilePath = path.join(modPath, metadata.file);
                const content = fs.readFileSync(mainFilePath, 'utf8');
                let tabContent = null;
                if (metadata.tab) {
                    const tabPath = path.join(modPath, metadata.tab);
                    tabContent = fs.readFileSync(tabPath, 'utf8');
                }
                return { ...metadata, content, tabContent, id: folder };
            } catch (error) {
                console.error(`Failed to read mod: ${folder}`, error);
                return null;
            }
        }).filter(mod => mod !== null);

        return mods;
    } catch (error) {
        console.error('Failed to read mods directory:', error);
        return [];
    }
  });

  ipcMain.handle('get-mod-files', (event, modId, directory) => {
    const modPath = path.join(__dirname, 'mods', modId, directory);
    try {
      return fs.readdirSync(modPath);
    } catch (error) {
      console.error(`Failed to read directory: ${modPath}`, error);
      return [];
    }
  });

  ipcMain.handle('get-mod-file-content', (event, modId, filePath) => {
    const fullPath = path.join(__dirname, 'mods', modId, filePath);
    try {
      return fs.readFileSync(fullPath, 'utf8');
    } catch (error) {
      console.error(`Failed to read file: ${fullPath}`, error);
      return null;
    }
  });

  ipcMain.handle('mod:inject-css', (event, cssContent) => {
    if (mainWindow) {
      mainWindow.webContents.insertCSS(cssContent).then(() => {
        console.log('Mod CSS injected via main process.');
      }).catch(error => {
        console.error('Error injecting mod CSS via main process:', error);
      });
      return true;
    }
    return false;
  });

  // --- Global Shortcuts (UNCHANGED) ---

  // --- Firebase IPC Handlers ---
  const firebaseHandler = require('./backend-modules/firebase-handler.js');

  firebaseHandler.onAuthStateChanged(user => {
      console.log('[Main Process] Auth state changed:', user ? user.uid : 'Logged out');
      if (mainWindow) {
          mainWindow.webContents.send('firebase:authStateChanged', user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null);
      }
  });

  ipcMain.handle('firebase:signIn', (event, email, password) => {
     const userCredentialsJSON = path.join(userDataPath, 'user-credentials.json');
     fs.writeFileSync(userCredentialsJSON, JSON.stringify({ email: email, password: password }));
     return firebaseHandler.signIn(email, password);
  });
  ipcMain.handle('firebase:createAccount', (event, email, password) => firebaseHandler.createAccount(email, password));
  ipcMain.handle('firebase:signOut', () => firebaseHandler.signOut());
  ipcMain.handle('firebase:createRoom', (event, roomName, tags) => {
      const user = firebaseHandler.auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      return firebaseHandler.createRoom(roomName, tags, user);
  });
  ipcMain.handle('firebase:deleteRoom', (event, roomName) => firebaseHandler.deleteRoom(roomName));

  ipcMain.handle('firebase:getRoomsOnce', async () => {
      console.log('[Main Process] IPC: firebase:getRoomsOnce invoked.');
      try {
          const rooms = await firebaseHandler.getRoomsOnce();
          return rooms; // Return rooms directly to the invoker
      } catch (error) {
          console.error('[Main Process] Error in firebase:getRoomsOnce:', error);
          throw error;
      }
  });

  ipcMain.handle('firebase:request-initial-data', async () => {
      console.log('[Main Process] Initial data requested by UI.');
      const userCredentialsJSON = path.join(userDataPath, 'user-credentials.json');
      if (fs.existsSync(userCredentialsJSON) && fs.readFileSync(userCredentialsJSON, 'utf8').length > 0) {
          const { email, password } = JSON.parse(fs.readFileSync(userCredentialsJSON, 'utf8'));
          try {             await firebaseHandler.signIn(email, password);
          } catch (error) {
              console.error('[Main Process] Auto sign-in failed:', error);
          }
       }


      const user = firebaseHandler.auth.currentUser;
      if (mainWindow) {
          mainWindow.webContents.send('firebase:authStateChanged', user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null);
      }
  });

  ipcMain.handle('game:get-current-room-code', () => {
    if (mainWindow) {
      const url = mainWindow.webContents.getURL();
      const roomCodeMatch = url.match(/\/r\/([^?#]*)/);
      return roomCodeMatch ? roomCodeMatch[1] : null;
    }
    return null;
  });

  ipcMain.handle('game:disable-input', () => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`

      `).catch(error => console.error('[Main Process] Error disabling game input:', error));
      console.log('[Main Process] Game input disabled.');
    }
  });

  ipcMain.handle('game:enable-input', () => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`
                    
      `).catch(error => console.error('[Main Process] Error enabling game input:', error));
      console.log('[Main Process] Game input enabled.');
    }
  });

  ipcMain.handle('game:get-player-count', async () => {
    if (mainWindow) {
      try {
        const playerCount = await mainWindow.webContents.executeJavaScript(`
          new Promise((resolve) => {
            const checkConnection = () => {
              try {
                const roomConnection = window.MagicCircle_RoomConnection;
                if (roomConnection && roomConnection.lastRoomStateJsonable) {
                  const roomState = roomConnection.lastRoomStateJsonable;
                  const userSlots = roomState.child.data.userSlots;
                  const count = userSlots.filter(slot => slot !== null && slot !== undefined).length;
                  resolve(count);
                } else {
                  setTimeout(checkConnection, 500); // Retry after 500ms
                }
              } catch (err) {
                console.error('Error checking MagicCircle_RoomConnection in game world:', err);
                resolve(null); // Resolve with null on error
              }
            };
            checkConnection(); // Start checking
          });
        `);
        return playerCount;
      } catch (error) {
        console.error('[Main Process] Error getting player count from game world:', error);
        return null;
      }
    }
    return null;
  });

  ipcMain.handle('firebase:makeRoomPublic', async (event, roomCode, tags) => {
      const user = firebaseHandler.auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      return firebaseHandler.makeRoomPublic(roomCode, tags, user);
  });

  ipcMain.handle('firebase:makeRoomNotPublic', async (event, roomCode) => {
      return firebaseHandler.makeRoomNotPublic(roomCode);
  });

  ipcMain.handle('firebase:updatePlayerCount', async (event, roomCode, count) => {
      return firebaseHandler.updatePlayerCount(roomCode, count);
  });

  app.on('browser-window-focus', function () {
    globalShortcut.register("CommandOrControl+R", async () => {
      mainWindow.webContents.setUserAgent("McDesktopClient");
      await mainWindow.reload()
      insertToApp(mainWindow);
      console.log("CommandOrControl+R is pressed: Reloading Page");
    });
    globalShortcut.register("CommandOrControl+Shift+I", () => {
      console.log("CommandOrControl+Shift+I is pressed: Shortcut Disabled, (DevTools)");
    });
    globalShortcut.register("CommandOrControl+M", () => {
      mainWindow.webContents.openDevTools();
      console.log("Opening Devtools");
    });
    globalShortcut.register("F5", () => {
      insertToApp(mainWindow);
      console.log("F5 is pressed: Reinserting CSS and any JS in insertToApp()");
    });
    // New global shortcut for Dev Console
    globalShortcut.register("CommandOrControl+D", () => {
      createDevConsoleWindow();
      console.log("Opening Dev Console");
    });
  });

  app.on('browser-window-blur', function () {
    globalShortcut.unregister('CommandOrControl+R');
    globalShortcut.unregister('CommandOrControl+Shift+I');
    globalShortcut.unregister('CommandOrControl+M');
    globalShortcut.unregister('F5');
    globalShortcut.unregister('CommandOrControl+D'); // Unregister Dev Console shortcut
    globalShortcut.unregister('CommandOrControl+S');
  });
  // Handle uncaught exceptions in the main process
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception in Main Process:', error);

    // Display a custom error page or dialog
    if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(path.join(__dirname, '../error-page/dist/index.html'));
      // Or show a dialog box
      // dialog.showErrorBox('Application Error', 'An unexpected error occurred: ' + error.message);
    }
    // Optionally, exit the application after displaying the error
    // app.quit();
  });
  // --- Discord RPC Logic (UNCHANGED) ---
  const clientId = '1227719606223765687';
  DiscordRPC.register(clientId);
  const rpc = new DiscordRPC.Client({ transport: 'ipc' });
  const startTimestamp = new Date();

  // Modified to accept an optional state override for the dev console command
  async function setActivity(overrideState) {
    if (!rpc || !mainWindow) return;

    let finalGameActive;

    if (overrideState) {
        finalGameActive = overrideState;
    } else {
        const gameActive = await mainWindow.webContents.executeJavaScript('window.mc_desktop_current_game_name');
        finalGameActive = gameActive !== 'Lobby' && gameActive !== undefined ? `Playing ${gameActive}` : `Sifting up soil in Magic Garden`;
    }

    await rpc.setActivity({
      details: `Magic Garden Desktop Client (Canary)`,
      state: `${finalGameActive}`,
      startTimestamp,
      largeImageKey: 'app_image',
      largeImageText: 'Magic Garden Icon',
      instance: false,
    });
  }

  // Initial call, this will be run at startup, but the preload script will call it again on DOMContentLoaded
  insertToApp(mainWindow);

  rpc.on('ready', () => {
    setActivity();
    setInterval(() => {
      setActivity();
    }, 15e3);
  });

  rpc.login({ clientId }).catch(console.error);
};

// --- Protocol Handling and Single Instance Logic ---

// Set protocol client for Windows (handle deep links when app is closed)
if (process.platform === 'win32') {
    // When the app is launched via deep link, the link is passed as an argument
    // process.argv[1] is the application path when packed, or index.js when running from source

    // FIX: Set the protocol client with NO extra arguments.
    // This ensures that when a deep link is clicked, the URL itself is passed
    // as the main argument to the new app instance, and the app can be launched
    // normally without being forced to use an argument.
    app.setAsDefaultProtocolClient('magic-garden'); // Setting the second and third arguments to their defaults (process.execPath, [])

    // **NEW:** Check for a deep link URL in the initial command line arguments
    const deepLinkArg = process.argv.find(arg => arg.startsWith('magic-garden://'));
    if (deepLinkArg) {
        deepLinkUrlToLoad = deepLinkArg;
    }
} else {
    // Other platforms (macOS, Linux) use the 'open-url' event, even for the first instance
    app.setAsDefaultProtocolClient('magic-garden');
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // A second instance was launched via deep link.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }

    // The commandLine array contains the arguments, with the deep link usually being the last one
    // when launched externally on Windows, or somewhere in the middle depending on the OS/setup.
    // We search for the argument that starts with your custom protocol.
    const deepLinkArg = commandLine.find(arg => arg.startsWith('magic-garden://'));

    if (deepLinkArg) {
        handleProtocolUrl(deepLinkArg);
    }
  })

  // Create mainWindow, load the rest of the app, etc...
  app.whenReady().then(() => {
    createWindow()
  })
}

// Handle the protocol on non-Windows platforms (and sometimes Windows for first instance)
app.on('open-url', (event, url) => {
    event.preventDefault(); // Must prevent default on macOS
    handleProtocolUrl(url);
})

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});