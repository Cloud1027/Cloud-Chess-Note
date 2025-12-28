
import React, { useState, useRef, useEffect } from 'react';
import { Menu, Settings, Edit, BookOpen, Info, FileText, Upload, Download, Cloud, Image as ImageIcon, ChevronDown } from 'lucide-react';

interface HeaderProps {
    title?: string;
    onOpenInfo?: () => void;
    onOpenEdit?: () => void;
    onOpenMemorize?: () => void;
    onOpenSettings?: () => void;
    onOpenImport?: () => void;
    onOpenExport?: () => void;
    onOpenGif?: () => void;
    onOpenCloud?: () => void;
    onTitleChange?: (newTitle: string) => void;
    isMemorizing?: boolean;
}

const Header: React.FC<HeaderProps> = ({
    title,
    onOpenInfo, onOpenEdit, onOpenMemorize, onOpenSettings,
    onOpenImport, onOpenExport, onOpenGif, onOpenCloud,
    onTitleChange,
    isMemorizing
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitleValue, setEditTitleValue] = useState(title || '');
    const menuRef = useRef<HTMLDivElement>(null);
    const fileMenuRef = useRef<HTMLDivElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditTitleValue(title || '');
    }, [title]);

    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
            if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
                setIsFileMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const itemClass = "flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md cursor-pointer transition-colors";
    const activeItemClass = "flex items-center gap-2 px-3 py-2 text-sm font-medium bg-amber-600 text-white rounded-md cursor-pointer transition-colors shadow-lg shadow-amber-900/30";

    const handleMobileClick = (action?: () => void) => {
        if (action) action();
        setIsMenuOpen(false);
    };

    return (
        <header className="w-full bg-zinc-900 border-b border-zinc-800 px-4 h-11 flex items-center justify-between shrink-0 z-50 relative">
            <div className="flex items-center gap-2 z-10">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-600 to-amber-800 rounded-lg flex items-center justify-center font-bold text-white shadow-inner">
                    弈
                </div>
                <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500 hidden xl:block">
                    Cloud Chess Note
                </span>
            </div>

            {/* Center Title - Editable */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex justify-center px-12 md:px-20">
                {isEditingTitle ? (
                    <input
                        ref={titleInputRef}
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onBlur={() => {
                            setIsEditingTitle(false);
                            if (onTitleChange) onTitleChange(editTitleValue);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setIsEditingTitle(false);
                                if (onTitleChange) onTitleChange(editTitleValue);
                            }
                            if (e.key === 'Escape') {
                                setIsEditingTitle(false);
                                setEditTitleValue(title || '');
                            }
                        }}
                        className="bg-zinc-800/50 border-b border-amber-500 text-xl md:text-2xl font-bold text-amber-100 text-center focus:outline-none w-full max-w-[300px]"
                        style={{ fontFamily: '"KaiTi", "STKaiti", "Microsoft JhengHei", serif' }}
                    />
                ) : (
                    <span
                        onClick={() => !isMemorizing && setIsEditingTitle(true)}
                        className={`text-xl md:text-2xl font-bold text-amber-100/90 tracking-widest shadow-black drop-shadow-md truncate max-w-full cursor-pointer hover:text-white transition-colors ${isMemorizing ? 'pointer-events-none opacity-50' : ''}`}
                        style={{ fontFamily: '"KaiTi", "STKaiti", "Microsoft JhengHei", serif' }}
                    >
                        {title || '未命名棋譜'}
                    </span>
                )}
            </div>

            {/* Desktop Menu */}
            <nav className="hidden md:flex items-center gap-1 z-10 bg-zinc-900/80 backdrop-blur-sm rounded-lg">
                {/* File Dropdown */}
                <div className="relative" ref={fileMenuRef}>
                    <button
                        onClick={() => setIsFileMenuOpen(!isFileMenuOpen)}
                        className={itemClass}
                        disabled={isMemorizing}
                    >
                        <FileText size={16} /> 檔案 <ChevronDown size={14} className={`transition-transform ${isFileMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isFileMenuOpen && (
                        <div className="absolute top-full right-0 mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-50 flex flex-col">
                            <button onClick={() => { onOpenImport?.(); setIsFileMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white text-left">
                                <Upload size={14} /> 導入
                            </button>
                            <button onClick={() => { onOpenExport?.(); setIsFileMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white text-left">
                                <Download size={14} /> 導出
                            </button>
                            <button onClick={() => { onOpenGif?.(); setIsFileMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white text-left">
                                <ImageIcon size={14} /> 匯出 GIF
                            </button>
                            <button onClick={() => { onOpenCloud?.(); setIsFileMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white text-left">
                                <Cloud size={14} /> 上傳雲端
                            </button>
                        </div>
                    )}
                </div>

                <button onClick={onOpenInfo} className={itemClass} disabled={isMemorizing}><Info size={16} /> 資訊</button>
                <button onClick={onOpenEdit} className={itemClass} disabled={isMemorizing}><Edit size={16} /> 編輯</button>
                <button
                    onClick={onOpenMemorize}
                    className={isMemorizing ? activeItemClass : itemClass}
                    title={isMemorizing ? "停止背譜" : "開始背譜"}
                >
                    <BookOpen size={16} /> {isMemorizing ? "停止背譜" : "背譜"}
                </button>
                <button onClick={onOpenSettings} className={itemClass}><Settings size={16} /> 設定</button>
            </nav>

            {/* Mobile Menu Icon */}
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 text-zinc-400 hover:text-white active:bg-zinc-800 rounded-lg transition-colors z-10"
            >
                <Menu size={24} />
            </button>

            {/* Mobile Dropdown Menu */}
            {isMenuOpen && (
                <div ref={menuRef} className="absolute top-14 right-2 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-2 flex flex-col gap-1 z-[60] animate-in fade-in slide-in-from-top-2 md:hidden">
                    <div className="px-4 py-1 text-xs font-bold text-zinc-500 uppercase tracking-wider">檔案</div>
                    <button onClick={() => handleMobileClick(onOpenImport)} className="flex items-center gap-3 px-4 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left" disabled={isMemorizing}>
                        <Upload size={18} /> <span>導入棋譜</span>
                    </button>
                    <button onClick={() => handleMobileClick(onOpenExport)} className="flex items-center gap-3 px-4 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left" disabled={isMemorizing}>
                        <Download size={18} /> <span>導出棋譜</span>
                    </button>
                    <button onClick={() => handleMobileClick(onOpenGif)} className="flex items-center gap-3 px-4 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left" disabled={isMemorizing}>
                        <ImageIcon size={18} /> <span>匯出 GIF</span>
                    </button>
                    <button onClick={() => handleMobileClick(onOpenCloud)} className="flex items-center gap-3 px-4 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left" disabled={isMemorizing}>
                        <Cloud size={18} /> <span>上傳雲端</span>
                    </button>

                    <div className="h-px bg-zinc-800 my-1 mx-2"></div>

                    <button onClick={() => handleMobileClick(onOpenInfo)} className="flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left" disabled={isMemorizing}>
                        <Info size={18} /> <span>資訊</span>
                    </button>
                    <button onClick={() => handleMobileClick(onOpenEdit)} className="flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left" disabled={isMemorizing}>
                        <Edit size={18} /> <span>編輯</span>
                    </button>
                    <button onClick={() => handleMobileClick(onOpenMemorize)} className={`flex items-center gap-3 px-4 py-3 transition-colors text-left ${isMemorizing ? 'text-amber-500 bg-amber-900/20' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'}`}>
                        <BookOpen size={18} /> <span>{isMemorizing ? "停止背譜" : "背譜模式"}</span>
                    </button>
                    <div className="h-px bg-zinc-800 my-1 mx-2"></div>
                    <button onClick={() => handleMobileClick(onOpenSettings)} className="flex items-center gap-3 px-4 py-3 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors text-left">
                        <Settings size={18} /> <span>系統設定</span>
                    </button>
                </div>
            )}
        </header>
    );
};

export default Header;
