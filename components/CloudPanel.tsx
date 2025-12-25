
import React, { useState, useEffect, useRef } from 'react';
import { Cloud, Activity, RefreshCw, WifiOff, BarChart2, Cpu, Play, Square, Settings2 } from 'lucide-react';
import { Point, Piece, CloudMove } from '../types';
import { getChineseNotation, ucciToCoords, fetchCloudBookData } from '../lib/utils';
import { LocalEngine, EngineStats } from '../lib/engine';

interface CloudPanelProps {
    currentFen: string;
    currentBoard: (Piece | null)[][];
    onMoveClick: (move: { from: Point; to: Point }) => void;
    onOpenAnalysis: () => void;
    isEnabled: boolean; // Controls Cloud State
    onToggleEnabled: (enabled: boolean) => void;
}

const CloudPanel: React.FC<CloudPanelProps> = ({ 
    currentFen, 
    currentBoard, 
    onMoveClick, 
    onOpenAnalysis,
    isEnabled,
    onToggleEnabled
}) => {
    const [mode, setMode] = useState<'cloud' | 'local'>('cloud');
    const [loading, setLoading] = useState(false);
    const [moves, setMoves] = useState<CloudMove[]>([]);
    
    // Local Engine State
    const [engineReady, setEngineReady] = useState(false);
    const [isLocalAnalyzing, setIsLocalAnalyzing] = useState(false);
    const [engineStats, setEngineStats] = useState<EngineStats | null>(null);
    const engineRef = useRef<LocalEngine | null>(null);

    // Initialize Engine on first switch to local
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
            });
        }
        // Cleanup when unmounting or stopping or changing FEN
        return () => {
            if (mode === 'local' && isLocalAnalyzing && engineRef.current) {
                // engineRef.current.stopAnalysis(); 
                // Don't stop immediately on FEN change to allow smooth transition, 
                // but strictly speaking 'startAnalysis' calls 'stop' internally.
            }
        };
    }, [currentFen, mode, isLocalAnalyzing, engineReady]);

    const toggleLocalAnalysis = () => {
        if (isLocalAnalyzing) {
            engineRef.current?.stopAnalysis();
            setIsLocalAnalyzing(false);
            setEngineStats(null);
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

    const getScoreColor = (score: number) => {
        if (score > 100) return 'text-red-400 font-bold';
        if (score < -100) return 'text-green-400 font-bold';
        return 'text-zinc-400';
    };

    return (
        <div className="flex flex-col h-full bg-zinc-900 border-zinc-800 w-full overflow-hidden">
             {/* Header & Tabs */}
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
                        className={`flex-1 py-2 text-xs font-bold rounded-t-lg flex items-center justify-center gap-2 border-t border-x ${mode === 'local' ? 'bg-zinc-800 text-amber-400 border-zinc-700' : 'bg-zinc-900 text-zinc-500 border-transparent hover:bg-zinc-800/50'}`}
                    >
                        <Cpu size={14} /> 本地引擎
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-zinc-950 relative min-h-0">
                {mode === 'cloud' ? (
                    <>
                        <div className="p-3 border-b border-zinc-800 shrink-0 flex gap-2">
                            {!isEnabled ? (
                                <button 
                                    onClick={() => onToggleEnabled(true)}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center justify-center gap-2 font-bold text-sm shadow-lg transition-all"
                                >
                                    <Activity size={16} /> 連線並分析
                                </button>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => loadData(currentFen)}
                                        disabled={loading}
                                        className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded flex items-center justify-center gap-2 text-sm border border-zinc-700 transition-colors"
                                    >
                                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 刷新
                                    </button>
                                    <button 
                                        onClick={() => onToggleEnabled(false)}
                                        className="px-3 py-2 bg-zinc-800 hover:bg-red-900/40 text-zinc-400 hover:text-red-400 rounded border border-zinc-700 transition-colors"
                                    >
                                        <WifiOff size={16} />
                                    </button>
                                </>
                            )}
                            <button 
                                onClick={onOpenAnalysis}
                                className="px-3 py-2 bg-zinc-800 hover:bg-indigo-900/40 text-zinc-300 hover:text-indigo-300 rounded border border-zinc-700 transition-colors"
                                title="全盤分析"
                            >
                                <BarChart2 size={16} />
                            </button>
                        </div>

                        {!isEnabled ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-4 opacity-50">
                                <Cloud size={48} className="text-zinc-700" />
                                <p className="text-zinc-500 text-sm leading-relaxed">連接雲庫 API<br/>獲取即時大數據</p>
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
                                    {moves.map((m, idx) => (
                                        <tr 
                                            key={idx} 
                                            onClick={() => onMoveClick(ucciToCoords(m.move)!)}
                                            className="hover:bg-blue-900/10 cursor-pointer transition-colors"
                                        >
                                            <td className="px-3 py-2 font-bold text-zinc-300">{getMoveDisplayName(m.move)}</td>
                                            <td className={`px-2 py-2 text-right font-mono ${getScoreColor(m.score)}`}>{m.score}</td>
                                            <td className="px-2 py-2 text-right text-zinc-500 text-xs">{m.winrate}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </>
                ) : (
                    // Local Engine UI
                    <div className="flex flex-col h-full">
                        <div className="p-3 border-b border-zinc-800 shrink-0 flex gap-2">
                            <button 
                                onClick={toggleLocalAnalysis}
                                disabled={!engineReady}
                                className={`flex-1 py-2 rounded flex items-center justify-center gap-2 font-bold text-sm shadow-lg transition-all ${isLocalAnalyzing ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 disabled:cursor-wait'}`}
                            >
                                {isLocalAnalyzing ? <><Square size={14} fill="currentColor" /> 停止計算</> : <><Play size={16} fill="currentColor" /> 開始計算</>}
                            </button>
                            <button 
                                onClick={onOpenAnalysis}
                                className="px-3 py-2 bg-zinc-800 hover:bg-indigo-900/40 text-zinc-300 hover:text-indigo-300 rounded border border-zinc-700 transition-colors"
                                title="全盤分析 (AI)"
                            >
                                <BarChart2 size={16} />
                            </button>
                        </div>

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
                                        <div className={`text-xl font-mono font-bold ${engineStats ? getScoreColor(engineStats.score) : 'text-zinc-600'}`}>
                                            {engineStats?.mate ? `M${Math.abs(engineStats.mate)}` : engineStats?.score || 0}
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
                                            {engineStats.pv.map((move, i) => (
                                                <span key={i} className={i === 0 ? "text-amber-400 font-bold mr-1.5" : "mr-1.5 text-zinc-400"}>
                                                    {getMoveDisplayName(move)}
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
