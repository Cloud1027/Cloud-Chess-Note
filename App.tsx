
import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ChessBoard from './components/ChessBoard';
import ControlBar from './components/ControlBar';
import MoveListPanel from './components/MoveListPanel';
import CloudPanel from './components/CloudPanel';
import MainLayout from './components/MainLayout';
import AnalysisModal from './components/AnalysisModal';
import InfoModal from './components/InfoModal';
import BoardEditorModal from './components/BoardEditorModal';
import SettingsModal from './components/SettingsModal';
import ImportModal from './components/ImportModal';
import ExportModal from './components/ExportModal';
import GifExportModal from './components/GifExportModal';
import TabManager from './components/TabManager';
import MobileTabSwitcher from './components/MobileTabSwitcher';
import { MemorizationSetupModal, MemorizationReportModal } from './components/MemorizationModals';
import { X, List, Cloud, CheckCircle, AlertCircle, HelpCircle, Lightbulb, StopCircle, BookOpen, Layout, Cpu } from 'lucide-react';
import { useMoveTree } from './hooks/useMoveTree';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Point, AnalysisResult, GameMetadata, AppSettings, GameTab, MoveNode } from './types';
import { getChineseNotation, fenToBoard, ucciToCoords } from './lib/utils';
import { EngineStats } from './lib/engine';
import { INITIAL_BOARD_SETUP } from './constants';

type TabView = 'none' | 'moves' | 'cloud' | 'tabs';

const DEFAULT_SETTINGS: AppSettings = {
    enableSound: true,
    showPlayerNames: true,
    showVariationArrows: true,
    showCoords: true,
    animationSpeed: 300,
    boardSize: 'large',
    showEngineArrows: true
};

const DEFAULT_METADATA: GameMetadata = {
    title: '新局', event: '', date: new Date().toISOString().split('T')[0],
    result: 'unknown', redName: '', blackName: ''
};

const App: React.FC = () => {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [shouldAnimate, setShouldAnimate] = useState(true);

    // Core Game Hook
    const {
        currentNode, rootNode, activePath, addMove, importGame, jumpToMove,
        updateComment, batchUpdateComments, deleteCurrentMove, deleteNode, reorderChildren,
        linkMovesByFen, navigate, navigateVariation, cycleVariation, jumpToStep, notification,
        closeNotification, confirmState, showConfirm, closeConfirm, setRootNode,
        restoreState,
        memConfig, memErrors, memTotalSteps, memStartNodeId, getHint, showReport, startMemorization,
        stopMemorization, setShowReport
    } = useMoveTree(settings.enableSound);

    // --- Multi-Tab State ---
    const [tabs, setTabs] = useState<GameTab[]>(() => {
        const firstId = `game-${Date.now()}`;
        const firstBoard = INITIAL_BOARD_SETUP();
        const firstRoot: MoveNode = {
            id: `root-${firstId}`,
            parentId: null,
            move: null,
            boardState: firstBoard,
            children: [],
            comment: '',
            turn: 'red',
            selectedChildId: null,
            fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'
        };
        return [{
            id: firstId,
            title: '新局 1',
            rootNode: firstRoot,
            currentNodeId: firstRoot.id,
            metadata: { ...DEFAULT_METADATA, title: '新局 1' },
            createdAt: Date.now(),
            colorTag: 'none'
        }];
    });
    const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id || '');
    const [metadata, setMetadata] = useState<GameMetadata>(() => tabs[0]?.metadata || DEFAULT_METADATA);

    // Initial Sync for useMoveTree hook (runs once on mount)
    useEffect(() => {
        if (tabs.length > 0 && activeTabId) {
            const initialTab = tabs.find(t => t.id === activeTabId);
            if (initialTab) {
                restoreState(initialTab.rootNode, initialTab.currentNodeId);
            }
        }
    }, []); // Only on mount

    // Sync Logic: Ensure `tabs` array is updated with the latest state of the CURRENT game
    // whenever critical data changes. This effectively "saves" the current tab.
    useEffect(() => {
        if (!activeTabId) return;
        const activeTab = tabs.find(t => t.id === activeTabId);
        // Prevent syncing if the current rootNode ID doesn't match the active tab's rootNode ID
        // This is crucial to prevent race conditions during tab switching
        if (!activeTab || rootNode.id !== activeTab.rootNode.id) return;

        setTabs(prevTabs => {
            const currentTab = prevTabs.find(t => t.id === activeTabId);
            if (!currentTab) return prevTabs;

            // Only update if something actually changed to avoid infinite loops or unnecessary renders
            if (currentTab.rootNode === rootNode &&
                currentTab.currentNodeId === currentNode.id &&
                currentTab.metadata === metadata) {
                return prevTabs;
            }

            return prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                    return {
                        ...tab,
                        rootNode: JSON.parse(JSON.stringify(rootNode)), // Breaking reference
                        currentNodeId: currentNode.id,
                        metadata: { ...metadata }
                    };
                }
                return tab;
            });
        });
    }, [rootNode, currentNode.id, metadata, activeTabId]);

    const handleSwitchTab = (targetId: string, providedTab?: GameTab) => {
        if (!providedTab && targetId === activeTabId) return;

        const targetTab = providedTab || tabs.find(t => t.id === targetId);
        if (targetTab) {
            setShouldAnimate(false);
            setActiveTabId(targetId);
            setMetadata({ ...targetTab.metadata });

            // Updating Hook State Atomically with a Deep Clone
            const clonedRoot = JSON.parse(JSON.stringify(targetTab.rootNode));
            restoreState(clonedRoot, targetTab.currentNodeId);
        }
    };

    const handleAddTab = () => {
        const newId = `game-${Date.now()}`;
        const newBoard = INITIAL_BOARD_SETUP();
        const newRoot = {
            id: `root-${newId}`,
            parentId: null,
            move: null,
            boardState: newBoard,
            children: [],
            comment: '',
            turn: 'red' as const,
            selectedChildId: null,
            fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'
        };

        const newTab: GameTab = {
            id: newId,
            title: `新局 ${tabs.length + 1}`,
            rootNode: newRoot,
            currentNodeId: newRoot.id,
            metadata: { ...DEFAULT_METADATA, title: `新局 ${tabs.length + 1}` },
            createdAt: Date.now(),
            colorTag: 'none'
        };

        setTabs(prev => [...prev, newTab]);
        handleSwitchTab(newId, newTab);
    };

    const handleDeleteTab = (id: string) => {
        if (tabs.length <= 1) return;
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) {
            handleSwitchTab(newTabs[newTabs.length - 1].id);
        }
    };

    const handleRenameTab = (id: string, title: string) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, title } : t));
    };

    const handleReorderTab = (id: string, dir: 'up' | 'down') => {
        const idx = tabs.findIndex(t => t.id === id);
        if (idx === -1) return;
        const newTabs = [...tabs];
        if (dir === 'up' && idx > 0) {
            [newTabs[idx], newTabs[idx - 1]] = [newTabs[idx - 1], newTabs[idx]];
        } else if (dir === 'down' && idx < newTabs.length - 1) {
            [newTabs[idx], newTabs[idx + 1]] = [newTabs[idx + 1], newTabs[idx]];
        }
        setTabs(newTabs);
    };

    const handleColorChange = (id: string, color: GameTab['colorTag']) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, colorTag: color } : t));
    };

    // -----------------------

    const [mobileTab, setMobileTab] = useState<TabView>('none');
    const [isFlipped, setIsFlipped] = useState(false);
    const [isMirrored, setIsMirrored] = useState(false);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [showGifExport, setShowGifExport] = useState(false);
    const [showMemSetup, setShowMemSetup] = useState(false);
    const [flashCoord, setFlashCoord] = useState<Point | null>(null);
    const [hintMove, setHintMove] = useState<{ from: Point, to: Point } | null>(null);
    const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
    const [showInfoModal, setShowInfoModal] = useState(false);

    const [isCloudEnabled, setIsCloudEnabled] = useState(false);
    const [engineStats, setEngineStats] = useState<EngineStats | null>(null);

    // Compute Engine Arrows
    const engineBestMoves = React.useMemo(() => {
        if (!settings.showEngineArrows || !engineStats?.pv || engineStats.pv.length === 0) return [];
        const moves: { from: Point, to: Point, color: 'red' | 'black' }[] = [];

        // PV[0]: Best move for current player
        const m1 = ucciToCoords(engineStats.pv[0]);
        if (m1) moves.push({ ...m1, color: currentNode.turn });

        // PV[1]: Best response for opponent
        if (engineStats.pv.length > 1) {
            const m2 = ucciToCoords(engineStats.pv[1]);
            if (m2) moves.push({ ...m2, color: currentNode.turn === 'red' ? 'black' : 'red' });
        }
        return moves;
    }, [engineStats, currentNode.turn, settings.showEngineArrows]);

    // Keyboard Shortcuts Integration
    useKeyboardShortcuts({
        onPrev: () => {
            if (memConfig.active) return;
            setShouldAnimate(false);
            navigate('prev');
        },
        onNext: () => {
            if (memConfig.active) return;
            setShouldAnimate(true);
            navigate('next');
        },
        onUp: () => {
            if (memConfig.active) return;
            setShouldAnimate(false);
            cycleVariation('up');
        },
        onDown: () => {
            if (memConfig.active) return;
            setShouldAnimate(false);
            cycleVariation('down');
        },
        // Tab Switching
        onTabPrev: () => {
            const idx = tabs.findIndex(t => t.id === activeTabId);
            const newIdx = (idx - 1 + tabs.length) % tabs.length;
            handleSwitchTab(tabs[newIdx].id);
        },
        onTabNext: () => {
            const idx = tabs.findIndex(t => t.id === activeTabId);
            const newIdx = (idx + 1) % tabs.length;
            handleSwitchTab(tabs[newIdx].id);
        }
    });

    const handleRequestDelete = (msg: string) => showConfirm('確認刪除', msg, deleteCurrentMove);
    const handleRequestDeleteNode = (nodeId: string, msg: string) => showConfirm('確認刪除變著', msg, () => deleteNode(nodeId));

    const handleCloudMove = (coords: { from: Point, to: Point }) => {
        const board = currentNode.boardState;
        const piece = board[coords.from.r][coords.from.c];
        if (!piece || piece.color !== currentNode.turn) return;
        const targetPiece = board[coords.to.r][coords.to.c];
        const notation = getChineseNotation(board, { ...coords, piece, captured: targetPiece });
        const newBoard = board.map(row => [...row]);
        newBoard[coords.to.r][coords.to.c] = piece;
        newBoard[coords.from.r][coords.from.c] = null;
        setShouldAnimate(true);
        addMove({ ...coords, piece, captured: targetPiece, notation }, newBoard);
    };

    const handleEditorConfirm = (fen: string) => {
        try {
            const { board, turn } = fenToBoard(fen);
            setRootNode({
                id: 'root-' + Date.now(), parentId: null, move: null,
                boardState: board, children: [], comment: '',
                turn, selectedChildId: null, fen
            });
            setShowEditor(false);
        } catch (e) { alert("FEN 格式錯誤"); }
    };

    const handleHint = () => {
        const hint = getHint();
        if (hint) {
            setHintMove(hint);
            setTimeout(() => setHintMove(null), 1500);
        }
    };

    const currentIndex = activePath.findIndex(n => n.id === currentNode.id);

    return (
        <>
            <MainLayout
                header={
                    <Header
                        title={metadata.title}
                        onTitleChange={(t) => setMetadata(prev => ({ ...prev, title: t }))}
                        onOpenInfo={() => setShowInfoModal(true)} onOpenEdit={() => setShowEditor(true)}
                        onOpenSettings={() => setShowSettings(true)} onOpenImport={() => setShowImport(true)}
                        onOpenExport={() => setShowExport(true)}
                        onOpenGif={() => setShowGifExport(true)}
                        onOpenMemorize={() => memConfig.active ? stopMemorization() : setShowMemSetup(true)}
                        isMemorizing={memConfig.active}
                    />
                }
                leftSidebar={
                    <>
                        <TabManager
                            tabs={tabs} activeTabId={activeTabId}
                            onSwitch={handleSwitchTab} onAdd={handleAddTab} onDelete={handleDeleteTab}
                            onRename={handleRenameTab} onReorder={handleReorderTab} onColorChange={handleColorChange}
                        />
                        <CloudPanel
                            currentFen={currentNode.fen} currentBoard={currentNode.boardState}
                            onMoveClick={handleCloudMove} onOpenAnalysis={() => setShowAnalysis(true)}
                            isEnabled={isCloudEnabled} onToggleEnabled={setIsCloudEnabled}
                            onEngineStatsUpdate={setEngineStats}
                        />
                    </>
                }
                rightSidebar={
                    memConfig.active ? (
                        <div className="flex flex-col h-full bg-zinc-900 items-center justify-center text-zinc-500 gap-4 p-8 text-center">
                            <div className="w-16 h-16 rounded-full bg-amber-900/20 flex items-center justify-center animate-pulse">
                                <BookOpen size={32} className="text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-zinc-300">背譜模式進行中</h3>
                                <p className="text-sm mt-2">招法列表已隱藏，請專注於棋盤。</p>
                            </div>
                        </div>
                    ) : (
                        <MoveListPanel
                            movePath={activePath} currentNode={currentNode} rootNode={rootNode}
                            onJumpToMove={n => { setShouldAnimate(false); jumpToMove(n); }}
                            onUpdateComment={updateComment} onRequestDelete={handleRequestDelete} onRequestDeleteNode={handleRequestDeleteNode}
                            onReorder={reorderChildren} onLinkFen={linkMovesByFen}
                        />
                    )
                }
                board={
                    <ChessBoard
                        onMoveMade={(m, b) => {
                            setShouldAnimate(true);
                            const ok = addMove(m, b);
                            if (!ok && memConfig.active) { setFlashCoord(m.to); setTimeout(() => setFlashCoord(null), 200); }
                            return ok;
                        }}
                        currentBoard={currentNode.boardState} currentTurn={currentNode.turn}
                        lastMove={currentNode.move ? { from: currentNode.move.from, to: currentNode.move.to } : null}
                        isFlipped={isFlipped} isMirrored={isMirrored}
                        redName={metadata.redName} blackName={metadata.blackName}
                        flashCoord={flashCoord}
                        hintMove={hintMove}
                        currentNode={currentNode}
                        onNodeSelect={node => { setShouldAnimate(false); jumpToMove(node); }}
                        settings={settings} shouldAnimate={shouldAnimate}
                        engineBestMoves={engineBestMoves}
                    />
                }
                controls={
                    mobileTab === 'cloud' ? (
                        <div className="h-[30vh] border-t border-zinc-800">
                            <CloudPanel
                                currentFen={currentNode.fen} currentBoard={currentNode.boardState}
                                onMoveClick={m => { handleCloudMove(m); }}
                                onOpenAnalysis={() => { setShowAnalysis(true); setMobileTab('none'); }}
                                isEnabled={isCloudEnabled} onToggleEnabled={setIsCloudEnabled}
                                onEngineStatsUpdate={setEngineStats}
                                isCompact={true}
                                forcedMode="cloud"
                                onNavigate={dir => { setShouldAnimate(dir === 'next'); navigate(dir); }}
                                onMenu={() => setShowSettings(true)}
                            />
                        </div>
                    ) : mobileTab === 'engine' ? (
                        <div className="h-[30vh] border-t border-zinc-800">
                            <CloudPanel
                                currentFen={currentNode.fen} currentBoard={currentNode.boardState}
                                onMoveClick={m => { handleCloudMove(m); }}
                                onOpenAnalysis={() => { setShowAnalysis(true); setMobileTab('none'); }}
                                isEnabled={isCloudEnabled} onToggleEnabled={setIsCloudEnabled}
                                onEngineStatsUpdate={setEngineStats}
                                isCompact={true}
                                forcedMode="local"
                                onNavigate={dir => { setShouldAnimate(dir === 'next'); navigate(dir); }}
                                onMenu={() => setShowSettings(true)}
                            />
                        </div>
                    ) : memConfig.active ? (
                        <div className="flex gap-4 p-4 bg-zinc-900 border-t border-zinc-800 justify-center">
                            <button
                                onClick={handleHint}
                                className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-bold shadow-lg shadow-yellow-900/20 active:scale-95 transition-all"
                            >
                                <Lightbulb size={20} fill="currentColor" /> 提示
                            </button>
                            <button
                                onClick={stopMemorization}
                                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold shadow-lg shadow-red-900/20 active:scale-95 transition-all"
                            >
                                <StopCircle size={20} /> 結束背譜
                            </button>
                        </div>
                    ) : (
                        <ControlBar
                            onNavigate={dir => { setShouldAnimate(dir === 'next' || dir === 'end'); navigate(dir); }}
                            onNavigateVariation={dir => { setShouldAnimate(false); navigateVariation(dir); }}
                            onJumpToStep={s => { setShouldAnimate(false); jumpToStep(s); }}
                            onFlip={() => setIsFlipped(!isFlipped)} onMirror={() => setIsMirrored(!isMirrored)}
                            currentIndex={currentIndex !== -1 ? currentIndex : 0}
                            totalSteps={activePath.length} disabled={memConfig.active}
                        />
                    )
                }
                mobileTabs={
                    <div className="grid grid-cols-4 gap-2 h-full">
                        <button onClick={() => setMobileTab(mobileTab === 'moves' ? 'none' : 'moves')} className={`border border-zinc-700 rounded-lg flex items-center justify-center gap-2 transition-all ${mobileTab === 'moves' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
                            <List size={18} /> <span className="text-xs font-bold">招法</span>
                        </button>
                        <button onClick={() => setMobileTab(mobileTab === 'cloud' ? 'none' : 'cloud')} className={`border border-zinc-700 rounded-lg flex items-center justify-center gap-2 transition-all ${mobileTab === 'cloud' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
                            <Cloud size={18} /> <span className="text-xs font-bold">雲庫</span>
                        </button>
                        <button onClick={() => setMobileTab(mobileTab === 'engine' ? 'none' : 'engine')} className={`border border-zinc-700 rounded-lg flex items-center justify-center gap-2 transition-all ${mobileTab === 'engine' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
                            <Cpu size={18} /> <span className="text-xs font-bold">引擎</span>
                        </button>
                        <button onClick={() => setMobileTab(mobileTab === 'tabs' ? 'none' : 'tabs')} className={`border border-zinc-700 rounded-lg flex items-center justify-center gap-2 transition-all ${mobileTab === 'tabs' ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-zinc-300'}`}>
                            <Layout size={18} /> <span className="text-xs font-bold">分頁 ({tabs.length})</span>
                        </button>
                    </div>
                }
                mobileOverlay={
                    <>
                        {mobileTab === 'tabs' && (
                            <MobileTabSwitcher
                                isOpen={true} onClose={() => setMobileTab('none')}
                                tabs={tabs} activeTabId={activeTabId} onSwitch={handleSwitchTab}
                                onAdd={handleAddTab} onDelete={handleDeleteTab}
                            />
                        )}

                        {(mobileTab === 'moves') && (
                            <div className="fixed inset-0 z-[60] bg-zinc-950 flex flex-col xl:hidden">
                                <div className="flex items-center justify-between px-4 h-14 bg-zinc-900 border-b border-zinc-800 shrink-0">
                                    <div className="flex gap-2 bg-zinc-800 p-1 rounded-lg">
                                        <button onClick={() => setMobileTab('moves')} className={`px-4 py-1 rounded-md text-sm transition-all ${mobileTab === 'moves' ? 'bg-zinc-700 text-white' : 'text-zinc-400'}`}>招法</button>
                                    </div>
                                    <button onClick={() => setMobileTab('none')} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400"><X size={20} /></button>
                                </div>
                                <div className="flex-1 overflow-hidden relative bg-zinc-950">
                                    <MoveListPanel movePath={activePath} currentNode={currentNode} rootNode={rootNode} onJumpToMove={n => { setShouldAnimate(false); jumpToMove(n); setMobileTab('none'); }} onUpdateComment={updateComment} onRequestDelete={handleRequestDelete} onRequestDeleteNode={handleRequestDeleteNode} onReorder={reorderChildren} onLinkFen={linkMovesByFen} />
                                </div>
                            </div>
                        )}
                    </>
                }
            />

            {/* Modals */}
            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} settings={settings} onUpdate={setSettings} />
            <InfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} metadata={metadata} onSave={(m) => { setMetadata(m); setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, metadata: m } : t)); }} />
            <BoardEditorModal isOpen={showEditor} onClose={() => setShowEditor(false)} initialFen={currentNode.fen} onConfirm={handleEditorConfirm} isFlippedInitial={isFlipped} />
            <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} onImport={p => { importGame(p.fen, p.moves, p.root); if (p.header) { const newMeta = { ...metadata, title: p.header.Title || metadata.title, redName: p.header.Red || metadata.redName, blackName: p.header.Black || metadata.blackName }; setMetadata(newMeta); setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, metadata: newMeta } : t)); } }} />
            <ExportModal isOpen={showExport} onClose={() => setShowExport(false)} rootNode={rootNode} metadata={metadata} />
            <MemorizationSetupModal isOpen={showMemSetup} onClose={() => setShowMemSetup(false)} onStart={startMemorization} />

            <MemorizationReportModal
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                errors={memErrors}
                totalSteps={memTotalSteps}
                activePath={activePath}
                startNodeId={memStartNodeId}
                endNodeId={currentNode.id}
            />

            <GifExportModal isOpen={showGifExport} onClose={() => setShowGifExport(false)} activePath={activePath} rootNode={rootNode} metadata={metadata} />
            {showAnalysis && <AnalysisModal onClose={() => setShowAnalysis(false)} movePath={activePath} onJumpToStep={s => { setShouldAnimate(false); jumpToStep(s); }} onBatchUpdateComments={batchUpdateComments} results={analysisResults} setResults={setAnalysisResults} />}

            {/* Notifications */}
            {notification.show && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full">
                        <div className="flex items-start gap-4 mb-4">
                            {notification.type === 'success' ? <CheckCircle className="text-green-500" size={28} /> : <AlertCircle className="text-red-500" size={28} />}
                            <div><h3 className="font-bold">{notification.title}</h3><p className="text-sm text-zinc-400">{notification.message}</p></div>
                        </div>
                        <button onClick={closeNotification} className="w-full py-2 bg-white text-zinc-950 font-bold rounded-lg">確定</button>
                    </div>
                </div>
            )}
            {confirmState.show && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full">
                        <div className="flex items-start gap-4 mb-4">
                            <HelpCircle className="text-amber-500" size={28} />
                            <div><h3 className="font-bold">{confirmState.title}</h3><p className="text-sm text-zinc-400">{confirmState.message}</p></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={closeConfirm} className="flex-1 py-2 bg-zinc-800 rounded-lg">取消</button>
                            <button onClick={() => { confirmState.onConfirm(); closeConfirm(); }} className="flex-1 py-2 bg-red-600 font-bold rounded-lg">確定刪除</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default App;
