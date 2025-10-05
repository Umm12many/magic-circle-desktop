// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron') // Added ipcRenderer

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  magicCircleDesktop: "testing",
})

// New API exposed for main app functions
contextBridge.exposeInMainWorld('appApi', {
    // Expose a function that invokes the main process's insertToApp function
    insertToApp: () => ipcRenderer.invoke('main-process-function:insertToApp'),
})


window.addEventListener('DOMContentLoaded', () => {
  // Your injection logic goes here.
  // This code will run every time a new page loads in the BrowserWindow.

  // Execute insertToApp in the main process via IPC, as requested
  window.appApi.insertToApp()
    .then(() => console.log('insertToApp executed via IPC on DOMContentLoaded.'))
    .catch(err => console.error('Failed to run insertToApp via IPC:', err));

  console.log('DOMContentLoaded event fired! Code has been injected.');
});

Object.defineProperty(document, "hidden", {
    value: false,
    writable: false
});
Object.defineProperty(document, "visibilityState", {
    value: "visible",
    writable: false
});

document.addEventListener("visibilitychange", (e) => {
    e.stopImmediatePropagation();
}, true);

window.addEventListener("blur", (e) => {
    e.stopImmediatePropagation();
}, true);

window.addEventListener("focus", (e) => {
    e.stopImmediatePropagation();
}, true);
