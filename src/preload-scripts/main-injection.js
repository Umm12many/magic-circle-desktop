// Your injection logic goes here.
  // This code will run every time a new page loads in the BrowserWindow.

  magicCircleDesktopVersion = "Canary0.0.1";
  let tabListenerAdded = false;
  let aboutTabRepositioned = false;

  // title: string, htmlContent: string, iconHtml: string, setupFunction: (panel: HTMLElement) => void, existingPanelId: string (optional)
  function addCustomTab(title, htmlContent, iconHtml, setupFunction, existingPanelId = null, referenceNode = null) {
    const tabGrid = document.querySelector('.chakra-tabs__tablist .McGrid.css-1p0663w');
    const tabPanels = document.querySelector('.chakra-tabs__tab-panels');

    if (!tabGrid || !tabPanels) return;

    const tabId = `custom-tab-${title.replace(/\s+/g, '-').toLowerCase()}`;
    let panelId = existingPanelId; // Use existingPanelId if provided
    if (!panelId) {
        panelId = `custom-panel-${title.replace(/\s+/g, '-').toLowerCase()}`;
    }

    if (document.getElementById(tabId)) return; // Tab already exists

    // Create tab button
    const newTabButton = document.createElement('button');
    newTabButton.id = tabId;
    newTabButton.type = 'button';
    newTabButton.className = 'chakra-tabs__tab css-174zdw0';
    newTabButton.setAttribute('role', 'tab');
    newTabButton.setAttribute('aria-selected', 'false');
    newTabButton.setAttribute('tabindex', '-1');
    newTabButton.setAttribute('aria-controls', panelId);

    if (iconHtml) {
        if (iconHtml.includes('<svg')) {
            // It's an SVG, insert directly
            newTabButton.innerHTML = iconHtml;
        } else if (iconHtml.includes('material-icons')) {
            // It's a Material Icon class
            const iconSpan = document.createElement('span');
            iconSpan.className = 'material-icons';
            iconSpan.textContent = iconHtml.replace('material-icons ', ''); // Extract icon name
            newTabButton.appendChild(iconSpan);
        } else if (iconHtml.includes('material-symbols')) {
            // It's a Material Symbols class
            const iconSpan = document.createElement('span');
            iconSpan.className = 'material-symbols-outlined'; // Use the outlined style for consistency
            iconSpan.textContent = iconHtml.replace('material-symbols ', ''); // Extract icon name
            newTabButton.appendChild(iconSpan);
        } else if (iconHtml.includes('fa-')) {
            // It's a Font Awesome icon class
            const iconI = document.createElement('i');
            iconI.className = iconHtml;
            newTabButton.appendChild(iconI);
        } else {
            // Fallback for other types or plain text
            newTabButton.innerHTML = iconHtml;
        }
    }
    newTabButton.append(title);

    // Create tab panel if not using an existing one
    if (!existingPanelId) {
        const newTabPanel = document.createElement('div');
        newTabPanel.id = panelId;
        newTabPanel.className = 'chakra-tabs__tab-panel css-1qbr3jw';
        newTabPanel.setAttribute('role', 'tabpanel');
        newTabPanel.hidden = true;
        if (htmlContent) {
            newTabPanel.innerHTML = htmlContent;
        }
        tabPanels.appendChild(newTabPanel);
    }

    if (referenceNode) {
        tabGrid.insertBefore(newTabButton, referenceNode);
    } else {
        tabGrid.appendChild(newTabButton);
    }

    // Run the setup function to add event listeners
    if (setupFunction) {
        const panelToSetup = existingPanelId ? document.getElementById(existingPanelId) : document.getElementById(panelId);
        if (panelToSetup) {
            setupFunction(panelToSetup);
        }
    }
  }

  let currentSfxVolume = 1.0; // Global variable to store SFX volume

  async function setupSettingsTab() {
    const settingsHTML = await desktopApi.readFile('tabs/settings.html');
    if (!settingsHTML) return;

    const setup = async (panel) => {
        const domainSelect = panel.querySelector('#domain-select');
        const betaCheckbox = panel.querySelector('#beta-checkbox');
        const sfxVolumeSlider = panel.querySelector('#sfx-volume-slider');
        const saveButton = panel.querySelector('#save-button'); // New
        const saveChangesButton = panel.querySelector('#save-changes-button'); // New

        if (!domainSelect || !betaCheckbox || !sfxVolumeSlider || !saveButton || !saveChangesButton) return; // Updated

        // Handle visual state of the switch
        const updateSwitchVisuals = () => {
            const track = betaCheckbox.nextElementSibling; // The track span
            if (track && track.classList.contains('chakra-switch__track')) {
                const thumb = track.querySelector('.chakra-switch__thumb');
                if (betaCheckbox.checked) {
                    track.setAttribute('data-checked', '');
                    if (thumb) {
                        thumb.setAttribute('data-checked', '');
                    }
                } else {
                    track.removeAttribute('data-checked');
                    if (thumb) {
                        thumb.removeAttribute('data-checked');
                    }
                }
            }
        };

        // Load initial settings
        try {
            const currentSettings = await desktopApi.settings.getCurrentDomain(); // This also returns sfxVolume now
            if (currentSettings) {
                domainSelect.value = currentSettings.domain;
                betaCheckbox.checked = currentSettings.isBeta;
                currentSfxVolume = currentSettings.sfxVolume !== undefined ? currentSettings.sfxVolume : 1.0; // Update global volume
                sfxVolumeSlider.value = currentSfxVolume; // Set slider value
                updateSwitchVisuals();
            }
        } catch (error) {
            console.error('Failed to load initial settings:', error);
        }

        // Add listener for changes
        betaCheckbox.addEventListener('change', updateSwitchVisuals);

        // SFX Volume Slider Listener
        sfxVolumeSlider.addEventListener('input', (event) => {
            currentSfxVolume = parseFloat(event.target.value);
            // Optionally, play a preview sound here
        });

        // Centralized save logic
        const saveSettings = async () => {
            const domain = domainSelect.value;
            const isBeta = betaCheckbox.checked;
            await desktopApi.settings.setDomain(domain, isBeta);
            await desktopApi.settings.setSfxVolume(currentSfxVolume); // Save SFX volume
        };

        // Handle Save Changes button click
        saveChangesButton.addEventListener('click', async () => {
            await saveSettings();
            console.log('[MagicGardenController] Settings saved.');
        });

        // Handle Save and Restart button click
        saveButton.addEventListener('click', async () => {
            await saveSettings();
            console.log('[MagicGardenController] Settings saved. Relaunching app...');
            desktopApi.app.relaunch(); // Assuming desktopApi.app.relaunch() exists
        });
    };

    const settingsSVG = `material-symbols settings_heart`;
    addCustomTab('Desktop App Settings', settingsHTML, settingsSVG, setup);
  }

  async function setupControllerDebugTab() {
    const debugHTML = await desktopApi.readFile('tabs/controller-debug.html');
    if (!debugHTML) return;

    const setup = async (panel) => {
        const controllerStatusDiv = panel.querySelector('#controller-status');
        const gamepadIdSpan = panel.querySelector('#gamepad-0-id');
        const buttonsUl = panel.querySelector('#gamepad-0-buttons');
        const axesUl = panel.querySelector('#gamepad-0-axes');

        if (!controllerStatusDiv || !gamepadIdSpan || !buttonsUl || !axesUl) return;

        setInterval(() => {
            const gamepads = navigator.getGamepads();
            let statusText = 'No controllers connected.';

            if (gamepads.length > 0 && gamepads[0]) {
                const gamepad = gamepads[0];
                statusText = `Controller ${gamepad.index}: Connected`;
                gamepadIdSpan.textContent = gamepad.id;

                // Update Buttons
                buttonsUl.innerHTML = '';
                gamepad.buttons.forEach((button, i) => {
                    const li = document.createElement('li');
                    li.textContent = `Button ${i}: ${button.pressed ? 'Pressed' : 'Released'} (Value: ${button.value.toFixed(2)})`;
                    buttonsUl.appendChild(li);
                });

                // Update Axes
                axesUl.innerHTML = '';
                gamepad.axes.forEach((axis, i) => {
                    const li = document.createElement('li');
                    li.textContent = `Axis ${i}: ${axis.toFixed(4)}`;
                    axesUl.appendChild(li);
                });

            } else {
                gamepadIdSpan.textContent = 'N/A';
                buttonsUl.innerHTML = '';
                axesUl.innerHTML = '';
            }
            controllerStatusDiv.innerHTML = statusText;
        }, 100); // Update every 100ms
    };

    const controllerDebugSVG = `material-symbols stadia_controller`; // Placeholder SVG
    addCustomTab('Controller Debug', debugHTML, controllerDebugSVG, setup);
  }

  async function setupGamepadSettingsTab() {
    const gamepadSettingsHTML = await desktopApi.readFile('tabs/gamepad-settings.html');
    if (!gamepadSettingsHTML) return;

    const setup = async (panel) => {
        // Gamepad settings logic will go here later
    };

    const gamepadSettingsSVG = `material-symbols gamepad_circle_right`;
    addCustomTab('Gamepad Settings', gamepadSettingsHTML, gamepadSettingsSVG, setup);
  }

    const injectDiv = async () => {
              //<p class="chakra-text css-1491zxh">This room is full.</p>
              //chakra-text css-18wqe6v
              //chakra-text.css-ac3ke8
    //Code for room is fuull, adding a text box to join a new room:
    const rfTargetElements = document.querySelectorAll('p.chakra-text.css-1491zxh');

    for (const p of rfTargetElements) {
        // Ensure we've found the correct element by checking its text content.
        if (p.textContent.trim().startsWith('This room is full.')) {
            ipcRenderer.invoke('main-process-function:throwJoinPage')
        }
    }


    //Donut text modification:
    const donutText = document.querySelectorAll('p.chakra-text.css-18wqe6v');

    for (const p of donutText) {
        // Ensure we've found the correct element by checking its text content.
        if (p.textContent.trim().startsWith('To purchase')) {
            p.textContent = "Purchasing donuts is currently not possible in the desktop app, please switch to discord or the IOS app to purchase donuts!";
        }
    }

    //Donut text modification:
    const slimeLovesYouText = document.querySelectorAll('p.chakra-text.css-ac3ke8');

    for (const p of slimeLovesYouText) {
        // Ensure we've found the correct element by checking its text content.
        if (p.textContent.trim().startsWith('Magic Circle')) {
            p.textContent = "Slime loves you!";
        }
    }

    //Added some versioning stuff:
    // Find all <p> tags with the exact classes you specified.
    const targetElements = document.querySelectorAll('p.chakra-text.css-a4hk4l');

    // Function to add CSS link if not already present
    const addCssIfNotPresent = (id, href) => {
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        }
    };

    // Add Font Awesome CSS
    addCssIfNotPresent('fontawesome-css', '../node_modules/@fortawesome/fontawesome-free/css/all.min.css');
    // Add Material Symbols CSS
    addCssIfNotPresent('material-symbols-css', 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

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
function convertMp3ToBase64(mp3File, callback) {
  const reader = new FileReader();

  reader.onload = function(event) {
    // The result will be a Data URL (e.g., "data:audio/mpeg;base64,...")
    const dataUrl = event.target.result;

    // Extract the Base64 string part by removing the "data:audio/mpeg;base64," prefix
    const base64String = dataUrl.split(',')[1];

    callback(base64String);
  };

  reader.onerror = function(error) {
    console.error("Error reading the file:", error);
    callback(null);
  };

  // Read the file as a Data URL
  reader.readAsDataURL(mp3File);
}

    // Add custom tab button
    const tabGrid = document.querySelector('.chakra-tabs__tablist .McGrid.css-1p0663w');
    if (tabGrid) {
        await setupSettingsTab();
        await setupControllerDebugTab();
        await setupGamepadSettingsTab();

        // Add Mods Tab
        const modsHTML = await desktopApi.readFile('tabs/mods.html');
        const modsSVG = `material-symbols build`;
        addCustomTab('Mods', modsHTML, modsSVG, null);

        // Add Credits Tab
        const creditsHTML = await desktopApi.readFile('tabs/credits.html');
        const creditsSVG = `material-symbols description`;
        addCustomTab('Credits', creditsHTML, creditsSVG, null);

        async function repositionAboutTab() {
            if (aboutTabRepositioned) {
                return; // Already repositioned
            }

            const tabGrid = document.querySelector('.chakra-tabs__tablist .McGrid.css-1p0663w');
            const tabPanels = document.querySelector('.chakra-tabs__tab-panels');

            if (!tabGrid || !tabPanels) {
                console.log('[MagicGardenController] Tab grid or panels not found yet, retrying repositionAboutTab...');
                return setTimeout(repositionAboutTab, 500); // Retry after 500ms
            }

            // Find the native "About" tab button by its text content
            let nativeAboutTabButton = null;
            tabGrid.querySelectorAll('.chakra-tabs__tab').forEach(tabButton => {
                if (tabButton.textContent.includes('About')) {
                    nativeAboutTabButton = tabButton;
                }
            });

            if (!nativeAboutTabButton) {
                console.log('[MagicGardenController] Native About tab button not found yet, retrying repositionAboutTab...');
                return setTimeout(repositionAboutTab, 500); // Retry after 500ms
            }

            const nativeAboutTabPanelId = nativeAboutTabButton.getAttribute('aria-controls');
            const nativeAboutTabPanel = document.getElementById(nativeAboutTabPanelId);

            if (!nativeAboutTabPanel) {
                console.log('[MagicGardenController] Native About tab panel not found yet, retrying repositionAboutTab...');
                return setTimeout(repositionAboutTab, 500); // Retry after 500ms
            }

            console.log('[MagicGardenController] Native About tab elements found, repositioning...');

            // Remove the native About tab button
            if (nativeAboutTabButton.parentNode) {
                nativeAboutTabButton.parentNode.removeChild(nativeAboutTabButton);
                console.log('[MagicGardenController] Native About tab button removed.');
            }
            // Do NOT remove the nativeAboutTabPanel

            // Add the custom About tab, linking to the existing native panel, always at the bottom
            addCustomTab('About', null, 'material-symbols info', null, nativeAboutTabPanelId);
            console.log('[MagicGardenController] Custom About tab added, linked to existing panel, at the bottom.');
            aboutTabRepositioned = true; // Set flag to true after successful repositioning
        }
        await repositionAboutTab();

        if (!tabListenerAdded) {
            const tabList = document.querySelector('.chakra-tabs__tablist');
            const tabPanels = document.querySelector('.chakra-tabs__tab-panels');

            tabList.addEventListener('click', async (event) => {
                const clickedTab = event.target.closest('.chakra-tabs__tab');
                if (!clickedTab) return;

                event.stopPropagation(); // Stop the game's original handler

                // Deactivate all tabs
                tabGrid.querySelectorAll('.chakra-tabs__tab').forEach(tab => {
                    tab.setAttribute('aria-selected', 'false');
                    tab.setAttribute('tabindex', '-1');
                });

                // Hide all panels
                tabPanels.querySelectorAll('.chakra-tabs__tab-panel').forEach(panel => {
                    panel.hidden = true;
                });

                // Activate the clicked tab
                clickedTab.setAttribute('aria-selected', 'true');
                clickedTab.setAttribute('tabindex', '0');
                
                // Play audio using HTML Audio element with Base64 data
                try {
                    const audioDataUri = await desktopApi.getAudioBase64('Button_Main_01.mp3');
                    if (audioDataUri) {
                        const audio = new Audio(audioDataUri);
                        audio.volume = currentSfxVolume; // Set the volume
                        audio.play().catch(e => console.error("Error playing audio:", e));
                    }
                } catch (e) {
                    console.error("Error fetching or playing audio:", e);
                }

                // Show the corresponding panel
                const panelId = clickedTab.getAttribute('aria-controls');
                if (panelId) {
                    const panelToShow = document.getElementById(panelId);
                    if (panelToShow) {
                        panelToShow.hidden = false;
                    }
                }
            }, true); // Use capture to ensure our handler runs first

            tabListenerAdded = true;
        }
    }
    };

            // A MutationObserver is the most efficient way to watch for DOM changes.
            const observer = new MutationObserver(async () => {
              // When any change is detected, we run our function to find the element.
              //console.log('[Electron Injector] DOM change detected. Running check...');
              await injectDiv();

              // Check if the tab list is gone. If so, reset the listener flag.
              const tabList = document.querySelector('.chakra-tabs__tablist');
              if (!tabList) {
                tabListenerAdded = false;
                aboutTabRepositioned = false; // Reset aboutTabRepositioned flag
              }
            });

            // Start observing the entire document body for any added or removed nodes.
            observer.observe(document.body, {
              childList: true, // Watch for direct children changes
              subtree: true    // Watch for all descendants
            });

            // Run the check once right after the page loads, in case the element is already present.
            injectDiv();
  // Execute insertToApp in the main process via IPC, as requested

    const updateTitleFromUrl = () => {
    const titlebar = document.querySelector('.titlebar');
    if (titlebar) {
      const url = window.location.href;
      const isBeta = url.includes('preview.magiccircle.gg');
      const roomCodeMatch = url.match(/\/r\/([^?#]*)/);
      let title;
      if (roomCodeMatch) {
        const roomCode = roomCodeMatch[1];
        title = `Magic Garden - ${isBeta ? 'Beta - ' : ''}${roomCode}`;
      } else {
        title = 'Magic Garden';
      }
      titlebar.textContent = title;
      titlebar.style.textAlign = 'center';
    }
  };

  // Initial update
  updateTitleFromUrl();

  ipcRenderer.on('update-title', (event, title) => {
      const titlebar = document.querySelector('.titlebar');
    if (titlebar) {
      const url = window.location.href;
      const isBeta = url.includes('preview.magiccircle.gg');
      const roomCodeMatch = url.match(/\/r\/([^?#]*)/);
      let title;
      if (roomCodeMatch) {
        const roomCode = roomCodeMatch[1];
        title = `Magic Garden - ${isBeta ? 'Beta - ' : ''}${roomCode}`;
      } else {
        title = 'Magic Garden';
      }
      titlebar.textContent = title;
      titlebar.style.textAlign = 'center';
    }
  });

  console.log('DOMContentLoaded event fired! Code has been injected.');
              const tabList = document.querySelector('.chakra-tabs__tablist');
              if (!tabList) {
                tabListenerAdded = false;
                aboutTabRepositioned = false; // Reset aboutTabRepositioned flag
              }