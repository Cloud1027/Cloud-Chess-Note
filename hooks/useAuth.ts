import { useState, useEffect } from 'react';
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const login = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error: any) {
            console.error("Login failed:", error);
            if (error?.code === 'auth/popup-closed-by-user') {
                return; // User closed it intentionally
            }
            if (error?.code === 'auth/unauthorized-domain') {
                alert("登入失敗：網域未授權。\n請在 Firebase Console -> Authentication -> Settings -> Authorized Domains 中加入 'localhost'。");
            } else if (error?.code === 'auth/configuration-not-found') {
                alert("登入失敗：Google 登入未啟用。\n請在 Firebase Console -> Authentication -> Sign-in method 中開啟 Google 登入。");
            } else {
                alert(`登入失敗: ${error.message}`);
            }
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
