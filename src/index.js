const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron'); // Added ipcMain
const path = require('node:path');
const fs = require('node:fs');
const DiscordRPC = require('discord-rpc');

let mainWindow; // Module-scoped variable to hold the main window
let devConsoleWindow = null; // New module-scoped variable for the dev console

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

// Example of how to use it later (e.g., after some time has passed)
setTimeout(async () => {
    const cosmetic = await getCosmeticObjectFromRenderer(mainWindow);
    console.log("The player's cosmetic is:", cosmetic.avatar);
}, 5000); // Wait 5 seconds, assuming the game object is loaded by then
// --- Custom Command Configuration ---
// This object makes it easy to add new custom commands.
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
      return "Error: blank";
    },
    args: []
  }
};

// --- Main App Logic Functions ---

// 1. insertToApp function (moved to module scope and accepts mainWindow for clarity)
function insertToApp(win) {
  try {
    const cssToInject = fs.readFileSync(path.join(__dirname, 'inject.css'), 'utf8');
    win.webContents.insertCSS(cssToInject);
    console.log('CSS injected.');
  } catch (error) {
    console.error('Error injecting CSS: Ensure inject.css exists in the same directory.', error.message);
  }
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

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({ // Assigned to module-scoped variable
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Recommended for security
      nodeIntegration: false,
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

  // --- IPC Handlers ---

  // IPC handler for main app's preload.js to run insertToApp
  ipcMain.handle('main-process-function:insertToApp', () => {
    console.log('IPC event received: insertToApp');
    insertToApp(mainWindow);
    return 'insertToApp completed.';
  });

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

  // --- Global Shortcuts ---

  app.on('browser-window-focus', function () {
    globalShortcut.register("CommandOrControl+R", async () => {
      mainWindow.webContents.setUserAgent("McDesktopClient");
      await mainWindow.reload()
      insertToApp(mainWindow);
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
      insertToApp(mainWindow);
      console.log("F5 is pressed: Shortcut Disabled");
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
  });

  // --- Discord RPC Logic ---
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
        finalGameActive = gameActive !== 'Lobby' && gameActive !== undefined ? `Playing ${gameActive}` : `Browsing games in Lobby`;
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

// This method will be called when Electron has finished
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
