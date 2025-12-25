
import { useEffect } from 'react';

interface KeyboardShortcutsProps {
    onPrev?: () => void;
    onNext?: () => void;
    onUp?: () => void;
    onDown?: () => void;
    
    // Tab Switching
    onTabNext?: () => void;
    onTabPrev?: () => void;
}

export const useKeyboardShortcuts = ({ 
    onPrev, 
    onNext,
    onUp,
    onDown,
    onTabNext,
    onTabPrev
}: KeyboardShortcutsProps) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent shortcuts if user is typing in an input or textarea
            const target = e.target as HTMLElement;
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

            // Allow Alt shortcuts even in inputs if needed, but generally safer to block
            if (isInput) return;

            // Tab Switching (Alt + Up/Down)
            if (e.altKey) {
                if (e.key === 'ArrowUp') {
                    if (onTabPrev) {
                        e.preventDefault();
                        onTabPrev();
                    }
                    return;
                }
                if (e.key === 'ArrowDown') {
                    if (onTabNext) {
                        e.preventDefault();
                        onTabNext();
                    }
                    return;
                }
            }

            switch (e.key) {
                case 'ArrowLeft':
                    if (onPrev) {
                        e.preventDefault(); 
                        onPrev();
                    }
                    break;
                case 'ArrowRight':
                    if (onNext) {
                        e.preventDefault();
                        onNext();
                    }
                    break;
                case 'ArrowUp':
                    if (onUp) {
                        e.preventDefault();
                        onUp();
                    }
                    break;
                case 'ArrowDown':
                    if (onDown) {
                        e.preventDefault();
                        onDown();
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onPrev, onNext, onUp, onDown, onTabNext, onTabPrev]);
};
