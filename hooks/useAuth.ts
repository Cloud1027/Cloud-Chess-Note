import { useState, useEffect } from 'react';
import { auth, googleProvider } from '../services/firebase';
import {
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
    User,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from 'firebase/auth';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Handle Redirect Result (for Google Login)
        getRedirectResult(auth).then((result) => {
            if (result?.user) {
                console.log("Redirect login success:", result.user.email);
            }
        }).catch((error) => {
            console.error("Login failed (redirect):", error);
            if (error.code !== 'auth/popup-closed-by-user') {
                // alert(`登入失敗 (Redirect): ${error.message}`);
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
            console.log("Starting redirect login...");
            await signInWithRedirect(auth, googleProvider);
        } catch (error: any) {
            console.error("Login start failed:", error);
            alert(`啟動登入失敗: ${error.message}`);
        }
    };

    const loginEmail = async (email: string, password: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            console.error("Email login failed:", error);
            throw error;
        }
    };

    const registerEmail = async (email: string, password: string) => {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            console.error("Registration failed:", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    return { user, loading, login, loginEmail, registerEmail, logout };
};
