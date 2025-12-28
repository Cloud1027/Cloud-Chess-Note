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
export const saveGameToCloud = async (userId: string, gameData: any, isPublic: boolean = false) => {
    try {
        const docRef = await addDoc(collection(db, "games"), {
            ...gameData,
            owner_id: userId,
            is_public: isPublic,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving game:", error);
        throw error;
    }
};

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
