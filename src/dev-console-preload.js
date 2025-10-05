const { contextBridge, ipcRenderer } = require('electron');

// Expose a dedicated API for the Dev Console window
contextBridge.exposeInMainWorld('devConsoleApi', {
    /**
     * Sends a command name and arguments to the main process for execution.
     * @param {string} command - The command name (e.g., 'reload').
     * @param {string[]} args - Array of string arguments.
     * @returns {Promise<string|object>} A promise that resolves with the execution result or error message.
     */
    executeCommand: (command, args) => ipcRenderer.invoke('dev-console:execute-command', command, args),
});
