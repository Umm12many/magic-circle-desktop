

const MOD_ID = 'css-mod';

// Function to inject CSS into the document via main process IPC
const injectCssViaIpc = async (cssContent) => {
  console.log(`[${MOD_ID}] Requesting CSS injection via IPC.`);
  await ipcRenderer.invoke('mod:inject-css', cssContent);
};

// NOTE: Electron's webContents.insertCSS() is additive and does not provide a direct way
// to remove specific CSS injected this way. To remove CSS, a page reload is typically required,
// or the CSS would need to be managed differently (e.g., by injecting/removing <style> tags directly in the renderer).
// For now, the 'removeCss' functionality is disabled when using IPC injection.

// Main function to set up the mod
const setupCssMod = async () => {
  console.log(`[${MOD_ID}] setupCssMod started.`);
  // Get the list of CSS files in the styles directory
  const cssFiles = await ipcRenderer.invoke('get-mod-files', MOD_ID, 'styles');
  console.log(`[${MOD_ID}] Retrieved CSS files:`, cssFiles);

  // Add the mod tab, passing mod.tabContent directly
  const creditsTab = document.getElementById('custom-tab-credits');
  desktopApi.addModTab('CSS Mod Settings', mod.tabContent, mod.icon, (panel) => {
    console.log(`[${MOD_ID}] Mod tab setup function executed.`);
    const modsContainer = panel.querySelector('#mods-container');
    const switchTemplate = panel.querySelector('#css-mod-switch-template');
    if (!modsContainer || !switchTemplate) {
      console.error(`[${MOD_ID}] modsContainer or switchTemplate not found.`);
      return;
    }

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

    for (const file of cssFiles) {
      const settingId = `${MOD_ID}-${file.replace('.css', '')}`;
      const styleId = `${MOD_ID}-style-${file.replace('.css', '')}`;
      console.log(`[${MOD_ID}] Processing file: ${file}, settingId: ${settingId}, styleId: ${styleId}`);

      const modSwitch = switchTemplate.content.cloneNode(true).firstElementChild;
      modSwitch.querySelector('[data-css-file-name]').textContent = file;
      const checkbox = modSwitch.querySelector('input[type="checkbox"]');
      checkbox.id = `${settingId}-checkbox`;

      modsContainer.appendChild(modSwitch);

      // Load initial state
      ipcRenderer.invoke('settings:get-mod-enabled', settingId).then(async (isEnabled) => {
        console.log(`[${MOD_ID}] Initial state for ${file}: isEnabled = ${isEnabled}`);
        checkbox.checked = isEnabled;
        updateSwitchVisuals(checkbox);
      });

      // Handle toggle change
      checkbox.addEventListener('change', async () => {
        const isEnabled = checkbox.checked;
        console.log(`[${MOD_ID}] Toggle changed for ${file}: isEnabled = ${isEnabled}`);
        ipcRenderer.invoke('settings:set-mod-enabled', settingId, isEnabled);
        updateSwitchVisuals(checkbox);
        // Inform user that a reload is required for changes to take effect.
        console.log(`[${MOD_ID}] Setting for ${file} changed. Reload the page for it to take effect.`);
      });
    }
  });

  // On load, apply all enabled styles (this part is still needed for initial page load)
  console.log(`[${MOD_ID}] Applying initial enabled styles on page load.`);
  for (const file of cssFiles) {
    const settingId = `${MOD_ID}-${file.replace('.css', '')}`;
    ipcRenderer.invoke('settings:get-mod-enabled', settingId).then(async (isEnabled) => {
      if (isEnabled) {
        console.log(`[${MOD_ID}] Initial page load: ${file} is enabled.`);
        const cssContent = await ipcRenderer.invoke('get-mod-file-content', MOD_ID, `styles/${file}`);
        if (cssContent) {
          injectCssViaIpc(cssContent);
        } else {
          console.error(`[${MOD_ID}] Failed to get CSS content for ${file} during initial page load.`);
        }
      }
    });
  }
};

setupCssMod();