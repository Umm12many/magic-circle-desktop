magicCircleDesktopVersion = process.env.MAGIC_GARDEN_APP_VERSION || '???.???.???';
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

    const existingTab = document.getElementById(tabId);
    if (existingTab) {
        const panelId = existingTab.getAttribute('aria-controls');
        const existingPanel = document.getElementById(panelId);
        if (existingTab.parentNode) {
            existingTab.parentNode.removeChild(existingTab);
        }
        if (existingPanel && existingPanel.parentNode) {
            // Only remove the panel if it's a custom one, not a pre-existing one we're linking to
            if (!existingPanelId) {
                existingPanel.parentNode.removeChild(existingPanel);
            }
        }
    }

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
            iconSpan.textContent = iconHtml.split(' ').pop();
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

  desktopApi.addCustomTab = addCustomTab;

  function addModTab(title, htmlContent, iconHtml, setupFunction, existingPanelId = null) {
    const creditsTab = document.getElementById('custom-tab-credits');
    addCustomTab(title, htmlContent, "material-symbols " + iconHtml, setupFunction, existingPanelId, creditsTab);
  }

  desktopApi.addModTab = addModTab;

  let currentSfxVolume = 1.0; // Global variable to store SFX volume

  async function setupSettingsTab() {
    const settingsHTML = await desktopApi.readFile('tabs/settings.html');
    if (!settingsHTML) return;

    const setup = async (panel) => {
        const domainSelect = panel.querySelector('#domain-select');
        const betaCheckbox = panel.querySelector('#beta-checkbox');
        const disableModsCheckbox = panel.querySelector('#disable-mods-checkbox');
        const sfxVolumeSlider = panel.querySelector('#sfx-volume-slider');
        const saveButton = panel.querySelector('#save-button'); // New
        const saveChangesButton = panel.querySelector('#save-changes-button'); // New

        if (!domainSelect || !betaCheckbox || !disableModsCheckbox || !sfxVolumeSlider || !saveButton || !saveChangesButton) return; // Updated

        const customSelectValue = domainSelect.querySelector('.custom-select-value');
        const customSelectOptions = domainSelect.querySelector('.custom-select-options');

        // Function to close the dropdown
        const closeDropdown = () => {
            customSelectOptions.style.display = 'none';
        };

        // Toggle dropdown visibility
        customSelectValue.addEventListener('click', (event) => {
            event.stopPropagation();
            customSelectOptions.style.display = customSelectOptions.style.display === 'none' ? 'block' : 'none';
        });

        // Handle option selection
        customSelectOptions.addEventListener('click', (event) => {
            if (event.target.classList.contains('custom-select-option')) {
                const value = event.target.getAttribute('data-value');
                customSelectValue.textContent = value;
                domainSelect.value = value;
                closeDropdown();
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            if (!domainSelect.contains(event.target)) {
                closeDropdown();
            }
        });

        function updateSwitchVisuals(checkbox){
            const track = checkbox.nextElementSibling; // The track span
            if (track && track.classList.contains('chakra-switch__track')) {
                const thumb = track.querySelector('.chakra-switch__thumb');
                if (checkbox.checked) {
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
                customSelectValue.textContent = currentSettings.domain;
                domainSelect.value = currentSettings.domain;
                betaCheckbox.checked = currentSettings.isBeta;
                disableModsCheckbox.checked = currentSettings.disableMods;
                currentSfxVolume = currentSettings.sfxVolume !== undefined ? currentSettings.sfxVolume : 1.0; // Update global volume
                sfxVolumeSlider.value = currentSfxVolume; // Set slider value
                updateSwitchVisuals(betaCheckbox);
                updateSwitchVisuals(disableModsCheckbox);
            }
        } catch (error) {
            console.error('Failed to load initial settings:', error);
        }

        // Add listener for changes
        betaCheckbox.addEventListener('change', () => updateSwitchVisuals(betaCheckbox));
        disableModsCheckbox.addEventListener('change', () => updateSwitchVisuals(disableModsCheckbox));

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
            console.log('[MagicGardenDesktop] Settings saved.');
        });

        // Handle Save and Restart button click
        saveButton.addEventListener('click', async () => {
            await saveSettings();
            console.log('[MagicGardenDesktop] Settings saved. Relaunching app...');
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
    const rfTargetElements = document.querySelectorAll('p.css-1491zxh');

    for (const p of rfTargetElements) {
        if (p.textContent.trim().startsWith('This room')) {
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


    const addCssIfNotPresent = (id, href) => {
        if (!document.getElementById(id)) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        }
    };

    const addCssAsStyleTag = (id, css) => {
        if (!document.getElementById(id)) {
            const style = document.createElement('style');
            style.id = id;
            style.textContent = css;
            document.head.appendChild(style);
        }
    };

    // Add Font Awesome CSS
    addCssIfNotPresent('fontawesome-css', '../node_modules/@fortawesome/fontawesome-free/css/all.min.css');
    // Add Material Symbols CSS
    addCssIfNotPresent('material-symbols-css', 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

    addCssAsStyleTag('custom-dropdown-styles', `
    .custom-select-container {
        position: relative;
        width: 100%;
        border-radius: 5px;
    }

    .custom-select-value {
        padding: 10px;
        cursor: pointer;
    }

    .custom-select-options {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        width: 100%;
        z-index: 1;
        background-color: #808080ee;
    backdrop-filter: blur(10px);
    box-shadow: rgba(0, 0, 0, 0.2) 4px 4px 4px 4px;
    }

    .custom-select-option {
        padding: 10px;
        cursor: pointer;
        border-radius: 5px;
    }

    .custom-select-option:hover {
        background-color: rgba(0, 0, 0, 0.1);
    }
    `);

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

        async function setupModsTab() {
          const modsHTML = await desktopApi.readFile('tabs/mods.html');
          const modsSVG = `material-symbols build`;

        const updateSwitchVisuals = (checkbox) => {
            const track = checkbox.nextElementSibling;
            if (track && track.classList.contains('chakra-switch__track')) {
                const thumb = track.querySelector('.chakra-switch__thumb');
                if (checkbox.checked) {
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

          const setup = async (panel) => {
            const modsContainer = panel.querySelector('#mods-container');
            const reloadButton = panel.querySelector('#reload-mods-button');
            if (!modsContainer || !reloadButton) return;

            const mods = await ipcRenderer.invoke('get-mods');

            for (const mod of mods) {
              const isEnabled = await ipcRenderer.invoke('settings:get-mod-enabled', mod.id);

              const modSwitch = document.createElement('div');
              modSwitch.className = 'McFlex css-qd8y53';

              modSwitch.innerHTML = `
                <div class="McFlex css-2sjrf6" style="flex-direction: column; align-items: flex-start;">
                  <p class="chakra-text css-1krxe8n">${mod.name} <span style="font-size: 0.8rem; color: #aaa;">by ${mod.author}</span></p>
                  <p class="chakra-text css-1c6xk0d" style="font-size: 0.9rem;">${mod.description}</p>
                </div>
                <label class="chakra-switch css-ghot30">
                  <input id="${mod.id}-checkbox" class="chakra-switch__input" type="checkbox" ${isEnabled ? 'checked' : ''} style="border: 0px; clip: rect(0px, 0px, 0px, 0px); height: 1px; width: 1px; margin: -1px; padding: 0px; overflow: hidden; white-space: nowrap; position: absolute;">
                  <span aria-hidden="true" class="chakra-switch__track css-1jo4xnw"><span class="chakra-switch__thumb css-1lxj90k"></span></span>
                </label>
              `;

              modsContainer.appendChild(modSwitch);

              const checkbox = modSwitch.querySelector(`#${mod.id}-checkbox`);
              checkbox.checked = isEnabled;
              updateSwitchVisuals(checkbox);

              checkbox.addEventListener('change', (event) => {
                ipcRenderer.invoke('settings:set-mod-enabled', mod.id, event.target.checked);
                updateSwitchVisuals(checkbox);
                reloadButton.style.visibility = 'visible';
              });
            }

            reloadButton.addEventListener('click', () => {
              window.location.reload();
            });
          };

          addCustomTab('Mods', modsHTML, modsSVG, setup);
        }

        await setupModsTab();

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
                console.log('[MagicGardenDesktop] Tab grid or panels not found yet, retrying repositionAboutTab...');
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
                console.log('[MagicGardenDesktop] Native About tab button not found yet, retrying repositionAboutTab...');
                return setTimeout(repositionAboutTab, 500); // Retry after 500ms
            }

            const nativeAboutTabPanelId = nativeAboutTabButton.getAttribute('aria-controls');
            const nativeAboutTabPanel = document.getElementById(nativeAboutTabPanelId);

            if (!nativeAboutTabPanel) {
                console.log('[MagicGardenDesktop] Native About tab panel not found yet, retrying repositionAboutTab...');
                return setTimeout(repositionAboutTab, 500); // Retry after 500ms
            }

            console.log('[MagicGardenDesktop] Native About tab elements found, repositioning...');
            // Remove the native About tab button
            if (nativeAboutTabButton.parentNode) {
                nativeAboutTabButton.parentNode.removeChild(nativeAboutTabButton);
                console.log('[MagicGardenDesktop] Native About tab button removed.');
            }
            // Do NOT remove the nativeAboutTabPanel

            // Add the custom About tab, linking to the existing native panel, always at the bottom
            addCustomTab('About', null, 'material-symbols info', null, nativeAboutTabPanelId);
            console.log('[MagicGardenDesktop] Custom About tab added, linked to existing panel, at the bottom.');
            aboutTabRepositioned = true; // Set flag to true after successful repositioning
        }
        await repositionAboutTab();

        ipcRenderer.invoke('settings:get-mod-settings').then(({ disableMods }) => {
          if (!disableMods) {
            ipcRenderer.invoke('get-mods').then(mods => {
              mods.forEach(async mod => {
                const isEnabled = await ipcRenderer.invoke('settings:get-mod-enabled', mod.id);
                if (isEnabled) {
                  if (mod.tabContent) {
                    // Nothing needed here since we now pass mod.tabContent directly in a mods main javascript file. Though this might get reworked for when we add User Mods.
                  }
                  try {
                    new Function('require', 'ipcRenderer', 'process', 'desktopApi', 'mod', mod.content)(require, ipcRenderer, process, desktopApi, mod);
                    //console.log(`Successfully loaded mod: ${mod.name}`); Removed for less console spam
                  } catch (error) {
                    console.error(`Failed to execute mod: ${mod.name}` , error);
                  }
                }
              });
            }).catch(err => console.error('Failed to get mods via IPC:', err));
          }
        });

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

            const observer = new MutationObserver((mutationsList, observer) => {
                const rfTargetElements = document.querySelectorAll('p.css-1491zxh');

    for (const p of rfTargetElements) {
        if (p.textContent.trim().startsWith('This room')) {
            ipcRenderer.invoke('main-process-function:throwJoinPage')
        }
    }
                for(const mutation of mutationsList) {
                    if (mutation.type === 'childList') {
                        for (const node of mutation.addedNodes) {
                            if ((node.matches && node.matches('.chakra-tabs__tablist')) || (node.querySelector && node.querySelector('.chakra-tabs__tablist'))) {
                                injectDiv();
                                return;
                            }
                        }
                        for (const node of mutation.removedNodes) {
                            if ((node.matches && node.matches('.chakra-tabs__tablist')) || (node.querySelector && node.querySelector('.chakra-tabs__tablist'))) {
                                tabListenerAdded = false;
                                aboutTabRepositioned = false;
                            }
                        }
                    }
                }
            });

            // Start observing the entire document body for any added or removed nodes.
            observer.observe(document.body, {
              childList: true, // Watch for direct children changes
              subtree: true    // Watch for all descendants
            });

            // --- IMMEDIATE MOD LOADING ON DOM CONTENT LOADED ---
            const loadModsImmediately = async () => {
                console.log('[MagicGardenDesktop] Loading mods immediately on DOMContentLoaded...');

                try {
                    const { disableMods } = await ipcRenderer.invoke('settings:get-mod-settings');

                    if (!disableMods) {
                        const mods = await ipcRenderer.invoke('get-mods');
                        console.log('[MagicGardenDesktop] Retrieved mods:', mods.map(m => m.name));

                        for (const mod of mods) {
                            const isEnabled = await ipcRenderer.invoke('settings:get-mod-enabled', mod.id);
                            if (isEnabled) {
                                try {
                                    console.log(`[MagicGardenDesktop] Loading mod: ${mod.name}`);
                                    new Function('require', 'ipcRenderer', 'process', 'desktopApi', 'mod', mod.content)(require, ipcRenderer, process, desktopApi, mod);
                                    console.log(`[MagicGardenDesktop] Successfully loaded mod: ${mod.name}`);
                                } catch (error) {
                                    console.error(`[MagicGardenDesktop] Failed to execute mod: ${mod.name}`, error);
                                }
                            }
                        }
                    } else {
                        console.log('[MagicGardenDesktop] Mods are disabled globally.');
                    }
                } catch (error) {
                    console.error('[MagicGardenDesktop] Error loading mods immediately:', error);
                }
            };

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
  const rfTargetElements = document.querySelectorAll('p.css-1491zxh');

    for (const p of rfTargetElements) {
        if (p.textContent.trim().startsWith('This room')) {
            ipcRenderer.invoke('main-process-function:throwJoinPage')
        }
    }
              const tabList = document.querySelector('.chakra-tabs__tablist');
              if (!tabList) {
                tabListenerAdded = false;
                aboutTabRepositioned = false; // Reset aboutTabRepositioned flag
              }


              loadModsImmediately();