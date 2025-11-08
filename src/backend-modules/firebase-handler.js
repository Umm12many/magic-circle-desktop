const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, GithubAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence } = require('firebase/auth');
const { getDatabase, ref, onValue, set, remove, update, orderByChild, equalTo, get, child } = require('firebase/database');

console.log('[Firebase Handler] Module loaded.');

const firebaseConfig = require('./firebase-credentials.json');

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
const database = getDatabase(app);

console.log('[Firebase Handler] Firebase App Initialized.');
auth.currentUser && console.log(`[Firebase Handler] Current user: ${auth.currentUser.email}`);

// Auth functions
const fns = {
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    createAccount: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    signOut: () => signOut(auth),
    signInWithGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signInWithGitHub: () => signInWithPopup(auth, new GithubAuthProvider()),
    onAuthStateChanged: (callback) => onAuthStateChanged(auth, callback),

    // Database functions
    createRoom: (roomName, tags, user) => {
        return set(ref(database, 'rooms/' + roomName.toUpperCase()), {
            originalRoomName: roomName,
            creator: (user.displayName || user.email).toUpperCase(),
            creatorUid: user.uid,
            tags: tags
        });
    },
    deleteRoom: (roomName) => remove(ref(database, 'rooms/' + roomName.toUpperCase())),
    makeRoomPublic: (roomCode, tags, user) => {
        return set(ref(database, 'rooms/' + roomCode.toUpperCase()), {
            originalRoomName: roomCode,
            creator: (user.displayName || user.email),
            creatorUid: user.uid,
            tags: tags
        });
    },
    makeRoomNotPublic: (roomCode) => remove(ref(database, 'rooms/' + roomCode.toUpperCase())),
    updatePlayerCount: (roomCode, count) => {
        return update(ref(database, 'rooms/' + roomCode.toUpperCase()), { playerCount: count });
    },
    getRoomsOnce: async () => {
        const dbRef = ref(getDatabase(app));
        try {
            const snapshot = await get(child(dbRef, `rooms/`));
            if (snapshot.exists()) {
                //console.log("[Firebase Handler] Rooms data fetched:", snapshot.val());
                return snapshot.val();
            } else {
                console.log("[Firebase Handler] No rooms data available.");
                return null;
            }
        } catch (error) {
            console.error("[Firebase Handler] Error fetching rooms:", error);
            throw error;
        }
    },
    updateCreatorName: async (uid, newDisplayName) => {
        const roomsRef = ref(database, 'rooms');
        // Note: 'once' is not available, so this function might need re-evaluation if it's critical.
        // For now, it's left as is, but be aware it might fail if 'once' is truly unavailable.
        // If 'once' is not available, a workaround would be to fetch all rooms and filter in memory.
        const snapshot = await get(query(roomsRef, orderByChild('creatorUid'), equalTo(uid)));
        const updates = {};
        snapshot.forEach(childSnapshot => {
            updates[`${childSnapshot.key}/creator`] = newDisplayName;
        });
        return update(roomsRef, updates);
    }
};

module.exports = { ...fns, auth };
