
import React, { useState, useEffect, useRef } from 'react';
import { Cloud, Activity, RefreshCw, WifiOff, BarChart2, Cpu, Play, Square, Settings2, Wifi } from 'lucide-react';
import { Point, Piece, CloudMove } from '../types';
import { getChineseNotation, ucciToCoords, fetchCloudBookData, getChineseNotationForPV } from '../lib/utils';
import { LocalEngine, EngineStats } from '../lib/engine';

interface CloudPanelProps {
    currentFen: string;
    currentBoard: (Piece | null)[][];
    onMoveClick: (move: { from: Point; to: Point }) => void;
    onOpenAnalysis: () => void;
    isEnabled: boolean; // Controls Cloud State
    onToggleEnabled: (enabled: boolean) => void;
    onEngineStatsUpdate?: (stats: EngineStats | null) => void;
    isCompact?: boolean;
    forcedMode?: 'cloud' | 'local';
    // Compact Navigation Props
    onNavigate?: (direction: 'prev' | 'next') => void;
    onMenu?: () => void;
}

const CloudPanel: React.FC<CloudPanelProps> = ({
    currentFen,
    currentBoard,
    onMoveClick,
    onOpenAnalysis,
    isEnabled,
    onToggleEnabled,
    onEngineStatsUpdate,
    isCompact = false,
    forcedMode,
    onNavigate,
    onMenu
}) => {
    const [mode, setMode] = useState<'cloud' | 'local'>('cloud');

    // Sync external mode if provided
    useEffect(() => {
        if (forcedMode) setMode(forcedMode);
    }, [forcedMode]);
    const [loading, setLoading] = useState(false);
    const [moves, setMoves] = useState<CloudMove[]>([]);

    // Local Engine State
    const [engineReady, setEngineReady] = useState(false);
    const [isLocalAnalyzing, setIsLocalAnalyzing] = useState(false);
    const [engineStats, setEngineStats] = useState<EngineStats | null>(null);
    const engineRef = useRef<LocalEngine | null>(null);

    // Initialize Engine on first switch to local or if compact mode defaults to local? 
    // Actually compact mode should probably default to user preference, but let's stick to state.
    useEffect(() => {
        if (mode === 'local' && !engineRef.current) {
            const initEngine = async () => {
                const engine = LocalEngine.getInstance();
                await engine.init();
                engineRef.current = engine;
                setEngineReady(true);
            };
            initEngine();
        }
    }, [mode]);

    // Handle Local Analysis Trigger
    useEffect(() => {
        if (mode === 'local' && isLocalAnalyzing && engineRef.current && engineReady) {
            engineRef.current.startAnalysis(currentFen, (stats) => {
                setEngineStats(stats);
                onEngineStatsUpdate?.(stats);
            });
        }
        return () => {
            if (mode === 'local' && isLocalAnalyzing && engineRef.current) {
                // engineRef.current.stopAnalysis(); 
            }
        };
    }, [currentFen, mode, isLocalAnalyzing, engineReady]);

    const toggleLocalAnalysis = () => {
        if (isLocalAnalyzing) {
            engineRef.current?.stopAnalysis();
            setIsLocalAnalyzing(false);
        } else {
            setIsLocalAnalyzing(true);
        }
    };

    const getMoveDisplayName = (ucci: string) => {
        try {
            const coords = ucciToCoords(ucci);
            if (!coords) return ucci;
            const { from, to } = coords;
            if (from.r < 0 || from.r > 9 || from.c < 0 || from.c > 8) return ucci;
            const piece = currentBoard[from.r][from.c];
            if (!piece) return ucci;
            const captured = currentBoard[to.r][to.c];
            return getChineseNotation(currentBoard, { from, to, piece, captured });
        } catch (e) { return ucci; }
    };

    const loadData = async (fen: string) => {
        if (!isEnabled || mode !== 'cloud') return;
        setLoading(true);
        try {
            const data = await fetchCloudBookData(fen);
            setMoves(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isEnabled && mode === 'cloud') loadData(currentFen);
    }, [currentFen, isEnabled, mode]);

    const isRedTurn = currentFen.split(' ')[1] === 'w';

    const getScoreDetails = (score: number | string) => {
        if (typeof score !== 'number') return { text: score, color: 'text-zinc-600' };

        // Logic:
        // If Red Turn (w): + is Red Adv, - is Black Adv
        // If Black Turn (b): + is Black Adv, - is Red Adv

        let isRedAdv = false;
        if (isRedTurn) {
            isRedAdv = score > 0;
        } else {
            isRedAdv = score < 0;
        }

        const absScore = Math.abs(score);
        const prefix = isRedAdv ? "紅優" : "黑優";
        const text = `${prefix}${absScore}`;

        // Color: Red Adv -> Red, Black Adv -> Green
        const color = isRedAdv ? 'text-red-400 font-bold' : 'text-green-400 font-bold'; // Using Green for Black Adv as per convention in chinese apps often

        return { text, color };
    };

    // Compact Mode Rendering
    if (isCompact) {
        return (
            <div className="flex flex-col h-full bg-zinc-900 border-t border-zinc-800 w-full overflow-hidden text-sm">
                {/* Stats Row (Consolidated) */}
                {(mode === 'local' || (mode === 'cloud' && moves.length > 0)) && (
                    <div className="grid grid-cols-5 gap-1 p-2 bg-zinc-950 border-b border-zinc-800 text-xs text-center items-center shrink-0">
                        <div className="flex flex-col border-r border-zinc-800">
                            <span className="text-zinc-500 scale-75 origin-center">SCORE</span>
                            <span className={`font-mono font-bold ${getScoreDetails(mode === 'local' ? (engineStats?.score || '-') : moves[0]?.score || '-').color}`}>
                                {getScoreDetails(mode === 'local' ? (engineStats?.mate ? `M${Math.abs(engineStats.mate)}` : engineStats?.score || '-') : moves[0]?.score || '-').text}
                            </span>
                        </div>
                        <div className="flex flex-col border-r border-zinc-800">
                            <span className="text-zinc-500 scale-75 origin-center">DEPTH</span>
                            <span className="text-amber-500 font-mono">{mode === 'local' ? (engineStats?.depth || '-') : moves[0]?.depth || '-'}</span>
                        </div>
                        <div className="flex flex-col border-r border-zinc-800">
                            <span className="text-zinc-500 scale-75 origin-center">TIME</span>
                            <span className="text-zinc-300 font-mono scale-90">{mode === 'local' ? (engineStats ? (engineStats.time / 1000).toFixed(1) + 's' : '0s') : '-'}</span>
                        </div>
                        <div className="flex flex-col border-r border-zinc-800">
                            <span className="text-zinc-500 scale-75 origin-center">NPS</span>
                            <span className="text-zinc-400 font-mono scale-90">{mode === 'local' ? (engineStats ? (engineStats.nps / 1000).toFixed(0) + 'k' : '0') : '-'}</span>
                        </div>
                        <div className="flex flex-col justify-center items-center h-full pl-1">
                            {mode === 'local' ? (
                                <button
                                    onClick={toggleLocalAnalysis}
                                    disabled={!engineReady}
                                    className={`flex items-center justify-center gap-1 w-full h-full rounded text-[10px] font-bold transition-colors ${isLocalAnalyzing ? 'bg-red-900/40 text-red-400 border border-red-900' : 'bg-green-900/40 text-green-400 border border-green-900'}`}
                                >
                                    {isLocalAnalyzing ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                                    {isLocalAnalyzing ? '停止' : '計算'}
                                </button>
                            ) : (
                                <span className="text-zinc-600">-</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Compact Content (Moves List) */}
                <div className="flex-1 overflow-y-auto bg-zinc-950 p-0">
                    {mode === 'cloud' ? (
                        <div className="space-y-0 divide-y divide-zinc-800/50">
                            {!isEnabled ? (
                                <div className="p-2"><button onClick={() => onToggleEnabled(true)} className="w-full py-2 bg-blue-600/20 text-blue-400 rounded border border-blue-600/50 text-xs font-bold">開啟雲庫連線</button></div>
                            ) : loading ? (
                                <div className="text-center text-zinc-500 text-xs py-2">查詢中...</div>
                            ) : moves.length === 0 ? (
                                <div className="text-center text-zinc-500 text-xs py-2">無資料</div>
                            ) : (
                                <table className="w-full text-xs">
                                    <tbody>
                                        {moves.map((m, i) => {
                                            const details = getScoreDetails(m.score);
                                            return (
                                                <tr key={i} onClick={() => onMoveClick(ucciToCoords(m.move)!)} className="active:bg-zinc-800">
                                                    <td className="py-2 text-zinc-300 font-medium pl-2">{getMoveDisplayName(m.move)}</td>
                                                    <td className={`py-2 text-right ${details.color}`}>{details.text}</td>
                                                    <td className="py-2 text-right text-zinc-500 pr-2">{m.winrate}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 p-2">
                            {/* Inner Stats Row REMOVED (Duplicate) */}

                            {/* PV Move */}
                            {engineStats?.bestMove && (
                                <div className="bg-zinc-900 border border-zinc-800 rounded p-2 flex items-center justify-between">
                                    <span className="text-amber-400 font-bold text-lg">{getMoveDisplayName(engineStats.bestMove)}</span>
                                    <button onClick={() => onMoveClick(ucciToCoords(engineStats.bestMove)!)} className="px-3 py-1 bg-zinc-800 text-xs rounded border border-zinc-700">走這步</button>
                                </div>
                            )}

                            {/* PV Line */}
                            {engineStats?.pv && (
                                <div className="text-xs text-zinc-500 break-words leading-relaxed px-1">
                                    {getChineseNotationForPV(currentFen, engineStats.pv).slice(1).join(' ')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-900 border-zinc-800 w-full overflow-hidden">
            {/* Header & Tabs - Hidden in forced mode (Mobile Split View) */}
            {!forcedMode && (
                <div className="bg-zinc-900 border-b border-zinc-800 shrink-0">
                    <div className="flex px-2 pt-2 gap-1">
                        <button
                            onClick={() => setMode('cloud')}
                            className={`flex-1 py-2 text-xs font-bold rounded-t-lg flex items-center justify-center gap-2 border-t border-x ${mode === 'cloud' ? 'bg-zinc-800 text-blue-400 border-zinc-700' : 'bg-zinc-900 text-zinc-500 border-transparent hover:bg-zinc-800/50'}`}
                        >
                            <Cloud size={14} /> 雲庫
                        </button>
                        <button
                            onClick={() => setMode('local')}
                            className={`flex-1 py-2 text-xs font-bold rounded-t-lg flex items-center justify-center gap-2 border-t border-x ${mode === 'local' ? 'bg-zinc-800 text-amber-500 border-zinc-700' : 'bg-zinc-900 text-zinc-500 border-transparent hover:bg-zinc-800/50'}`}
                        >
                            <Cpu size={14} /> 引擎
                        </button>
                    </div>

                    {/* Toolbar Area */}
                    <div className="px-2 py-2 bg-zinc-800/50 flex gap-2 border-b border-zinc-800">
                        {mode === 'cloud' ? (
                            <>
                                <button
                                    onClick={() => {
                                        if (!isEnabled) onToggleEnabled(true);
                                        else loadData(currentFen);
                                    }}
                                    className={`flex-1 px-3 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap ${!isEnabled
                                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                                        }`}
                                >
                                    <Wifi size={14} className={loading && isEnabled ? 'animate-pulse' : ''} /> 連線
                                </button>
                                <button
                                    onClick={() => onToggleEnabled(false)}
                                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-zinc-700 rounded text-xs flex items-center justify-center gap-2 whitespace-nowrap"
                                    title="關閉連線"
                                >
                                    <WifiOff size={14} /> 關閉
                                </button>
                                <button
                                    onClick={onOpenAnalysis}
                                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-blue-400 border border-zinc-700 rounded text-xs flex items-center justify-center gap-2 whitespace-nowrap"
                                    title="全局分析"
                                >
                                    <BarChart2 size={14} /> 全局分析
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={toggleLocalAnalysis}
                                    className={`flex-1 px-3 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-2 border transition-all active:scale-95 whitespace-nowrap ${isLocalAnalyzing ? 'bg-red-900/40 text-red-200 border-red-800 hover:bg-red-900/60' : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'}`}
                                >
                                    {isLocalAnalyzing ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                    {isLocalAnalyzing ? '停止計算' : '開始計算'}
                                </button>

                                <button
                                    onClick={onOpenAnalysis}
                                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-blue-400 border border-zinc-700 rounded text-xs flex items-center justify-center gap-2 whitespace-nowrap"
                                    title="全局分析"
                                >
                                    <BarChart2 size={14} /> 全局分析
                                </button>


                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-zinc-950 relative min-h-0">
                {mode === 'cloud' ? (
                    <>
                        {!isEnabled ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-4 opacity-50">
                                <Cloud size={48} className="text-zinc-700" />
                                <p className="text-zinc-500 text-sm leading-relaxed">連接雲庫 API<br />獲取即時大數據</p>
                            </div>
                        ) : loading ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-3 text-zinc-500">
                                <RefreshCw size={24} className="animate-spin text-blue-500" />
                                <span className="text-xs font-medium">查詢中...</span>
                            </div>
                        ) : moves.length === 0 ? (
                            <div className="p-10 text-center text-zinc-600 italic text-sm">此局面無雲庫紀錄</div>
                        ) : (
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-zinc-900 text-zinc-500 font-bold sticky top-0 z-10 text-[10px] uppercase tracking-wider">
                                    <tr>
                                        <th className="px-3 py-2 border-b border-zinc-800">招法</th>
                                        <th className="px-2 py-2 border-b border-zinc-800 text-right">分數</th>
                                        <th className="px-2 py-2 border-b border-zinc-800 text-right">勝率</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/30">
                                    {moves.map((m, idx) => {
                                        const details = getScoreDetails(m.score);
                                        return (
                                            <tr
                                                key={idx}
                                                onClick={() => onMoveClick(ucciToCoords(m.move)!)}
                                                className="hover:bg-blue-900/10 cursor-pointer transition-colors"
                                            >
                                                <td className="px-3 py-2 font-bold text-zinc-300">{getMoveDisplayName(m.move)}</td>
                                                <td className={`px-2 py-2 text-right font-mono ${details.color}`}>{details.text}</td>
                                                <td className="px-2 py-2 text-right text-zinc-500 text-xs">{m.winrate}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </>
                ) : (
                    // Local Engine UI
                    <div className="flex flex-col h-full">


                        {!engineReady ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
                                <RefreshCw size={24} className="animate-spin text-amber-500" />
                                <span className="text-xs">引擎載入中 (需下載 NNUE)...</span>
                            </div>
                        ) : !isLocalAnalyzing && !engineStats ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 gap-2 opacity-50">
                                <Cpu size={48} />
                                <span className="text-xs">Pikafish NNUE 就緒</span>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {/* Score Board */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-zinc-900 rounded p-2 text-center border border-zinc-800">
                                        <div className="text-[10px] text-zinc-500 uppercase">Score</div>
                                        <div className={`text-xl font-mono font-bold ${engineStats ? getScoreDetails(engineStats.score).color : 'text-zinc-600'}`}>
                                            {engineStats?.mate ? `M${Math.abs(engineStats.mate)}` : (engineStats ? getScoreDetails(engineStats.score).text : '-')}
                                        </div>
                                    </div>
                                    <div className="bg-zinc-900 rounded p-2 text-center border border-zinc-800">
                                        <div className="text-[10px] text-zinc-500 uppercase">Depth</div>
                                        <div className="text-xl font-mono font-bold text-amber-400">
                                            {engineStats?.depth || 0}
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Details */}
                                <div className="flex justify-between text-[10px] text-zinc-500 font-mono bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
                                    <span>NPS: {engineStats ? (engineStats.nps / 1000).toFixed(1) + 'k' : '-'}</span>
                                    <span>Nodes: {engineStats ? (engineStats.nodes / 1000000).toFixed(2) + 'M' : '-'}</span>
                                </div>

                                {/* PV Line */}
                                {engineStats?.pv && engineStats.pv.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                                            <Settings2 size={12} /> 主要變例 (PV)
                                        </div>
                                        <div className="bg-zinc-900 border border-zinc-800 rounded p-2 text-sm text-zinc-300 font-mono leading-relaxed break-words">
                                            {getChineseNotationForPV(currentFen, engineStats.pv).map((move, i) => (
                                                <span key={i} className={i === 0 ? "text-amber-400 font-bold mr-1.5" : "mr-1.5 text-zinc-400"}>
                                                    {move}
                                                </span>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => engineStats.bestMove && onMoveClick(ucciToCoords(engineStats.bestMove)!)}
                                            className="w-full mt-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded border border-zinc-700 transition-colors"
                                        >
                                            走這步 ({engineStats.bestMove && getMoveDisplayName(engineStats.bestMove)})
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CloudPanel;
