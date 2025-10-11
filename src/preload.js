// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron') // Added ipcRenderer
const magicCircleDesktopVersion = "Canary0.0.1"
contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  magicCircleDesktop: magicCircleDesktopVersion,
})

// New API exposed for main app functions
contextBridge.exposeInMainWorld('appApi', {
    // Expose a function that invokes the main process's insertToApp function
    insertToApp: () => ipcRenderer.invoke('main-process-function:insertToApp'),
    throwJoinPage: () => ipcRenderer.invoke('main-process-function:throwJoinPage'),
})


window.addEventListener('DOMContentLoaded', () => {
  // Your injection logic goes here.
  // This code will run every time a new page loads in the BrowserWindow.
  //THX MYKE FOR YOUR CODE IMA PUT IT HERE!
  try {
              Object.defineProperty(document, "hidden", {
                  value: false,
                  writable: false,
                  configurable: false
              });
              Object.defineProperty(document, "visibilityState", {
                  value: "visible",
                  writable: false,
                  configurable: false
              });
              window.console.log('✅ [IDLE-PREVENTION] Document properties overridden');
          } catch (e) {
            window.console.warn('⚠️ [IDLE-PREVENTION] Could not override document properties:', e);
          }

          // Block idle detection events with capture phase (highest priority)
          document.addEventListener("visibilitychange", (e) => {
              e.stopImmediatePropagation();
              e.preventDefault();
          }, true);

          window.addEventListener("blur", (e) => {
              e.stopImmediatePropagation();
              e.preventDefault();
          }, true);

          window.addEventListener("focus", (e) => {
              e.stopImmediatePropagation();
              e.preventDefault();
          }, true);

          window.console.log('✅ [IDLE-PREVENTION] Event listeners added with capture phase');

    const injectDiv = () => {
              //<p class="chakra-text css-1491zxh">This room is full.</p>
    //Code for room is fuull, adding a text box to join a new room:
    const rfTargetElements = document.querySelectorAll('p.chakra-text.css-1491zxh');

    for (const p of rfTargetElements) {
        // Ensure we've found the correct element by checking its text content.
        if (p.textContent.trim().startsWith('This room is full.')) {
            ipcRenderer.invoke('main-process-function:throwJoinPage')
        }
    }


    //Added some versioning stuff:
    // Find all <p> tags with the exact classes you specified.
    const targetElements = document.querySelectorAll('p.chakra-text.css-a4hk4l');

    for (const p of targetElements) {
      // Ensure we've found the correct element by checking its text content.
      if (p.textContent.trim().startsWith('Server Version:')) {
        const parent = p.parentElement;
        if (!parent) continue;

        const grandparent = parent.parentElement;
        if (!grandparent) continue;

        // Use a unique ID to prevent injecting the info more than once in the same spot.
        const injectionId = 'electron-version-info-injected';
        if (grandparent.querySelector(`#${injectionId}electron`)) {
          continue; // Skip if we've already injected the element here.
        }
        if (grandparent.querySelector(`#${injectionId}chrome`)) {
            continue; // Skip if we've already injected the element here.
        }
        if (grandparent.querySelector(`#${injectionId}node`)) {
            continue; // Skip if we've already injected the element here.
          }
        if (grandparent.querySelector(`#${injectionId}mcdesktop`)) {
            continue; // Skip if we've already injected the element here.
          }
        console.log('[Electron Injector] Found target. Injecting version info.');

        // Create the electron version
        const electronVersion = document.createElement('div');
        electronVersion.id = injectionId+"electron";
        electronVersion.className = "McFlex css-1t8agva";
        // Populate the text!
        electronVersion.innerHTML = `<p class="chakra-text css-a4hk4l">Electron Version:</p><p class="chakra-text css-t9gick">v${process.versions.electron}</p>`;
        // Append to the grandparent element.
        grandparent.appendChild(electronVersion);
        // Create the chrome version
        const chromeVersion = document.createElement('div');
        chromeVersion.id = injectionId+"chrome";
        chromeVersion.className = "McFlex css-1t8agva";
        // Populate the text!
        chromeVersion.innerHTML = `<p class="chakra-text css-a4hk4l">Chrome Version:</p><p class="chakra-text css-t9gick">v${process.versions.chrome}</p>`;
        // Append to the grandparent element.
        grandparent.appendChild(chromeVersion);
        // Create the chrome version
        const nodeVersion = document.createElement('div');
        nodeVersion.id = injectionId+"node";
        nodeVersion.className = "McFlex css-1t8agva";
        // Populate the text!
        nodeVersion.innerHTML = `<p class="chakra-text css-a4hk4l">Node Version:</p><p class="chakra-text css-t9gick">v${process.versions.node}</p>`;
        // Append to the grandparent element.
        grandparent.appendChild(nodeVersion);
        const appVersion = document.createElement('div');
        appVersion.id = injectionId+"mcdesktop";
        appVersion.className = "McFlex css-1t8agva";
        // Populate the text!
        appVersion.innerHTML = `<p class="chakra-text css-a4hk4l">MGDesktop Version:</p><p class="chakra-text css-t9gick">v${magicCircleDesktopVersion}</p>`;
        // Append to the grandparent element.
        grandparent.appendChild(appVersion);
      }
    }
    };

            // A MutationObserver is the most efficient way to watch for DOM changes.
            const observer = new MutationObserver(() => {
              // When any change is detected, we run our function to find the element.
              console.log('[Electron Injector] DOM change detected. Running check...');
              injectDiv();
            });

            // Start observing the entire document body for any added or removed nodes.
            observer.observe(document.body, {
              childList: true, // Watch for direct children changes
              subtree: true    // Watch for all descendants
            });

            // Run the check once right after the page loads, in case the element is already present.
            injectDiv();
  // Execute insertToApp in the main process via IPC, as requested
  window.appApi.insertToApp()
    .then(() => console.log('insertToApp executed via IPC on DOMContentLoaded.'))
    .catch(err => console.error('Failed to run insertToApp via IPC:', err));

  console.log('DOMContentLoaded event fired! Code has been injected.');
});
