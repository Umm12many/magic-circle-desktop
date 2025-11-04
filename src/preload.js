const { contextBridge, ipcRenderer } = require('electron');

const magicCircleDesktopVersion = "Canary0.0.1";

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  magicCircleDesktop: magicCircleDesktopVersion,
});

contextBridge.exposeInMainWorld('appApi', {
    insertToApp: () => ipcRenderer.invoke('main-process-function:insertToApp'),
    throwJoinPage: () => ipcRenderer.invoke('main-process-function:throwJoinPage'),
});

contextBridge.exposeInMainWorld('devConsoleApi', {
    executeCommand: (command, args) => {
        const finalArgs = Array.isArray(args) ? args : (args === undefined || args === null ? [] : [args]);
        return ipcRenderer.invoke('dev-console:execute-command', command, finalArgs);
    },
});

const desktopApi = {
  readFile: (relativePath) => ipcRenderer.invoke('read-file-content', relativePath),
  settings: {
    getCurrentDomain: () => ipcRenderer.invoke('settings:get-current-domain'),
    setDomain: (domain, isBeta) => ipcRenderer.invoke('settings:set-domain', domain, isBeta)
  }
};
contextBridge.exposeInMainWorld('desktopApi', desktopApi);

window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.invoke('main-process-function:insertToApp')
    .then(() => console.log('insertToApp executed via IPC on DOMContentLoaded.'))
    .catch(err => console.error('Failed to run insertToApp via IPC:', err));

  ipcRenderer.invoke('preload:get-main-injection').then(scriptContent => {
    if (scriptContent) {
      try {
        new Function('require', 'ipcRenderer', 'process', 'desktopApi', scriptContent)(require, ipcRenderer, process, desktopApi);
        console.log('Successfully loaded main-injection.js.');
      } catch (error) {
        console.error('Failed to execute main-injection.js:', error);
      }
    }
  }).catch(err => console.error('Failed to get main-injection.js via IPC:', err));

  // Load controller-handler.js
  ipcRenderer.invoke('preload:get-controller-handler').then(scriptContent => {
    if (scriptContent) {
      try {
        new Function('ipcRenderer', scriptContent)(ipcRenderer); // Pass ipcRenderer to the script
        console.log('Successfully loaded controller-handler.js.');
      } catch (error) {
        console.error('Failed to execute controller-handler.js:', error);
      }
    }
  }).catch(err => console.error('Failed to get controller-handler.js via IPC:', err));
});