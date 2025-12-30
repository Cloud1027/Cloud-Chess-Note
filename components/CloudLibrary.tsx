import React, { useState, useEffect } from 'react';
import { X, User, LogOut, Cloud, Globe, Lock, Unlock, Trash2, Download, Save, ExternalLink, Share2, ChevronDown, ChevronUp, Folder, Book, Plus, ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
    saveGameToCloud, getUserGames, getPublicGames, updateCloudGame,
    deleteCloudGame,
    createLibrary,
    getLibraries,
    getLibraryGames,
    getUncategorizedGames,
    updateLibrary,
    deleteLibrary
} from '../services/firebase';
import { INITIAL_BOARD_SETUP } from '../constants';
import { MiniBoardPreview } from './MiniBoardPreview';
import { fenToBoard } from '../lib/utils';
// import { moveListToFen } from '../lib/utils'; // Unused
import { GameTab, Library } from '../types';
import LZString from 'lz-string';

// Helper: Remove voluminous boardState for storage
const minimizeNode = (node: any): any => {
    // Destructure to exclude boardState
    const { boardState, ...rest } = node;
    const cleanNode = { ...rest };
    if (cleanNode.children && cleanNode.children.length > 0) {
        cleanNode.children = cleanNode.children.map(minimizeNode);
    }
    return cleanNode;
};

// Helper: Regenerate boardState from FEN on load
const restoreNode = (node: any, parentId: string | null = null): any => {
    // If boardState is missing, regenerate it
    let board = node.boardState;
    if (!board && node.fen) {
        const res = fenToBoard(node.fen);
        board = res.board;
    }

    const restoredNode = {
        ...node,
        boardState: board, // Ensure boardState exists
        parentId: parentId // Ensure parentId is correct
    };

    if (restoredNode.children && restoredNode.children.length > 0) {
        restoredNode.children = restoredNode.children.map((child: any) => restoreNode(child, restoredNode.id));
    }
    return restoredNode;
};

interface CloudLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    currentTab: GameTab;
    defaultTitle?: string; // [NEW] Support for Game Title
    previewFen: string;
    onLoadGame: (gameData: any) => void;
}

const CloudLibrary: React.FC<CloudLibraryProps> = ({ isOpen, onClose, currentTab, defaultTitle, previewFen, onLoadGame }) => {
    const { user, login, logout, loading, loginEmail, registerEmail, resetPassword } = useAuth();
    const [activeTab, setActiveTab] = useState<'my' | 'public'>('my');

    // NEW: View Mode State
    const [viewMode, setViewMode] = useState<'libraries' | 'games'>('libraries');
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [currentLibrary, setCurrentLibrary] = useState<Library | null>(null); // Null = Uncategorized if viewMode=games

    // Form State for creating library
    const [isCreateLibOpen, setIsCreateLibOpen] = useState(false);
    const [newLibTitle, setNewLibTitle] = useState("");
    const [newLibDesc, setNewLibDesc] = useState("");
    const [isNewLibPublic, setIsNewLibPublic] = useState(false);

    // Existing Game State
    const [games, setGames] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [saveTitle, setSaveTitle] = useState(defaultTitle || currentTab.title); // Initialize with defaultTitle
    const [isSavePublic, setIsSavePublic] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [isAuthExpanded, setIsAuthExpanded] = useState(false);

    // Email Auth State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(false);

    const handleEmailLogin = async () => {
        if (!email || !password) return setAuthError("請輸入帳號密碼");
        setIsAuthLoading(true);
        setAuthError(null);
        try {
            await loginEmail(email, password);
        } catch (e: any) {
            let msg = "登入失敗";
            if (e.code === 'auth/invalid-credential') msg = "帳號或密碼錯誤";
            if (e.code === 'auth/invalid-email') msg = "Email 格式錯誤";
            setAuthError(msg);
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleRegister = async () => {
        if (!email || !password) return setAuthError("請輸入帳號密碼");
        if (password.length < 6) return setAuthError("密碼需至少 6 碼");
        setIsAuthLoading(true);
        setAuthError(null);
        try {
            await registerEmail(email, password);
            alert("註冊成功！已自動登入");
        } catch (e: any) {
            let msg = "註冊失敗";
            if (e.code === 'auth/email-already-in-use') msg = "此 Email 已被註冊";
            if (e.code === 'auth/weak-password') msg = "密碼太弱";
            setAuthError(msg);
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) return setAuthError("請先輸入您的 Email");
        setAuthError(null);
        try {
            await resetPassword(email);
            alert(`重設密碼信件已寄送到 ${email}。\n請查收信件並依照指示重設密碼。`);
        } catch (e: any) {
            let msg = "發送失敗";
            if (e.code === 'auth/invalid-email') msg = "Email 格式錯誤";
            if (e.code === 'auth/user-not-found') msg = "查無此用戶";
            setAuthError(msg);
        }
    };

    // Library Management
    const handleCreateLibrary = async () => {
        if (!user || !newLibTitle.trim()) return;
        setIsLoadingData(true);
        try {
            await createLibrary(user.uid, {
                title: newLibTitle,
                description: newLibDesc,
                is_public: isNewLibPublic
            });
            setIsCreateLibOpen(false);
            setNewLibTitle("");
            setNewLibDesc("");
            setIsNewLibPublic(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert("建立棋庫失敗");
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleDeleteLibrary = async (e: React.MouseEvent, libId: string) => {
        e.stopPropagation();
        if (!confirm("確定要刪除此棋庫嗎？(裡面的棋譜可能會變成未分類或遺失)")) return;
        setIsLoadingData(true);
        try {
            await deleteLibrary(libId);
            fetchData();
        } catch (error) {
            console.error(error);
            alert("刪除失敗");
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleToggleLibraryPublic = async (e: React.MouseEvent, lib: Library) => {
        e.stopPropagation();
        setIsLoadingData(true);
        try {
            await updateLibrary(lib.id, { is_public: !lib.is_public });
            fetchData();
        } catch (error) {
            console.error(error);
            alert("更新狀態失敗");
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleEnterLibrary = (lib: Library | null) => {
        setCurrentLibrary(lib);
        setViewMode('games');
    };

    const handleBackToLibraries = () => {
        setCurrentLibrary(null);
        setViewMode('libraries');
    };

    // --- RENDER ---title when modal opens or defaultTitle changes
    useEffect(() => {
        if (isOpen) {
            setSaveTitle(defaultTitle || currentTab.title);
        }
    }, [isOpen, defaultTitle, currentTab.title]);
    const [indexErrorLink, setIndexErrorLink] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Fetch Data on Tab Change or User Change
    const fetchData = async () => {
        setIsLoadingData(true);
        setErrorMessage(null);
        setIndexErrorLink(null);

        try {
            if (viewMode === 'libraries') {
                // Fetch Libraries
                const isPublic = activeTab === 'public';
                const libs = await getLibraries(isPublic, user?.uid);
                // @ts-ignore
                setLibraries(libs);
            } else {
                // Fetch Games
                if (currentLibrary) {
                    const data = await getLibraryGames(currentLibrary.id);
                    setGames(data);
                } else {
                    // Uncategorized
                    const isPublic = activeTab === 'public';
                    // Needed for type safety
                    if (!isPublic && !user) {
                        setGames([]);
                        return;
                    }
                    const data = await getUncategorizedGames(user?.uid || '', isPublic);
                    setGames(data);
                }
            }
        } catch (error: any) {
            console.error("Fetch error:", error);
            // Check for index error
            if (error.message && error.message.includes('requires an index')) {
                setIndexErrorLink(error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0]);
            }
            setErrorMessage(error.message);
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        fetchData();
    }, [isOpen, activeTab, user, viewMode, currentLibrary]);

    // Save Current Game
    const handleSaveGame = async () => {
        if (!user) return;
        if (!saveTitle.trim()) {
            alert("請輸入標題");
            return;
        }

        setIsSaving(true);
        try {
            // Minimize tree to avoid payload limits
            const minimizedRoot = minimizeNode(currentTab.rootNode);
            const jsonString = JSON.stringify(minimizedRoot);

            // Compress using LZString
            const compressed = LZString.compressToUTF16(jsonString);

            const gameData = {
                title: saveTitle || '無標題',
                fen: previewFen,
                root_node: compressed, // Save compressed string
                // Add Metadata if available
                metadata: currentTab.metadata
            };

            await saveGameToCloud(
                user.uid,
                gameData,
                isSavePublic,
                currentLibrary?.id // Pass library ID if selected
            );

            setSaveTitle('');

            // Refresh logic: 
            // If we are in the library we just saved to, refresh games.
            // If we are in libraries view, or another library, technically we should navigate there?
            // For now just refresh data.
            fetchData();

            alert("儲存成功！");
        } catch (error: any) {
            console.error("Save error:", error);
            alert("儲存失敗: " + (error.message || "未知錯誤"));
        } finally {
            setIsSaving(false);
        }
    };

    // Toggle Public/Private
    const handleTogglePublic = async (gameId: string, currentStatus: boolean) => {
        try {
            await updateCloudGame(gameId, { is_public: !currentStatus });
            // Optimistic update
            setGames(prev => prev.map(g => g.id === gameId ? { ...g, is_public: !currentStatus } : g));
        } catch (error) {
            console.error("Update failed:", error);
            alert("更新狀態失敗");
        }
    };

    // Delete Game
    const handleDelete = async (gameId: string) => {
        if (!confirm("確定要刪除此雲端棋譜嗎？此動作無法復原。")) return;
        try {
            await deleteCloudGame(gameId);
            setGames(prev => prev.filter(g => g.id !== gameId));
        } catch (error) {
            console.error("Delete failed:", error);
            alert("刪除失敗");
        }
    };

    // Load Game
    const handleLoad = (game: any) => {
        try {
            // Parse the standardized format
            let loadedRoot;
            if (game.rootNode) {
                let jsonString = game.rootNode;
                // Check if compressed (basic check: not starting with { or [)
                if (typeof jsonString === 'string' && !jsonString.trim().startsWith('{') && !jsonString.trim().startsWith('[')) {
                    const decompressed = LZString.decompressFromUTF16(jsonString);
                    if (decompressed) {
                        jsonString = decompressed;
                    }
                }

                const parsedRoot = JSON.parse(jsonString);

                // [MOBILE OPTIMIZATION] Do NOT hydrate board here.
                // Pass "Lite" data (without boardState arrays) to App.tsx.
                // App.tsx stores this lightweight tree in tabs (LocalStorage).
                // ChessBoard.tsx now supports Lazy Hydration (generates board on-the-fly from FEN).
                // This prevents Mobile Safari QuotaExceededError (5MB limit) and crashes.
                loadedRoot = parsedRoot;

                onLoadGame({
                    rootNode: loadedRoot,
                    metadata: game.metadata || { title: game.title, redName: game.redName, blackName: game.blackName }
                });
            } else {
                // Handle legacy or simple FEN only?
                alert("此格式暫不支援完整讀取 (可能為舊版資料)");
            }
            onClose();
        } catch (e) {
            console.error("Load parse error:", e);
            alert("讀取棋譜發生錯誤");
        }
    };

    console.log("Render CloudLibrary. Games:", games.length);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-zinc-700 w-full max-w-4xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">

                <div className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Cloud className="text-blue-500" />
                            <div className="flex items-center gap-2 font-bold text-lg text-white">
                                <span className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded ml-1">v2.0</span>
                                {viewMode === 'games' ? (
                                    <>
                                        <button onClick={handleBackToLibraries} className="hover:bg-zinc-800 p-1 rounded transition-colors text-zinc-400 hover:text-white">
                                            <ArrowLeft size={20} />
                                        </button>
                                        <span className="text-zinc-500 cursor-pointer hover:text-zinc-300 hidden sm:inline" onClick={handleBackToLibraries}>
                                            {activeTab === 'public' ? '公共棋庫' : '我的棋庫'}
                                        </span>
                                        <span className="text-zinc-600 hidden sm:inline">/</span>
                                        <span>{currentLibrary ? currentLibrary.title : '未分類棋譜'}</span>
                                    </>
                                ) : (
                                    <span>{activeTab === 'public' ? '公共棋庫' : '雲端棋庫'}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex bg-zinc-800 rounded-lg p-1">
                            <button
                                onClick={() => { setActiveTab('my'); setViewMode('libraries'); setCurrentLibrary(null); }}
                                className={`px - 4 py - 1.5 rounded - md text - sm font - medium transition - all ${activeTab === 'my' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'} `}
                            >
                                我的棋譜
                            </button>
                            <button
                                onClick={() => { setActiveTab('public'); setViewMode('libraries'); setCurrentLibrary(null); }}
                                className={`px - 4 py - 1.5 rounded - md text - sm font - medium transition - all ${activeTab === 'public' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-300'} `}
                            >
                                公共棋譜
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Create Library Button (Only in Library View) */}
                        {viewMode === 'libraries' && activeTab === 'my' && (
                            <button
                                onClick={() => setIsCreateLibOpen(true)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-emerald-400 text-sm transition-colors"
                            >
                                <Plus size={16} />
                                <span className="hidden sm:inline">新增棋庫</span>
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setIsLoadingData(true);
                                fetchData();
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors text-sm"
                            title="從伺服器取得最新資料"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

                    {/* Sidebar / User Profile */}
                    <div className="w-full md:w-64 bg-zinc-950 border-b md:border-b-0 md:border-r border-zinc-800 p-3 md:p-4 flex flex-row md:flex-col gap-4 md:gap-6 shrink-0 items-center md:items-stretch justify-between md:justify-start overflow-x-auto scrollbar-hide">
                        {/* Auth Status */}
                        {loading ? (
                            <div className="text-zinc-500 text-center text-sm">...</div>
                        ) : user ? (
                            <div className="flex flex-row md:flex-col items-center gap-3">
                                <div className="flex items-center md:flex-col gap-2 md:mb-2">
                                    {user.photoURL ? (
                                        <img
                                            src={user.photoURL}
                                            alt="Avatar"
                                            className="w-8 h-8 md:w-16 md:h-16 rounded-full border-2 border-green-500/30"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 md:w-16 md:h-16 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500">
                                            <User size={16} className="md:w-8 md:h-8" />
                                        </div>
                                    )}
                                    <div className="text-left md:text-center">
                                        <div className="text-sm font-bold text-white leading-none md:mb-0.5">{user.displayName}</div>
                                        <div className="text-[10px] md:text-xs text-zinc-500 truncate max-w-[8rem] md:max-w-[10rem] hidden sm:block">{user.email}</div>
                                    </div>
                                </div>
                                <button onClick={logout} className="p-2 md:w-full md:py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                                    <LogOut size={16} /> <span className="hidden md:inline">登出</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 w-full">
                                <button
                                    onClick={() => setIsAuthExpanded(!isAuthExpanded)}
                                    className="md:hidden w-full flex items-center justify-between px-3 py-2 bg-zinc-800 rounded-lg text-sm text-zinc-300 hover:text-white transition-colors"
                                >
                                    <span className="font-bold text-blue-400">✨ 登入以解鎖功能</span>
                                    {isAuthExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>

                                <div className={`${isAuthExpanded ? 'flex' : 'hidden'} md:flex flex - col gap - 3 w - full animate -in fade -in slide -in -from - top - 2 duration - 300`}>
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="text"
                                            placeholder="Email (例如: user@gmail.com)"
                                            className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder-zinc-600"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                        />
                                        <input
                                            type="password"
                                            placeholder="密碼 (至少6位)"
                                            className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder-zinc-600"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex justify-end -mt-1">
                                        <button
                                            onClick={handleForgotPassword}
                                            className="text-xs text-zinc-400 hover:text-white underline decoration-zinc-600 cursor-pointer"
                                        >
                                            忘記密碼？
                                        </button>
                                    </div>

                                    {authError && <div className="text-red-400 text-xs text-center">{authError}</div>}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleEmailLogin}
                                            disabled={isAuthLoading}
                                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-sm font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            {isAuthLoading ? '...' : '登入'}
                                        </button>
                                        <button
                                            onClick={handleRegister}
                                            disabled={isAuthLoading}
                                            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded text-sm border border-zinc-700 disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            註冊帳號
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 text-center mt-1">
                                        * 僅需 Email 格式即可，無需真實信箱驗證
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="hidden md:block border-t border-zinc-800 my-2" />

                        {/* Navigation Tabs */}
                        <div className="flex flex-row md:flex-col gap-1">
                            <button
                                onClick={() => setActiveTab('my')}
                                disabled={!user}
                                className={`flex items - center gap - 2 md: gap - 3 px - 3 md: px - 4 py - 2 md: py - 3 rounded - lg md: rounded - xl text - xs md: text - sm font - medium transition - all whitespace - nowrap ${activeTab === 'my' && user ? 'bg-zinc-800 text-white shadow-inner' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed'} `}
                            >
                                <Lock size={14} className="md:w-[18px] md:h-[18px]" /> <span>我的<span className="hidden md:inline">棋譜</span></span>
                            </button>
                            <button
                                onClick={() => setActiveTab('public')}
                                className={`flex items - center gap - 2 md: gap - 3 px - 3 md: px - 4 py - 2 md: py - 3 rounded - lg md: rounded - xl text - xs md: text - sm font - medium transition - all whitespace - nowrap ${activeTab === 'public' ? 'bg-zinc-800 text-white shadow-inner' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'} `}
                            >
                                <Globe size={14} className="md:w-[18px] md:h-[18px]" /> <span>公共<span className="hidden md:inline">棋譜</span></span>
                            </button>
                        </div>
                    </div>

                    {/* Right Panel: Game List */}
                    <div className="flex-1 flex flex-col bg-zinc-900 relative min-h-0">

                        {/* Save Action Area - Always Visible */}
                        <div className="flex flex-col border-b border-zinc-800 bg-zinc-900/50 backdrop-blur z-10">
                            {user ? (
                                <>
                                    <div className="p-4 flex gap-2 items-center">
                                        <span className="text-sm font-bold text-zinc-400 whitespace-nowrap hidden sm:block">
                                            {activeTab === 'my' ? "儲存到我的棋譜：" : "發布到公共棋譜："}
                                        </span>
                                        <input
                                            type="text"
                                            value={saveTitle}
                                            onChange={(e) => setSaveTitle(e.target.value)}
                                            placeholder="輸入棋譜標題..."
                                            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                        />
                                        <button
                                            onClick={handleSaveGame}
                                            disabled={isSaving}
                                            className={`px - 4 py - 2 text - white text - sm font - bold rounded - lg flex items - center gap - 2 shadow - lg disabled: opacity - 50 disabled: cursor - not - allowed ${activeTab === 'public' || isSavePublic ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' : 'bg-green-600 hover:bg-green-500 shadow-green-900/20'} `}
                                        >
                                            {isSaving ? "處理中..." : (
                                                <>
                                                    {activeTab === 'public' || isSavePublic ? <Globe size={16} /> : <Save size={16} />}
                                                    <span className="hidden sm:inline">{activeTab === 'public' ? "發布" : "儲存"}</span>
                                                    <span className="sm:hidden">存</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    {/* Checkbox only for My Games tab to allow optional public publish */}
                                    {activeTab === 'my' && (
                                        <div className="px-4 pb-2 flex items-center gap-2">
                                            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer hover:text-zinc-200">
                                                <input
                                                    type="checkbox"
                                                    checked={isSavePublic}
                                                    onChange={(e) => setIsSavePublic(e.target.checked)}
                                                    className="rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500"
                                                />
                                                同時發布到公共棋譜
                                            </label>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-4 flex items-center justify-center bg-zinc-900/80">
                                    <span className="text-sm text-zinc-500">
                                        請先從左側登入，即可{activeTab === 'public' ? "發布棋譜到公共區域" : "儲存私人棋譜"}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {isLoadingData ? (
                                <div className="h-full flex items-center justify-center text-zinc-500 flex-col gap-2">
                                    <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                                    <p className="text-sm">資料讀取中...</p>
                                </div>
                            ) : indexErrorLink ? (
                                <div className="h-full flex items-center justify-center flex-col gap-4 p-8 text-center">
                                    <div className="p-4 rounded-full bg-red-900/20 text-red-500">
                                        <ExternalLink size={48} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">需要建立資料庫索引</h3>
                                    <p className="text-zinc-400 max-w-md bg-black/30 p-4 rounded-lg text-sm mb-4 border border-zinc-800">
                                        這是 Firebase 資料庫的初次設定要求，只需執行一次。<br />
                                        請點擊下方按鈕，它將開啟 Firebase 控制台並自動為您建立所需的索引。
                                    </p>
                                    <a
                                        href={indexErrorLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20 animate-pulse"
                                    >
                                        <ExternalLink size={20} />
                                        立即建立索引 (開啟新視窗)
                                    </a>
                                    <p className="text-xs text-zinc-500 mt-4">
                                        建立過程可能需要 2~5 分鐘。<br />
                                        建立完成後，請 <button onClick={() => window.location.reload()} className="text-blue-400 underline hover:text-blue-300">重新整理此頁面</button>。
                                    </p>
                                </div>
                            ) : errorMessage ? (
                                <div className="h-full flex items-center justify-center text-red-400 flex-col gap-4 p-8 text-center">
                                    <div className="p-3 bg-red-900/20 rounded-full">
                                        <ExternalLink size={32} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold mb-2">發生錯誤</h3>
                                        <p className="text-sm text-zinc-400 bg-black/50 p-4 rounded border border-zinc-800 break-all select-all">
                                            {errorMessage}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm"
                                    >
                                        重新整理
                                    </button>
                                </div>
                            ) : viewMode === 'libraries' ? (
                                // --- LIBRARY VIEW ---
                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
                                    {/* Uncategorized Folder (Fixed) */}
                                    <div
                                        onClick={() => handleEnterLibrary(null)}
                                        className="group bg-zinc-950 border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-900 rounded-xl p-4 cursor-pointer transition-all flex flex-col gap-3 min-h-[8rem]"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="p-3 bg-zinc-900 rounded-lg group-hover:bg-blue-900/20 group-hover:text-blue-400 transition-colors text-zinc-500">
                                                <Folder size={24} />
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-zinc-200 group-hover:text-blue-400 transition-colors">未分類棋譜</h3>
                                            <p className="text-xs text-zinc-500">所有未歸類到棋庫的棋譜</p>
                                        </div>
                                    </div>

                                    {/* Library Cards */}
                                    {libraries.map(lib => (
                                        <div
                                            key={lib.id}
                                            onClick={() => handleEnterLibrary(lib)}
                                            className="group bg-zinc-950 border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-900 rounded-xl p-4 cursor-pointer transition-all flex flex-col gap-3 min-h-[8rem]"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="p-3 bg-zinc-900 rounded-lg group-hover:bg-blue-900/20 group-hover:text-blue-400 transition-colors text-zinc-500">
                                                    <Book size={24} />
                                                </div>
                                                {activeTab === 'my' && (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={(e) => handleToggleLibraryPublic(e, lib)}
                                                            className={`p - 1.5 rounded - lg transition - colors ${lib.is_public ? 'text-blue-500 hover:bg-blue-900/30' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800'} `}
                                                            title={lib.is_public ? "已公開 (點擊改為私人)" : "私人 (點擊改為公開)"}
                                                        >
                                                            {lib.is_public ? <Globe size={16} /> : <Lock size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeleteLibrary(e, lib.id)}
                                                            className="p-1.5 hover:bg-red-900/30 text-zinc-600 hover:text-red-500 rounded-lg transition-colors"
                                                            title="刪除棋庫"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-zinc-200 group-hover:text-blue-400 transition-colors line-clamp-1">{lib.title}</h3>
                                                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                                                    <span>{lib.game_count || 0} 局</span>
                                                    <span>•</span>
                                                    {activeTab === 'public' ? (
                                                        <span>{lib.owner_id}</span>
                                                    ) : (
                                                        <span className={lib.is_public ? "text-blue-500" : "text-zinc-600"}>
                                                            {lib.is_public ? "公開" : "私人"}
                                                        </span>
                                                    )}
                                                </div>
                                                {lib.description && (
                                                    <p className="text-xs text-zinc-600 mt-2 line-clamp-2">{lib.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Empty State for Libraries */}
                                    {libraries.length === 0 && (
                                        <div className="col-span-full py-8 text-center text-zinc-600 text-sm">
                                            尚無自訂棋庫，您可以點擊上方「新增棋庫」來建立。
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // --- GAMES VIEW ---
                                games.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-zinc-600 flex-col gap-4">
                                        <div className="p-4 rounded-full bg-zinc-800/50">
                                            <Cloud size={48} className="opacity-20" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-zinc-400">目前沒有棋譜資料</p>
                                            <p className="text-sm text-zinc-600 mt-2">請按右上角重新整理</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {games.map((game) => {
                                            const isOwner = user && game.owner_id === user.uid;
                                            return (
                                                <div key={game.id} className="group bg-zinc-950 border border-zinc-800 hover:border-zinc-600 rounded-xl p-3 transition-all hover:shadow-lg flex gap-4">
                                                    {/* Left: Mini Board Preview */}
                                                    <div className="w-24 h-28 md:w-32 md:h-36 shrink-0 bg-[#f2e1c2] rounded-lg overflow-hidden border border-zinc-800 shadow-inner relative group-hover:scale-105 transition-transform origin-left cursor-pointer" onClick={() => handleLoad(game)}>
                                                        <MiniBoardPreview fen={game.fen || "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1"} />
                                                        {/* Hover Overlay */}
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                            <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                                                                點擊載入
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right: Info & Actions */}
                                                    <div className="flex-1 flex flex-col justify-between py-1">
                                                        <div>
                                                            <div className="flex justify-between items-start">
                                                                <h3 className="font-bold text-zinc-200 text-lg group-hover:text-blue-400 transition-colors cursor-pointer line-clamp-1" onClick={() => handleLoad(game)}>{game.title || "無標題"}</h3>
                                                                {isOwner ? (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleTogglePublic(game.id, game.is_public); }}
                                                                        className={`p - 1.5 rounded - lg shrink - 0 cursor - pointer transition - colors ${game.is_public ? 'bg-blue-900/20 text-blue-500 hover:bg-blue-900/40' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'} `}
                                                                        title={game.is_public ? "已公開 (點擊改為私人)" : "僅限私人 (點擊改為公開)"}
                                                                    >
                                                                        {game.is_public ? <Globe size={16} /> : <Lock size={16} />}
                                                                    </button>
                                                                ) : (
                                                                    <div className={`p - 1.5 rounded - lg shrink - 0 ${game.is_public ? 'bg-blue-900/20 text-blue-500' : 'bg-zinc-800 text-zinc-500'} `} title={game.is_public ? "公開狀態" : "私人狀態"}>
                                                                        {game.is_public ? <Globe size={16} /> : <Lock size={16} />}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="hidden md:flex flex-col gap-1 mt-2">
                                                                <div className="text-xs text-zinc-500 flex items-center gap-1.5">
                                                                    <User size={12} />
                                                                    <span className="truncate max-w-[12rem]">{isOwner ? "我自己" : `使用者 ${game.owner_id.slice(0, 6)}...`}</span>
                                                                </div>
                                                                <div className="text-xs text-zinc-600 font-mono">
                                                                    {new Date(game.updated_at?.seconds * 1000).toLocaleString()}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="flex items-center justify-end gap-2 mt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => {
                                                                    const url = `${window.location.origin} /s/${game.id} `;
                                                                    navigator.clipboard.writeText(url).then(() => alert("連結已複製到剪貼簿！"));
                                                                }}
                                                                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 rounded-lg flex items-center gap-1 transition-colors"
                                                                title="複製分享連結"
                                                            >
                                                                <Share2 size={16} />
                                                            </button>

                                                            {/* Start Analysis / Load */}
                                                            <button
                                                                onClick={() => handleLoad(game)}
                                                                className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg flex items-center gap-1 transition-colors"
                                                                title="載入棋譜"
                                                            >
                                                                <Download size={16} />
                                                            </button>

                                                            {/* Owner Actions (Show if activeTab is 'my' OR if user owns this public game) */}
                                                            {(activeTab === 'my' || isOwner) && (
                                                                <>
                                                                    <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                                                                    <button
                                                                        onClick={() => handleTogglePublic(game.id, game.is_public)}
                                                                        className={`p - 1.5 rounded - lg transition - colors ${game.is_public ? 'hover:bg-blue-900/30 text-blue-500' : 'hover:bg-zinc-800 text-zinc-500'} `}
                                                                        title={game.is_public ? "設為私人" : "設為公開"}
                                                                    >
                                                                        {game.is_public ? <Unlock size={16} /> : <Lock size={16} />}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(game.id)}
                                                                        className="p-1.5 hover:bg-red-900/30 text-zinc-600 hover:text-red-500 rounded-lg transition-colors"
                                                                        title="刪除"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Library Modal */}
            {isCreateLibOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-700 w-full max-w-md rounded-xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white">建立新棋庫</h3>
                            <button onClick={() => setIsCreateLibOpen(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">棋庫名稱</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={newLibTitle}
                                    onChange={e => setNewLibTitle(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    placeholder="例如：基本殺法"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-zinc-400 mb-1">簡介 (選填)</label>
                                <textarea
                                    value={newLibDesc}
                                    onChange={e => setNewLibDesc(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 h-24 resize-none"
                                    placeholder="請輸入關於此棋庫的描述..."
                                />
                            </div>
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setIsNewLibPublic(!isNewLibPublic)}>
                                <div className={`w - 5 h - 5 rounded border flex items - center justify - center transition - colors ${isNewLibPublic ? 'bg-blue-600 border-blue-600' : 'border-zinc-600 bg-zinc-950/50'} `}>
                                    {isNewLibPublic && <Check size={14} className="text-white" />}
                                </div>
                                <span className="text-sm text-zinc-300 select-none">
                                    設為公開 (所有人可以在「公共棋庫」看到)
                                </span>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsCreateLibOpen(false)} className="px-4 py-2 text-zinc-400 hover:text-white text-sm">取消</button>
                                <button onClick={handleCreateLibrary} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold">建立</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default CloudLibrary;
