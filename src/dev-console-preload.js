const { contextBridge, ipcRenderer } = require('electron');

// Expose a dedicated API for the Dev Console window
contextBridge.exposeInMainWorld('devConsoleApi', {
    /**
     * Sends a command name and arguments to the main process for execution.
     * @param {string} command - The command name (e.g., 'reload').
     * @param {string|string[]} args - A string or Array of string arguments.
     * @returns {Promise<string|object>} A promise that resolves with the execution result or error message.
     */
    executeCommand: (command, args) => {
        // Ensure args is an array, wrapping it if it's a single string,
        // or using an empty array if it's null/undefined.
        const finalArgs = Array.isArray(args) ? args : (args === undefined || args === null ? [] : [args]);
        return ipcRenderer.invoke('dev-console:execute-command', command, finalArgs);
    },
});