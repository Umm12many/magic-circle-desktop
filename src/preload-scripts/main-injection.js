// Your injection logic goes here.
  // This code will run every time a new page loads in the BrowserWindow.

  magicCircleDesktopVersion = "Canary0.0.1";
  let tabListenerAdded = false;

  // title: string, htmlContent: string, svgIcon: string, setupFunction: (panel: HTMLElement) => void
  function addCustomTab(title, htmlContent, svgIcon, setupFunction) {
    const tabGrid = document.querySelector('.chakra-tabs__tablist .McGrid.css-1p0663w');
    const tabPanels = document.querySelector('.chakra-tabs__tab-panels');

    if (!tabGrid || !tabPanels) return;

    const tabId = `custom-tab-${title.replace(/\s+/g, '-').toLowerCase()}`;
    const panelId = `custom-panel-${title.replace(/\s+/g, '-').toLowerCase()}`;

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

    if (svgIcon) {
        newTabButton.innerHTML = svgIcon;
    }
    newTabButton.append(title);

    // Create tab panel
    const newTabPanel = document.createElement('div');
    newTabPanel.id = panelId;
    newTabPanel.className = 'chakra-tabs__tab-panel css-1qbr3jw';
    newTabPanel.setAttribute('role', 'tabpanel');
    newTabPanel.hidden = true;
    if (htmlContent) {
        newTabPanel.innerHTML = htmlContent;
    }

    tabGrid.appendChild(newTabButton);
    tabPanels.appendChild(newTabPanel);

    // Run the setup function to add event listeners
    if (setupFunction) {
        setupFunction(newTabPanel);
    }
  }

  async function setupSettingsTab() {
    const settingsHTML = await desktopApi.readFile('settings.html');
    if (!settingsHTML) return;

    const setup = async (panel) => {
        const domainSelect = panel.querySelector('#domain-select');
        const betaCheckbox = panel.querySelector('#beta-checkbox');
        const saveButton = panel.querySelector('#save-button');

        if (!domainSelect || !betaCheckbox || !saveButton) return;

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
            const currentSettings = await desktopApi.settings.getCurrentDomain();
            if (currentSettings) {
                domainSelect.value = currentSettings.domain;
                betaCheckbox.checked = currentSettings.isBeta;
                updateSwitchVisuals(); // Set initial visual state
            }
        } catch (error) {
            console.error('Failed to load initial settings:', error);
        }

        // Add listener for changes
        betaCheckbox.addEventListener('change', updateSwitchVisuals);

        // Handle save button click
        saveButton.addEventListener('click', () => {
            const domain = domainSelect.value;
            const isBeta = betaCheckbox.checked;
            desktopApi.settings.setDomain(domain, isBeta);
        });
    };

    const settingsSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
    addCustomTab('Desktop App Settings', settingsHTML, settingsSVG, setup);
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

    // Add custom tab button
    const tabGrid = document.querySelector('.chakra-tabs__tablist .McGrid.css-1p0663w');
    if (tabGrid) {
        await setupSettingsTab();

        if (!tabListenerAdded) {
            const tabList = document.querySelector('.chakra-tabs__tablist');
            const tabPanels = document.querySelector('.chakra-tabs__tab-panels');

            tabList.addEventListener('click', (event) => {
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
              console.log('[Electron Injector] DOM change detected. Running check...');
              await injectDiv();

              // Check if the tab list is gone. If so, reset the listener flag.
              const tabList = document.querySelector('.chakra-tabs__tablist');
              if (!tabList) {
                tabListenerAdded = false;
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