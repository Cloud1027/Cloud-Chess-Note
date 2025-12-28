import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for syncing state with localStorage.
 * Handles serialization/deserialization of JSON data.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
    // Initialize state from localStorage or use initial value
    const [storedValue, setStoredValue] = useState<T>(() => {
        if (typeof window === 'undefined') return initialValue;
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
            return initialValue;
        }
    });

    // Sync to localStorage whenever value changes
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(key, JSON.stringify(storedValue));
        } catch (error) {
            console.warn(`Error writing to localStorage key "${key}":`, error);
        }
    }, [key, storedValue]);

    // Setter that handles both direct values and updater functions
    const setValue = useCallback((value: T | ((val: T) => T)) => {
        setStoredValue(prev => {
            const valueToStore = value instanceof Function ? value(prev) : value;
            return valueToStore;
        });
    }, []);

    return [storedValue, setValue];
}
