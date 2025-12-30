import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, limit } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyArrCjf0xUCqpw4Yo2pm9fefSzNR1twgRM",
    authDomain: "cloud-chess-note.firebaseapp.com",
    projectId: "cloud-chess-note",
    storageBucket: "cloud-chess-note.firebasestorage.app",
    messagingSenderId: "828530605810",
    appId: "1:828530605810:web:f2588aca569fa204865a6b",
    measurementId: "G-QD2HYETHGS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
import { initializeFirestore } from "firebase/firestore";

// Initialize Services
export const auth = getAuth(app);
// Use Long Polling to avoid hanging on restricted networks/environments
export const db = initializeFirestore(app, { experimentalForceLongPolling: true });
export const googleProvider = new GoogleAuthProvider();

// Database Helper Functions

// Convert Firestore Data to App Type (helper)
const convertDoc = (doc: any) => ({ id: doc.id, ...doc.data() });

// --- Save Game ---
export const saveGameToCloud = async (userId: string, gameData: any, isPublic: boolean = false, libraryId?: string) => {
    try {
        const docRef = await addDoc(collection(db, "games"), {
            ...gameData,
            owner_id: userId,
            is_public: isPublic,
            library_id: libraryId || null, // Default to null (Uncategorized)
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        });

        // If saved to a library, increment its game count (Optimistic or standard update)
        if (libraryId) {
            // We lazily update count - can be improved with Transactions/Functions but fine for now
            try {
                const libRef = doc(db, "libraries", libraryId);
                // Ideally this should use increment() but for simplicity just marking update needed
                // Or user will see count update next refresh.
                // Let's do a simple get-set increment for MVP
                const libSnap = await getDoc(libRef);
                if (libSnap.exists()) {
                    const currentCount = libSnap.data().game_count || 0;
                    await updateDoc(libRef, { game_count: currentCount + 1 });
                }
            } catch (e) {
                console.warn("Failed to update library count", e);
            }
        }

        return docRef.id;
    } catch (error) {
        console.error("Error saving game:", error);
        throw error;
    }
};

// --- Update Game ---
// --- Update Game ---
export const updateCloudGame = async (gameId: string, updates: any) => {
    try {
        const gameRef = doc(db, "games", gameId);
        await updateDoc(gameRef, {
            ...updates,
            updated_at: serverTimestamp()
        });
    } catch (error) {
        console.error("Error updating game:", error);
        throw error;
    }
};

// --- Library Management ---

// Create Library
export const createLibrary = async (userId: string, data: { title: string, description: string, is_public: boolean }) => {
    try {
        const docRef = await addDoc(collection(db, "libraries"), {
            ...data,
            owner_id: userId,
            game_count: 0,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error creating library:", error);
        throw error;
    }
};

// Get Public Libraries + My Private Libraries
export const getLibraries = async (isPublicView: boolean, userId?: string) => {
    try {
        const librariesRef = collection(db, "libraries");
        let q;

        if (isPublicView) {
            // Show all public libraries
            q = query(librariesRef, where("is_public", "==", true), orderBy("created_at", "desc"), limit(50));
        } else {
            // Show my libraries (including private ones)
            if (!userId) return [];
            q = query(librariesRef, where("owner_id", "==", userId), orderBy("created_at", "desc"), limit(50));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(convertDoc);
    } catch (error) {
        console.error("Error fetching libraries:", error);
        throw error;
    }
};

// Get Games in a Library
export const getLibraryGames = async (libraryId: string) => {
    try {
        const gamesRef = collection(db, "games");
        const q = query(gamesRef, where("library_id", "==", libraryId), orderBy("created_at", "desc"), limit(100));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(convertDoc);
    } catch (error) {
        console.error("Error fetching library games:", error);
        throw error;
    }
};

// Get Uncategorized Games (Legacy)
export const getUncategorizedGames = async (userId: string, isPublicView: boolean) => {
    try {
        const gamesRef = collection(db, "games");
        let q;
        if (isPublicView) {
            // Public uncategorized? Maybe rare, but possible.
            q = query(gamesRef,
                where("is_public", "==", true),
                where("library_id", "==", null),
                orderBy("created_at", "desc"),
                limit(50)
            );
        } else {
            q = query(gamesRef,
                where("owner_id", "==", userId),
                where("library_id", "==", null),
                orderBy("created_at", "desc"),
                limit(50)
            );
        }
        const snapshot = await getDocs(q);
        return snapshot.docs.map(convertDoc);
    } catch (error) {
        console.error("Error fetching uncategorized games:", error);
        // Fallback: If index is missing for null equality, might fail.
        // For MVP, if it fails, we might just fetch all and filter client side if needed, but let's try strict query.
        throw error;
    }
};


// --- Delete Game ---
export const deleteCloudGame = async (gameId: string) => {
    try {
        await deleteDoc(doc(db, "games", gameId));
    } catch (error) {
        console.error("Error deleting game:", error);
        throw error;
    }
};

// --- Get User's Games ---
export const getUserGames = async (userId: string) => {
    try {
        const q = query(
            collection(db, "games"),
            where("owner_id", "==", userId)
            // orderBy("updated_at", "desc") // Removed to avoid index requirement
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(convertDoc).sort((a: any, b: any) => {
            return (b.updated_at?.seconds || 0) - (a.updated_at?.seconds || 0);
        });
    } catch (error) {
        console.error("Error getting user games:", error);
        throw error;
    }
};

// --- Get Public Games ---
// --- Get Public Games ---
let publicGamesCache: any[] | null = null;
let lastPublicFetch = 0;

export const getPublicGames = async (force: boolean = false) => {
    // 5-minute cache to aggressively steal data and keep it ready
    // Or user wants "refresh" -> force=true
    if (!force && publicGamesCache && Date.now() - lastPublicFetch < 300000) {
        console.log("Returning cached public games");
        return publicGamesCache;
    }

    try {
        const q = query(
            collection(db, "games"),
            where("is_public", "==", true),
            // orderBy("date", "desc"), // COMPOSITE INDEX REQUIRED - Removed to fix crash
            limit(50)
        );
        const querySnapshot = await getDocs(q);
        // Client-side sort to avoid index requirements
        const data = querySnapshot.docs.map(convertDoc).sort((a: any, b: any) => {
            const timeA = a.updated_at?.seconds || a.date?.seconds || 0;
            const timeB = b.updated_at?.seconds || b.date?.seconds || 0;
            return timeB - timeA;
        });
        publicGamesCache = data;
        lastPublicFetch = Date.now();
        return data;
    } catch (error) {
        console.error("Error getting public games:", error);
        throw error;
    }
};

export const prefetchPublicGames = () => {
    // Just trigger the fetch to populate cache
    getPublicGames().catch(err => console.log("Prefetch failed:", err));
};

// --- Get Single Game by ID ---
export const getCloudGameById = async (gameId: string) => {
    try {
        const docRef = doc(db, "games", gameId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return convertDoc(docSnap);
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting game:", error);
        throw error;
    }
};
