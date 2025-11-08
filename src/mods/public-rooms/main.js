console.log('[Public Rooms UI] Script loaded.');

desktopApi.addModTab('Public Rooms', mod.tabContent, mod.icon, (panel) => {
    console.log('[Public Rooms UI] Tab created.');

    // --- DOM Elements ---
    const loadingIndicator = panel.querySelector('#loading-indicator');
    const loginContainer = panel.querySelector('#login-container');
    const appContainer = panel.querySelector('#app-container');
    const errorMessage = panel.querySelector('#error-message');

    // Login Form
    const emailInput = panel.querySelector('#email');
    const passwordInput = panel.querySelector('#password');
    const signInButton = panel.querySelector('#sign-in-button');
    const createAccountButton = panel.querySelector('#create-account-button');

    // App View
    const welcomeMessage = panel.querySelector('#welcome-message');
    const signOutButton = panel.querySelector('#sign-out-button');
    const refreshRoomsButton = panel.querySelector('#refresh-rooms-button');
    const roomTagsInput = panel.querySelector('#room-tags');
    const createRoomButton = panel.querySelector('#create-room-button'); // Make Room Public
    const makeNotPublicButton = panel.querySelector('#make-not-public-button'); // Make Room Not Public
    const roomsList = panel.querySelector('#rooms-list');
    const playerCountIntervalSelect = panel.querySelector('#player-count-interval'); // New setting element
    const refreshIntervalSelect = panel.querySelector('#refresh-interval'); // New setting element

    let currentUser = null;
    let currentRoomCode = null; // To store the room code from the game
    let playerCountInterval = null; // For player count updates
    let autoRefreshInterval = null; // For auto-refreshing rooms
    let currentUpdateIntervalMinutes = 1; // Default to 1 minute
    let currentRefreshIntervalSeconds = 15; // Default to 15 seconds

    // --- Player Count Updater ---
    const startPlayerCountUpdater = async () => {
        stopPlayerCountUpdater(); // Clear any existing interval

        // Check if mod is enabled
        const isModEnabled = await ipcRenderer.invoke('settings:get-mod-enabled', 'public-rooms');
        if (!isModEnabled) {
            console.log('[Public Rooms UI] Mod is disabled, not starting player count updater.');
            return;
        }

        if (currentRoomCode.toUpperCase()) {
            console.log(`[Public Rooms UI] Starting player count updater for room: ${currentRoomCode}`);
            // Update immediately and then every 'currentUpdateIntervalMinutes'
            const updateCount = async () => {
                const count = await ipcRenderer.invoke('game:get-player-count'); // IPC call to get player count
                if (count !== null) {
                    console.log(`[Public Rooms UI] Updating player count for ${currentRoomCode}: ${count}`);
                    await ipcRenderer.invoke('firebase:updatePlayerCount', currentRoomCode, count);
                }
            };

            if (currentUpdateIntervalMinutes > 0) {
                updateCount(); // Initial update
                playerCountInterval = setInterval(updateCount, currentUpdateIntervalMinutes * 60 * 1000);
            } else {
                console.log('[Public Rooms UI] Player count updater set to "Never", not starting interval.');
            }
        }
    };

    const stopPlayerCountUpdater = () => {
        if (playerCountInterval) {
            console.log('[Public Rooms UI] Stopping player count updater.');
            clearInterval(playerCountInterval);
            playerCountInterval = null;
        }
    };

    // Refresh the room every 15 secs (by default, change in public rooms settings) if the room stuff exists 
    autoRefreshInterval = setInterval(() => {
        fetchAndRenderRooms();
    }, currentRefreshIntervalSeconds * 1000);

    // --- Helper to fetch and render rooms ---
    const fetchAndRenderRooms = async () => {
        console.log('[Public Rooms UI] Fetching and rendering rooms...');
        try {
            const rooms = await ipcRenderer.invoke('firebase:getRoomsOnce');
            renderRooms(rooms);
            
            currentRoomCode = await ipcRenderer.invoke('game:get-current-room-code');
            if (currentRoomCode.toUpperCase() && rooms && rooms[currentRoomCode.toUpperCase()]) {
                // Room is public
                makeNotPublicButton.classList.remove('hidden');
                createRoomButton.classList.add('hidden');
                startPlayerCountUpdater(); // Start updating player count
            } else {
                // Room is not public
                makeNotPublicButton.classList.add('hidden');
                createRoomButton.classList.remove('hidden');
                stopPlayerCountUpdater(); // Stop updating player count
            }
        } catch (error) {
            console.error('[Public Rooms UI] Error fetching rooms:', error);
            roomsList.innerHTML = '<p>Error loading rooms.</p>';
        }
    };
    // --- Event Listeners for UI ---

    const roomTagInput = document.getElementById('room-tags');
    let capturingInput = false;

    roomTagInput.addEventListener('click', () => {
        capturingInput = true;
        document.addEventListener('keydown', handleKeyDown);
        roomTagInput.focus();
    });

    roomTagInput.addEventListener('blur', () => {
        if (capturingInput) {
            capturingInput = false;
            document.removeEventListener('keydown', handleKeyDown);
        }
    });

    passwordInput.addEventListener('click', () => {
        capturingInput = true;
        document.addEventListener('keydown', handleKeyDown);
        passwordInput.focus(); // Ensure the input element receives focus
    });

    passwordInput.addEventListener('blur', () => {
        if (capturingInput) {
            capturingInput = false;
            document.removeEventListener('keydown', handleKeyDown);
        }
    });

    emailInput.addEventListener('click', () => {
        capturingInput = true;
        document.addEventListener('keydown', handleKeyDown);
        emailInput.focus(); // Ensure the input element receives focus
    });

    emailInput.addEventListener('blur', () => {
        if (capturingInput) {
            capturingInput = false;
            document.removeEventListener('keydown', handleKeyDown);
        }
    });

    function handleKeyDown(event) {
        if (capturingInput) {
            event.stopPropagation(); // Stop the event from propagating to other listeners

        }
    }

    signInButton.addEventListener('click', async () => {
        console.log('[Public Rooms UI] Sign-in button clicked.');
        errorMessage.textContent = '';
        try {
            await ipcRenderer.invoke('firebase:signIn', emailInput.value, passwordInput.value);
            console.log('[Public Rooms UI] Sign-in IPC invoked.');
        } catch (error) {
            console.error('[Public Rooms UI] Sign-in error:', error);
            errorMessage.textContent = error.message;
        }
    });

    createAccountButton.addEventListener('click', async () => {
        console.log('[Public Rooms UI] Create account button clicked.');
        errorMessage.textContent = '';
        try {
            await ipcRenderer.invoke('firebase:createAccount', emailInput.value, passwordInput.value);
        } catch (error) {
            console.error('[Public Rooms UI] Create account error:', error);
            errorMessage.textContent = error.message;
        }
    });

    signOutButton.addEventListener('click', () => {
        console.log('[Public Rooms UI] Sign-out button clicked.');
        ipcRenderer.invoke('firebase:signOut');
        stopPlayerCountUpdater(); // Stop updating on sign out
    });

    refreshRoomsButton.addEventListener('click', fetchAndRenderRooms);

    createRoomButton.addEventListener('click', async () => { // Make Room Public
        console.log('[Public Rooms UI] Make Room Public button clicked.');
        if (!currentUser) {
            console.warn('[Public Rooms UI] Attempted to make room public while not logged in.');
            return alert('You must be logged in to make a room public.');
        }

        currentRoomCode = await ipcRenderer.invoke('game:get-current-room-code');
        if (!currentRoomCode) {
            return alert('Could not determine current room code from game. Please join a room first.');
        }

        const tags = roomTagsInput.value.split(',').map(t => t.trim()).filter(t => t);
        if (tags.length > 3 || tags.some(t => t.length > 12)) {
            return alert("Max 3 tags, 12 characters each.");
        }

        try {
            console.log(`[Public Rooms UI] Invoking makeRoomPublic for '${currentRoomCode}' with tags:`, tags);
            await ipcRenderer.invoke('firebase:makeRoomPublic', currentRoomCode, tags);
            roomTagsInput.value = '';
            console.log('[Public Rooms UI] Room made public IPC invoked and fields cleared.');
            fetchAndRenderRooms(); // Refresh rooms after making one public
        } catch (error) {
            console.error('[Public Rooms UI] Error making room public:', error);
            alert(`Error making room public: ${error.message}`);
        }
    });

    makeNotPublicButton.addEventListener('click', async () => {
        console.log('[Public Rooms UI] Make Room Not Public button clicked.');
        if (!currentUser) {
            console.warn('[Public Rooms UI] Attempted to make room not public while not logged in.');
            return alert('You must be logged in to make a room not public.');
        }

        currentRoomCode = await ipcRenderer.invoke('game:get-current-room-code');
        if (!currentRoomCode) {
            return alert('Could not determine current room code from game.');
        }

        try {
            console.log(`[Public Rooms UI] Invoking makeRoomNotPublic for '${currentRoomCode}'.`);
            await ipcRenderer.invoke('firebase:makeRoomNotPublic', currentRoomCode);
            console.log('[Public Rooms UI] Room made not public IPC invoked.');
            fetchAndRenderRooms(); // Refresh rooms after making one not public
        } catch (error) {
            console.error('[Public Rooms UI] Error making room not public:', error);
            alert(`Error making room not public: ${e.message}`);
        }
    });

    roomsList.addEventListener('click', async (event) => {
        const target = event.target;
        if (target.matches('.delete-room-button')) {
            const roomName = target.dataset.roomName;
            console.log(`[Public Rooms UI] Delete button clicked for room: ${roomName}`);
            if (confirm(`Delete room "${roomName}"?`)) {
                await ipcRenderer.invoke('firebase:deleteRoom', roomName);
                console.log(`[Public Rooms UI] Delete room IPC invoked for: ${roomName}`);
                fetchAndRenderRooms(); // Refresh rooms after deleting one
            }
        }
    });

    // --- IPC Listeners from Main Process ---

    ipcRenderer.on('firebase:authStateChanged', (event, user) => {
        console.log('[Public Rooms UI] Auth state changed received:', user ? user.uid : 'Logged out');
        currentUser = user;
        loadingIndicator.classList.add('hidden');
        if (user) {
            loginContainer.classList.add('hidden');
            appContainer.classList.remove('hidden');
            welcomeMessage.textContent = `Public Rooms - Signed in as: ${user.displayName || user.email}`;
            console.log('[Public Rooms UI] Displaying app container.');
            fetchAndRenderRooms(); // Fetch rooms on login
        } else {
            loginContainer.classList.remove('hidden');
            appContainer.classList.add('hidden');
            console.log('[Public Rooms UI] Displaying login container.');
            stopPlayerCountUpdater(); // Stop updating on logout
        }
    });

    ipcRenderer.on('firebase:rooms-update', (event, rooms) => {
        console.log('[Public Rooms UI] Received rooms update:', rooms);
        renderRooms(rooms); // Render rooms when update is received from main process
    });

    const renderRooms = (rooms) => {
        console.log('[Public Rooms UI] Rendering rooms:', rooms);
        roomsList.innerHTML = '';
        if (!rooms) {
            roomsList.innerHTML = '<p>No rooms yet.</p>';
            console.log('[Public Rooms UI] No rooms received, displaying message.');
            return;
        }

        Object.keys(rooms).forEach(key => {
            const room = rooms[key];
            const playerCountDisplay = room.playerCount !== undefined ? `${room.playerCount}/6` : 'N/A'; // Display player count
            const roomElement = document.createElement('div');
            roomElement.className = 'room-item';
            const tagsHtml = room.tags ? room.tags.map(tag => `<span class="tag-span"><div class="McFlex tag-div"><p class="chakra-text" style="font-weight: var(--chakra-fontWeights-semibold);">${tag}</p></div></span>`).join('') : '';
            
            const deleteButtonHtml = (currentUser && currentUser.uid === room.creatorUid) 
                ? `<button class="btn btn-danger btn-sm delete-room-button" data-room-name="${key}" style="margin-top: 10px;">Delete</button>`
                : '';

            roomElement.innerHTML = `
                <p class="chakra-text css-8bzc9q">${key}</p>
                <p class="chakra-text css-15smlea">By: ${room.creator || 'Anonymous'}</p>
                <p class="chakra-text css-15smlea">Players: ${playerCountDisplay}</p>
                <div class="McFlex tab-div-tags">${tagsHtml}</div>
                <a href="https://magiccircle.gg/r/${key}" class="btn btn-primary" style="margin-top: 10px;">Join</a>
                ${deleteButtonHtml}
            `;
            roomsList.appendChild(roomElement);
        });
        console.log(`[Public Rooms UI] Rendered ${Object.keys(rooms).length} rooms.`);
    };

    // --- Initialization ---
    const initializeModSettings = async () => {
        // Load initial interval setting
        const savedInterval = await ipcRenderer.invoke('settings:get-mod-setting', 'public-rooms', 'playerCountIntervalMinutes');
        const savedRefreshInterval = await ipcRenderer.invoke('settings:get-mod-setting', 'public-rooms', 'refreshIntervalSeconds');
        if (savedInterval !== undefined) {
            currentUpdateIntervalMinutes = parseInt(savedInterval, 10);
            playerCountIntervalSelect.value = currentUpdateIntervalMinutes;
        } else {
            // Save default if not set
            await ipcRenderer.invoke('settings:set-mod-setting', 'public-rooms', 'playerCountIntervalMinutes', currentUpdateIntervalMinutes);
            playerCountIntervalSelect.value = currentUpdateIntervalMinutes;
        }
        if (savedRefreshInterval !== undefined) {
            currentRefreshIntervalSeconds = parseInt(savedRefreshInterval, 10);
            refreshIntervalSelect.value = currentRefreshIntervalSeconds;
        } else {
            // Save default if not set
            await ipcRenderer.invoke('settings:set-mod-setting', 'public-rooms', 'refreshIntervalSeconds', currentRefreshIntervalSeconds);
            refreshIntervalSelect.value = currentRefreshIntervalSeconds;
        }
        console.log(`[Public Rooms UI] Initial player count update interval: ${currentUpdateIntervalMinutes} minutes.`);
        console.log(`[Public Rooms UI] Initial refresh interval: ${currentRefreshIntervalSeconds} seconds.`);
    };

    playerCountIntervalSelect.addEventListener('change', async (event) => {
        const newInterval = parseInt(event.target.value, 10);
        if (!isNaN(newInterval)) {
            currentUpdateIntervalMinutes = newInterval;
            await ipcRenderer.invoke('settings:set-mod-setting', 'public-rooms', 'playerCountIntervalMinutes', newInterval);
            console.log(`[Public Rooms UI] Player count update interval set to: ${newInterval} minutes.`);
            // If currently updating, restart with new interval
            if (playerCountInterval) {
                fetchAndRenderRooms(); // This will stop and restart the updater with the new interval
            }
        }
    });

    refreshIntervalSelect.addEventListener('change', async (event) => {
        const newInterval = parseInt(event.target.value, 10);
        if (!isNaN(newInterval)) {
            currentRefreshIntervalSeconds = newInterval;
            await ipcRenderer.invoke('settings:set-mod-setting', 'public-rooms', 'refreshIntervalSeconds', newInterval);
            console.log(`[Public Rooms UI] Refresh interval set to: ${newInterval} seconds.`);
            // Restart auto-refresh interval
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
            }
            if (currentRefreshIntervalSeconds > 0) {
                autoRefreshInterval = setInterval(() => {
                    fetchAndRenderRooms();
                }, currentRefreshIntervalSeconds * 1000);
            } else {
                console.log('[Public Rooms UI] Auto-refresh set to "Never", not starting interval.');
            }
        }
    });

    // Initial state request (will trigger auth state and then room fetch if logged in)
    console.log('[Public Rooms UI] Requesting initial auth state.');
    ipcRenderer.invoke('firebase:request-initial-data');
    initializeModSettings();
});