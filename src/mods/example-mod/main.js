desktopApi.addModTab('Example Mod Settings', mod.tabContent, mod.icon, (panel) => {
  const checkbox = panel.querySelector('#example-mod-awesome-feature-checkbox');

  const updateVisuals = () => {
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

  ipcRenderer.invoke('settings:get-mod-enabled', 'example-mod-awesome-feature').then(isEnabled => {
    console.log('Example Mod Awesome Feature enabled state:', isEnabled);
    checkbox.checked = isEnabled;
    updateVisuals();
  });

  checkbox.addEventListener('change', () => {
    ipcRenderer.invoke('settings:set-mod-enabled', 'example-mod-awesome-feature', checkbox.checked);
    updateVisuals();
  });
});