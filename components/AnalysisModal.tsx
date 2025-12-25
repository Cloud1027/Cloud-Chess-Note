
import React, { useState, useRef, useEffect } from 'react';
import { X, Play, Edit3, AlertTriangle, Activity, Cloud, Cpu, StopCircle } from 'lucide-react';
import { MoveNode, AnalysisResult } from '../types';
import { fetchCloudBookData, ucciToCoords, getChineseNotation } from '../lib/utils';
import { LocalEngine } from '../lib/engine';

interface AnalysisModalProps {
    onClose: () => void;
    movePath: MoveNode[]; // The full active path
    onJumpToStep: (index: number) => void;
    onBatchUpdateComments: (updates: { id: string, text: string }[]) => void;
    results: AnalysisResult[];
    setResults: (results: AnalysisResult[]) => void;
}

const AnalysisModal: React.FC<AnalysisModalProps> = ({
    onClose,
    movePath,
    onJumpToStep,
    onBatchUpdateComments,
    results,
    setResults
}) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisMode, setAnalysisMode] = useState<'cloud' | 'local'>('cloud');
    const [localDepth, setLocalDepth] = useState(15);

    const [progress, setProgress] = useState(0);
    const [currentStepInfo, setCurrentStepInfo] = useState('');
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const stopLocalRef = useRef(false);

    // If we have existing results, assume progress is complete or use previous length
    useEffect(() => {
        if (results.length > 0 && !isAnalyzing) {
            setProgress(100);
        }
    }, [results.length]);

    const startCloudAnalysis = async () => {
        setIsAnalyzing(true);
        setAnalysisMode('cloud');
        setResults([]);
        setSelectedIndex(null);
        setProgress(0);
        abortControllerRef.current = new AbortController();

        const newResults: AnalysisResult[] = [];
        const totalSteps = movePath.length - 1;

        for (let i = 0; i < totalSteps; i++) {
            if (abortControllerRef.current.signal.aborted) break;

            const currentNode = movePath[i];
            const nextNode = movePath[i + 1];

            setCurrentStepInfo(`正在查詢第 ${i + 1} 回合...`);
            const cloudMoves = await fetchCloudBookData(currentNode.fen);

            let actualMoveUcci = '';
            if (nextNode.move) {
                const f = nextNode.move.from;
                const t = nextNode.move.to;
                const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
                const ucciFrom = `${files[f.c]}${9 - f.r}`;
                const ucciTo = `${files[t.c]}${9 - t.r}`;
                actualMoveUcci = ucciFrom + ucciTo;
            }

            const playedCloudMove = cloudMoves.find(m => m.move === actualMoveUcci);
            const bestCloudMove = cloudMoves.length > 0 ? cloudMoves[0] : null;

            // ... Score Logic Reuse ...
            const resultItem = calculateResult(currentNode, nextNode, playedCloudMove, bestCloudMove, i + 1, actualMoveUcci);

            newResults.push(resultItem);
            setResults([...newResults]);
            setProgress(((i + 1) / totalSteps) * 100);

            await new Promise(r => setTimeout(r, 100)); // Rate limit slightly
        }

        setIsAnalyzing(false);
        setCurrentStepInfo('');
    };

    const startLocalAnalysis = async () => {
        const engine = LocalEngine.getInstance();
        try {
            await engine.init();
        } catch (e) {
            alert("引擎載入失敗");
            return;
        }

        setIsAnalyzing(true);
        setAnalysisMode('local');
        setResults([]);
        setSelectedIndex(null);
        setProgress(0);
        stopLocalRef.current = false;

        const newResults: AnalysisResult[] = [];
        const totalSteps = movePath.length - 1;

        // Cache for evaluations (Red perspective)
        const evals: number[] = [];
        const bestMoves: string[] = [];

        try {
            // 1. Evaluate Initial Position
            setCurrentStepInfo(`正在評估初始局面 (深度 ${localDepth})...`);
            const initStats = await engine.analyzeFixedDepth(movePath[0].fen, localDepth);
            evals[0] = (movePath[0].turn === 'red') ? initStats.score : -initStats.score;
            bestMoves[0] = initStats.bestMove || '';

            for (let i = 0; i < totalSteps; i++) {
                if (stopLocalRef.current) break;

                const currentNode = movePath[i];
                const nextNode = movePath[i + 1];

                setCurrentStepInfo(`正在分析第 ${i + 1} 手 (深度 ${localDepth})...`);
                const stats = await engine.analyzeFixedDepth(nextNode.fen, localDepth);

                const isRedTurnAfter = nextNode.turn === 'red';
                const redPerspectiveScore = isRedTurnAfter ? stats.score : -stats.score;
                evals[i + 1] = redPerspectiveScore;
                bestMoves[i + 1] = stats.bestMove || '';

                const prevRedScore = evals[i];
                const currentRedScore = evals[i + 1];
                const isRedSide = currentNode.turn === 'red';

                // Calculate real deviation using Differential Analysis
                let deviation = isRedSide ? (prevRedScore - currentRedScore) : (currentRedScore - prevRedScore);

                const ucciMove = nextNode.move ? (() => {
                    const f = nextNode.move.from;
                    const t = nextNode.move.to;
                    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
                    return `${files[f.c]}${9 - f.r}${files[t.c]}${9 - t.r}`;
                })() : "";

                let bestMoveNotation = "";
                const bestMoveUcci = bestMoves[i];
                const bestCoords = ucciToCoords(bestMoveUcci);
                if (bestCoords) {
                    const piece = currentNode.boardState[bestCoords.from.r][bestCoords.from.c];
                    const target = currentNode.boardState[bestCoords.to.r][bestCoords.to.c];
                    if (piece) {
                        bestMoveNotation = getChineseNotation(currentNode.boardState, { from: bestCoords.from, to: bestCoords.to, piece, captured: target });
                    }
                }

                // If played move is same as best move, ignore search noise deviation
                if (ucciMove === bestMoveUcci.trim().toLowerCase()) {
                    deviation = 0;
                }

                deviation = Math.max(0, deviation);

                let quality: AnalysisResult['quality'] = 'good';
                if (deviation > 500) quality = 'blunder';
                else if (deviation > 200) quality = 'mistake';
                else if (deviation > 50) quality = 'inaccuracy';

                const resultItem: AnalysisResult = {
                    nodeId: nextNode.id,
                    moveIndex: i + 1,
                    moveNotation: nextNode.move?.notation || "未知",
                    fen: currentNode.fen,
                    score: currentRedScore,
                    deviation,
                    isRedTurn: isRedSide,
                    bestMove: bestMoveNotation || bestMoveUcci,
                    bestScore: prevRedScore,
                    quality
                };

                newResults.push(resultItem);
                setResults([...newResults]);
                setProgress(((i + 1) / totalSteps) * 100);
            }
        } catch (err) {
            console.error("Local Analysis Error:", err);
        }

        engine.stopAnalysis();
        setIsAnalyzing(false);
        setCurrentStepInfo('');
    };

    // Helper to unify logic
    const calculateResult = (
        currentNode: MoveNode,
        nextNode: MoveNode,
        playedMove: { score: number } | null | undefined,
        bestMove: { move: string, score: number } | null | undefined,
        moveIndex: number,
        actualMoveUcci: string
    ): AnalysisResult => {
        let deviation = 0;
        let finalScore = null;
        let bestMoveNotation = "";
        const isRedTurn = currentNode.turn === 'red';

        // Notation for Best Move
        if (bestMove) {
            const bestCoords = ucciToCoords(bestMove.move);
            if (bestCoords) {
                const piece = currentNode.boardState[bestCoords.from.r][bestCoords.from.c];
                const target = currentNode.boardState[bestCoords.to.r][bestCoords.to.c];
                if (piece) {
                    bestMoveNotation = getChineseNotation(currentNode.boardState, { from: bestCoords.from, to: bestCoords.to, piece, captured: target });
                } else {
                    bestMoveNotation = bestMove.move;
                }
            }
        }

        // Score Calc
        const bestScoreVal = bestMove?.score || 0;

        if (playedMove) {
            const rawScore = playedMove.score;
            finalScore = rawScore; // Cloud data is usually Red Perspective? 
            // Wait, fetchCloudBookData returns raw score. Usually cloud books normalize.
            // Let's assume standard behavior: Cloud is Red relative or absolute?
            // Usually absolute. 
            deviation = Math.abs(bestScoreVal - rawScore);
        } else if (bestMove) {
            // Played move not in book / not best (for AI mode single PV)
            // Assume penalty
            deviation = 200; // Generic penalty for unknown move
            // Estimate score based on penalty
            // If Red played bad, Score drops. If Black played bad, Score rises.
            const penalty = isRedTurn ? -200 : 200;
            finalScore = bestScoreVal + penalty;
        }

        // Quality
        let quality: AnalysisResult['quality'] = 'good';
        if (deviation > 500) quality = 'blunder';
        else if (deviation > 200) quality = 'mistake';
        else if (deviation > 50) quality = 'inaccuracy';

        return {
            nodeId: nextNode.id,
            moveIndex: moveIndex,
            moveNotation: nextNode.move?.notation || "未知",
            fen: currentNode.fen,
            score: finalScore,
            deviation,
            isRedTurn: isRedTurn,
            bestMove: bestMoveNotation,
            bestScore: bestScoreVal,
            quality
        };
    };

    const stopAnalysis = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        stopLocalRef.current = true;
        setIsAnalyzing(false);
    };

    const handleJumpTo = (indexInResults: number, moveIndex: number) => {
        setSelectedIndex(indexInResults);
        onJumpToStep(moveIndex);
    };

    const writeAnnotations = () => {
        if (results.length === 0) return;
        const updates: { id: string, text: string }[] = [];
        results.forEach(res => {
            if (res.quality !== 'good') {
                const node = movePath.find(n => n.id === res.nodeId);
                if (!node) return;
                let label = '';
                if (res.quality === 'blunder') label = '錯著';
                else if (res.quality === 'mistake') label = '失著';
                else if (res.quality === 'inaccuracy') label = '緩著';
                const note = `【${label}】\n評分: ${res.score}\n偏差: ${res.deviation}\n推薦: ${res.bestMove} (${res.bestScore})`;
                let newComment = node.comment || "";
                if (!newComment.includes(`評分: ${res.score}`)) {
                    if (newComment.trim().length > 0) newComment += "\n" + note;
                    else newComment = note;
                    updates.push({ id: res.nodeId, text: newComment });
                }
            }
        });
        onBatchUpdateComments(updates);
        alert(`已將 ${updates.length} 條分析註釋寫入棋譜。`);
        onClose();
    };

    // --- Chart Logic ---
    const chartHeight = 220;
    const chartWidth = 600;
    const padding = 20;

    const getCoordinates = () => {
        if (results.length === 0) return "";
        const maxY = 600; const minY = -600;
        const validPoints = results.map((res, idx) => ({ ...res, idx })).filter(r => r.score !== null && !isNaN(r.score));
        if (validPoints.length === 0) return "";
        const points = validPoints.map((res) => {
            const x = padding + (res.idx / (results.length - 1 || 1)) * (chartWidth - padding * 2);
            let val = res.score!;
            val = Math.max(minY, Math.min(maxY, val));
            const y = chartHeight - ((val - minY) / (maxY - minY)) * chartHeight;
            return `${x},${y}`;
        });
        return points.join(" ");
    };

    const getStats = (isRed: boolean) => {
        const sideResults = results.filter(r => r.isRedTurn === isRed);
        return {
            total: sideResults.length,
            good: sideResults.filter(r => r.quality === 'good').length,
            inaccuracy: sideResults.filter(r => r.quality === 'inaccuracy').length,
            mistake: sideResults.filter(r => r.quality === 'mistake').length,
            blunder: sideResults.filter(r => r.quality === 'blunder').length,
        };
    };

    const redStats = getStats(true);
    const blackStats = getStats(false);

    const getQualityColor = (q: string) => {
        switch (q) {
            case 'blunder': return '#dc2626';
            case 'mistake': return '#f97316';
            case 'inaccuracy': return '#eab308';
            default: return '#3b82f6';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh] mx-4">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity className="text-blue-500" />
                        全局形勢分析
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">

                    {/* Controls Split */}
                    {!isAnalyzing && results.length === 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950/50 p-6 rounded-xl border border-zinc-800">

                            {/* Cloud Option */}
                            <div className="flex flex-col gap-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-900/20 rounded-full text-blue-400">
                                        <Cloud size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-zinc-200">雲庫分析</h3>
                                        <p className="text-xs text-zinc-500">使用 ChessDB 雲端大數據，速度極快。</p>
                                    </div>
                                </div>
                                <button
                                    onClick={startCloudAnalysis}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                                >
                                    <Play size={18} fill="currentColor" /> 開始雲庫分析
                                </button>
                            </div>

                            {/* Local AI Option */}
                            <div className="flex flex-col gap-4 p-4 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-amber-900/20 rounded-full text-amber-400">
                                        <Cpu size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-zinc-200">AI 引擎分析</h3>
                                        <p className="text-xs text-zinc-500">使用本地 Pikafish 引擎，深度可自訂。</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-zinc-400">
                                        <span>搜索深度</span>
                                        <span className="text-amber-400 font-bold">{localDepth} 層</span>
                                    </div>
                                    <input
                                        type="range" min="10" max="25" step="1"
                                        value={localDepth}
                                        onChange={(e) => setLocalDepth(parseInt(e.target.value))}
                                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-zinc-600">
                                        <span>10 (快)</span>
                                        <span>25 (慢)</span>
                                    </div>
                                </div>
                                <button
                                    onClick={startLocalAnalysis}
                                    className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20"
                                >
                                    <Play size={18} fill="currentColor" /> 開始 AI 分析
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Progress & Stop */}
                    {isAnalyzing && (
                        <div className="space-y-3 bg-zinc-900 p-4 rounded-xl border border-zinc-800 animate-in fade-in">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-bold text-zinc-300 flex items-center gap-2">
                                    {analysisMode === 'cloud' ? <Cloud size={16} /> : <Cpu size={16} />}
                                    {currentStepInfo}
                                </span>
                                <span className="font-mono text-blue-400">{Math.round(progress)}%</span>
                            </div>
                            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                            <button
                                onClick={stopAnalysis}
                                className="w-full py-2 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 border border-zinc-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <StopCircle size={16} /> 停止分析
                            </button>
                        </div>
                    )}

                    {/* Results Chart (Only if we have results) */}
                    {(results.length > 0) && !isAnalyzing && (
                        <>
                            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 relative h-64 select-none group">
                                <svg width="100%" height="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
                                    <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" />
                                    <polyline points={getCoordinates()} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    {results.map((res, idx) => {
                                        if (res.score === null || isNaN(res.score)) return null;
                                        const x = padding + (idx / (results.length - 1 || 1)) * (chartWidth - padding * 2);
                                        let val = res.score;
                                        val = Math.max(-600, Math.min(600, val));
                                        const y = chartHeight - ((val + 600) / 1200) * chartHeight;
                                        const color = getQualityColor(res.quality);
                                        const isSelected = selectedIndex === idx;
                                        const isHovered = hoverIndex === idx;
                                        const r = (isHovered || isSelected) ? 6 : (res.quality !== 'good' ? 3.5 : 1.5);
                                        return (
                                            <g key={idx}>
                                                {isSelected && <circle cx={x} cy={y} r={12} fill={color} fillOpacity="0.3" className="animate-pulse" />}
                                                <circle cx={x} cy={y} r={r} fill={color} stroke={isSelected ? "#fff" : "none"} strokeWidth={isSelected ? 1.5 : 0} className="cursor-pointer transition-all" onMouseEnter={() => setHoverIndex(idx)} onMouseLeave={() => setHoverIndex(null)} onClick={() => handleJumpTo(idx, res.moveIndex)} />
                                            </g>
                                        );
                                    })}
                                </svg>
                                {hoverIndex !== null && results[hoverIndex] && (
                                    <div className="absolute top-2 right-2 bg-zinc-800/95 p-3 rounded border border-zinc-700 text-xs shadow-xl backdrop-blur-sm z-10 pointer-events-none min-w-[140px]">
                                        <div className="font-bold text-zinc-200 mb-1 border-b border-zinc-700 pb-1">
                                            第 {results[hoverIndex].moveIndex} 手 ({results[hoverIndex].isRedTurn ? '紅' : '黑'})
                                        </div>
                                        <div className="text-zinc-300 mb-1">{results[hoverIndex].moveNotation}</div>
                                        <div className={`font-mono font-bold ${results[hoverIndex].score! > 0 ? "text-red-400" : "text-green-400"}`}>
                                            評分: {results[hoverIndex].score}
                                        </div>
                                        {results[hoverIndex].deviation > 0 && (
                                            <div className="text-amber-500 mt-1">虧損: {results[hoverIndex].deviation}</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { setResults([]); }} // Reset to show selection menu
                                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-bold transition-colors border border-zinc-700"
                                >
                                    重新選擇分析模式
                                </button>
                                <button
                                    onClick={writeAnnotations}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
                                >
                                    <Edit3 size={18} /> 寫入註釋
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <StatCard title="紅方統計" stats={redStats} isRed={true} />
                                <StatCard title="黑方統計" stats={blackStats} isRed={false} />
                            </div>

                            {results.some(r => r.quality !== 'good') && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                                        <AlertTriangle size={16} /> 重點失誤回顧
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <div className="text-xs font-bold text-red-400 border-b border-zinc-800 pb-1 mb-2">紅方失誤</div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {results.map((res, idx) => {
                                                    if (!res.isRedTurn || res.quality === 'good') return null;
                                                    return <BadMoveItem key={res.nodeId} res={res} idx={idx} selectedIndex={selectedIndex} onJump={handleJumpTo} />;
                                                })}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="text-xs font-bold text-zinc-400 border-b border-zinc-800 pb-1 mb-2">黑方失誤</div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {results.map((res, idx) => {
                                                    if (res.isRedTurn || res.quality === 'good') return null;
                                                    return <BadMoveItem key={res.nodeId} res={res} idx={idx} selectedIndex={selectedIndex} onJump={handleJumpTo} />;
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const BadMoveItem: React.FC<{ res: AnalysisResult; idx: number; selectedIndex: number | null; onJump: (index: number, moveIndex: number) => void; }> = ({ res, idx, selectedIndex, onJump }) => {
    let borderColor = '', bgColor = '', textColor = '';
    if (res.quality === 'blunder') { borderColor = 'border-red-900/50'; bgColor = 'bg-red-950/30 hover:bg-red-900/20'; textColor = 'text-red-400'; }
    else if (res.quality === 'mistake') { borderColor = 'border-orange-900/50'; bgColor = 'bg-orange-950/30 hover:bg-orange-900/20'; textColor = 'text-orange-400'; }
    else { borderColor = 'border-yellow-900/50'; bgColor = 'bg-yellow-950/30 hover:bg-yellow-900/20'; textColor = 'text-yellow-400'; }
    const isSelected = selectedIndex === idx;
    return (
        <button onClick={() => onJump(idx, res.moveIndex)} className={`w-full px-3 py-2 rounded text-left border transition-all text-xs flex flex-col gap-1 ${borderColor} ${bgColor} ${textColor} ${isSelected ? 'ring-2 ring-white/50 scale-[1.02]' : 'opacity-90'}`}>
            <div className="font-bold flex justify-between w-full"><span>#{res.moveIndex} {res.moveNotation}</span></div>
            <div className="flex justify-between items-center opacity-80"><span className="font-mono">{res.score}分</span><span className="font-mono">虧:{res.deviation}</span></div>
        </button>
    );
};

const StatCard = ({ title, stats, isRed }: { title: string, stats: any, isRed: boolean }) => (
    <div className={`rounded-lg p-4 border ${isRed ? 'bg-red-950/10 border-red-900/20' : 'bg-zinc-950/50 border-zinc-800'}`}>
        <h3 className={`text-sm font-bold mb-3 flex justify-between ${isRed ? 'text-red-300' : 'text-zinc-300'}`}>{title} <span className="text-zinc-500 font-normal text-xs">{stats.total} 手</span></h3>
        <div className="space-y-2">
            <StatRow label="錯著 (>500)" count={stats.blunder} total={stats.total} color="bg-red-600" textColor="text-red-400" />
            <StatRow label="失著 (>200)" count={stats.mistake} total={stats.total} color="bg-orange-500" textColor="text-orange-400" />
            <StatRow label="緩著 (>50)" count={stats.inaccuracy} total={stats.total} color="bg-yellow-500" textColor="text-yellow-400" />
            <StatRow label="正常" count={stats.good} total={stats.total} color="bg-blue-600" textColor="text-blue-400" />
        </div>
    </div>
);

const StatRow = ({ label, count, total, color, textColor }: { label: string, count: number, total: number, color: string, textColor: string }) => {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className={`w-20 ${textColor} font-medium`}>{label}</span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${percent}%` }}></div></div>
            <span className="w-6 text-right font-mono text-zinc-300">{count}</span>
            <span className="w-8 text-right font-mono text-zinc-500">{percent}%</span>
        </div>
    );
};

export default AnalysisModal;
