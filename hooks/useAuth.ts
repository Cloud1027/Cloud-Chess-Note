import { useState, useEffect } from 'react';
import { auth, googleProvider } from '../services/firebase';
import { signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User } from 'firebase/auth';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for redirect result (needed for signInWithRedirect flow)
        getRedirectResult(auth).catch((error) => {
            console.error("Login failed (redirect):", error);
            if (error.code !== 'auth/popup-closed-by-user') {
                alert(`登入失敗: ${error.message}`);
            }
        });

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const login = async () => {
        try {
            await signInWithRedirect(auth, googleProvider);
        } catch (error: any) {
            console.error("Login start failed:", error);
            alert(`啟動登入失敗: ${error.message}`);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    return { user, loading, login, logout };
};
