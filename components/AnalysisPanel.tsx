import React, { useState } from 'react';
import { Cloud, Cpu, StopCircle, Edit3 } from 'lucide-react';
import { AnalysisResult } from '../types';

interface AnalysisPanelProps {
    isAnalyzing: boolean;
    analysisMode: 'cloud' | 'local';
    currentStepInfo: string;
    progress: number;
    results: AnalysisResult[];
    setResults: (results: AnalysisResult[]) => void;
    startCloudAnalysis: () => void;
    startLocalAnalysis: () => void;
    stopAnalysis: () => void;
    writeAnnotations: () => void;
    onJumpToStep: (index: number) => void;
    onJumpToNode?: (nodeId: string) => void; // New: jump by nodeId for variation support
    localDepth: number;
    setLocalDepth: (depth: number) => void;
    isCompact?: boolean;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
    isAnalyzing,
    analysisMode,
    currentStepInfo,
    progress,
    results,
    setResults,
    startCloudAnalysis,
    startLocalAnalysis,
    stopAnalysis,
    writeAnnotations,
    onJumpToStep,
    localDepth,
    setLocalDepth,
    isCompact = false,
    onJumpToNode
}) => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [errorTab, setErrorTab] = useState<'red' | 'black'>('red');
    const [mobileTab, setMobileTab] = useState<'graph' | 'report' | 'errors'>('graph');

    const redStats = { mistake: 0, blunder: 0, inaccuracy: 0, win: 0, total: 0 };
    const blackStats = { mistake: 0, blunder: 0, inaccuracy: 0, win: 0, total: 0 };

    results.forEach(r => {
        if (r.score !== null) {
            if (r.isRedTurn) redStats.total++; else blackStats.total++;
            if (r.quality === 'mistake') r.isRedTurn ? redStats.mistake++ : blackStats.mistake++;
            if (r.quality === 'blunder') r.isRedTurn ? redStats.blunder++ : blackStats.blunder++;
            if (r.quality === 'inaccuracy') r.isRedTurn ? redStats.inaccuracy++ : blackStats.inaccuracy++;
        }
    });

    // Jump using nodeId for proper variation support
    const handleJumpTo = (indexInResults: number, nodeId: string) => {
        setSelectedIndex(indexInResults);
        if (onJumpToNode) {
            onJumpToNode(nodeId); // Prefer nodeId for accurate jumping
        }
    };

    // --- Y-Axis Scale Logic ---
    const [yMax, setYMax] = useState<500 | 1000 | 2000>(500);

    const toggleYScale = () => {
        setYMax(prev => {
            if (prev === 500) return 1000;
            if (prev === 1000) return 2000;
            return 500;
        });
    };

    const chartWidth = 600; // Fixed width for coordinate calculation, SVG scales via viewBox/width=100%
    const scaleX = 1; // No zoom
    const offsetX = 0; // No pan

    const getX = (i: number, total: number) => {
        return (i / (total - 1 || 1)) * chartWidth;
    };

    // --- Chart Logic ---
    const chartHeight = isCompact ? 150 : 200;

    // Simple linear mapping: [-yMax, yMax] -> [chartHeight, 0]
    // yMax (Red Advantage) -> top (Y=0)
    // -yMax (Black Advantage) -> bottom (Y=chartHeight)
    // 0 -> middle (Y=chartHeight/2)
    const mapScoreToY = (score: number) => {
        // Clamp score to [-yMax, yMax]
        const clamped = Math.max(-yMax, Math.min(yMax, score));
        // Normalize to [-1, 1]
        const normalized = clamped / yMax;
        // Map to [chartHeight, 0]: when normalized=1 (yMax), Y=0; when normalized=-1 (-yMax), Y=chartHeight
        return chartHeight * (0.5 - normalized * 0.5);
    };

    const pointsPath = results
        .filter(r => r.score !== null && !isNaN(r.score))
        .map((res, i) => {
            const xIdx = (i / (results.filter(r => r.score !== null).length - 1 || 1)) * chartWidth;

            // Convert to Red Advantage Score
            // Note: useAnalysis results are ALREADY Red-Relative (Absolute)
            const redAdvScore = res.score!;

            const y = mapScoreToY(redAdvScore);
            const cmd = i === 0 ? 'M' : 'L';
            return `${cmd} ${xIdx},${y}`;
        }).join(" ");

    // Zero Line Y
    const zeroY = chartHeight / 2; // Symmetric Center

    // -- Sub-renderers --

    const renderControls = () => (
        <div className="flex gap-2 items-center flex-wrap shrink-0">
            {/* Controls moved to Modal */}
            {isAnalyzing && (
                <div className="flex gap-2 w-full">
                    <div className="text-xs text-zinc-400 flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded border border-zinc-800 flex-1">
                        {analysisMode === 'cloud' ? <Cloud size={14} className="text-blue-500" /> : <Cpu size={14} className="text-amber-500" />}
                        <span className="truncate">{currentStepInfo}</span>
                    </div>
                    <button onClick={stopAnalysis} className="bg-red-900/50 hover:bg-red-900 text-red-200 px-3 py-1 rounded text-xs border border-red-800">
                        <StopCircle size={14} />
                    </button>
                </div>
            )}
        </div>
    );

    const renderChart = () => (
        <div
            className="relative bg-zinc-950 rounded border border-zinc-800 select-none h-full flex flex-col justify-center overflow-hidden group touch-none"
        // Zoom removed
        >
            {results.length > 0 ? (
                <>
                    {/* Y-Scale Toggle Button */}
                    <button
                        onClick={toggleYScale}
                        className="absolute top-2 left-2 z-10 text-[10px] text-zinc-400 bg-zinc-900/80 hover:bg-zinc-800 px-2 py-1 rounded border border-zinc-700 transition-colors flex items-center gap-1 shadow-lg"
                        title="切換分數顯示範圍"
                    >
                        <span>縮放:</span>
                        <span className="font-bold text-zinc-200">±{yMax}</span>
                    </button>

                    <div className="flex-1 w-full relative h-full">
                        <svg width="100%" height="100%" className="overflow-visible" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                            <g>
                                {/* Mid Line */}
                                <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" />

                                {/* Chart Line */}
                                <path d={pointsPath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-lg" vectorEffect="non-scaling-stroke" />

                                {/* Interactive Points */}
                                {results.filter(r => r.score !== null).map((res, i, arr) => {
                                    const x = getX(i, arr.length);
                                    const y = mapScoreToY(res.score!);

                                    // Error Colors: Purple=Blunder, Orange=Mistake, Silver=Inaccuracy
                                    const isError = res.quality === 'blunder' || res.quality === 'mistake' || res.quality === 'inaccuracy';
                                    let color = '#3b82f6'; // Default Blue
                                    if (res.quality === 'blunder') color = '#a855f7'; // Purple
                                    if (res.quality === 'mistake') color = '#f97316'; // Orange
                                    if (res.quality === 'inaccuracy') color = '#94a3b8'; // Silver

                                    const isSelected = selectedIndex === i;

                                    return (
                                        <g key={i} onClick={() => handleJumpTo(i, res.nodeId)} className="cursor-pointer group">
                                            {/* Hit Area */}
                                            <rect x={x - 5} y={0} width={10} height={chartHeight} fill="transparent" />

                                            {/* Point */}
                                            <circle
                                                cx={x} cy={y}
                                                r={isSelected ? 5 : (isError ? 3 : 1.5)}
                                                fill={color}
                                                className={`transition-all duration-200 ${isSelected ? 'breathing-glow' : ''} ${!isError && !isSelected ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
                                                stroke={isSelected ? '#fff' : 'rgba(0,0,0,0.5)'}
                                                strokeWidth={isSelected ? 2 : (isError ? 1 : 0)}
                                            />
                                            {/* Breathing glow effect for selected point */}
                                            {isSelected && (
                                                <circle
                                                    cx={x} cy={y}
                                                    r={8}
                                                    fill="none"
                                                    stroke={color}
                                                    strokeWidth={2}
                                                    className="breathing-ring"
                                                    opacity={0.6}
                                                />
                                            )}
                                        </g>
                                    );
                                })}
                            </g>
                        </svg>
                    </div>

                    {/* Y-Axis Labels (Right Side) */}
                    <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between text-[9px] text-zinc-600 font-mono py-1 z-0 pointer-events-none text-right pr-1 border-r border-zinc-800/20 select-none bg-gradient-to-l from-zinc-900/50 to-transparent">
                        <span>+{yMax}</span>
                        <span>+{yMax / 2}</span>
                        <span className="opacity-0">0</span>
                        <span>-{yMax / 2}</span>
                        <span>-{yMax}</span>
                    </div>
                </>
            ) : (
                <div className="text-zinc-500 text-xs text-center">暫無數據，請點擊上方按鈕開始分析</div>
            )}
        </div>
    );

    const renderStats = () => (
        <div className="grid grid-cols-2 gap-2 text-xs shrink-0">
            <StatCard title="紅方統計" stats={redStats} isRed={true} />
            <StatCard title="黑方統計" stats={blackStats} isRed={false} />
        </div>
    );

    const filteredBadMoves = results.map((res, idx) => ({ res, idx }))
        .filter(item => item.res.isRedTurn === (errorTab === 'red') && item.res.quality !== 'good');

    const renderErrorList = () => (
        <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-900 rounded-lg border border-zinc-800 flex flex-col">
            <div className="flex border-b border-zinc-800 shrink-0">
                <button onClick={() => setErrorTab('red')} className={`flex-1 py-2 text-xs font-bold transition-colors ${errorTab === 'red' ? 'bg-red-900/20 text-red-400 border-b-2 border-red-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    紅方錯誤 ({redStats.mistake + redStats.blunder})
                </button>
                <button onClick={() => setErrorTab('black')} className={`flex-1 py-2 text-xs font-bold transition-colors ${errorTab === 'black' ? 'bg-zinc-800/50 text-zinc-300 border-b-2 border-black' : 'text-zinc-500 hover:text-zinc-300'}`}>
                    黑方錯誤 ({blackStats.mistake + blackStats.blunder})
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 relative">
                {filteredBadMoves.length > 0 ? (
                    <div className="space-y-1 pb-4">
                        {filteredBadMoves.map(({ res, idx }) => (
                            <BadMoveItem key={res.nodeId} res={res} idx={idx} selectedIndex={selectedIndex} onJump={handleJumpTo} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 text-xs text-zinc-500 absolute inset-0 flex items-center justify-center">
                        此方無明顯失誤
                    </div>
                )}
            </div>
        </div>
    );

    // --- Compact Mode ---
    if (isCompact) {
        return (
            <div className="flex flex-col h-full gap-2 relative">
                {renderControls()}
                {isAnalyzing && <div className="text-[10px] text-zinc-500 text-center animate-pulse -mt-1">{currentStepInfo}</div>}
                <div className="flex bg-zinc-900 rounded-lg overflow-hidden shrink-0 border border-zinc-800 p-0.5 gap-0.5">
                    <button onClick={() => setMobileTab('graph')} className={`flex-1 py-1.5 text-xs rounded-md transition-all ${mobileTab === 'graph' ? 'bg-zinc-700 text-white font-bold shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        局勢圖
                    </button>
                    <button onClick={() => setMobileTab('report')} className={`flex-1 py-1.5 text-xs rounded-md transition-all ${mobileTab === 'report' ? 'bg-zinc-700 text-white font-bold shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        報告
                    </button>
                    <button onClick={() => setMobileTab('errors')} className={`flex-1 py-1.5 text-xs rounded-md transition-all ${mobileTab === 'errors' ? 'bg-zinc-700 text-white font-bold shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>
                        錯誤列表
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto min-h-0 relative bg-zinc-950/30 rounded-lg">
                    {mobileTab === 'graph' && (<div className="h-full">{renderChart()}</div>)}
                    {mobileTab === 'report' && (
                        <div className="space-y-3 p-2 h-full overflow-y-auto">
                            {renderStats()}
                            <div className="p-3 bg-zinc-900 rounded border border-zinc-800 text-xs text-zinc-400 leading-relaxed">
                                <h4 className="font-bold text-zinc-200 mb-2">分析摘要</h4>
                                <p>總計分析 {Math.ceil(results.length / 2)} 回合。</p>
                                <p>紅方失誤率: {redStats.total > 0 ? Math.round(((redStats.mistake + redStats.blunder) / redStats.total) * 100) : 0}%</p>
                                <p>黑方失誤率: {blackStats.total > 0 ? Math.round(((blackStats.mistake + blackStats.blunder) / blackStats.total) * 100) : 0}%</p>
                            </div>
                            <button onClick={writeAnnotations} className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95 transition-all">
                                <Edit3 size={16} /> 寫入棋譜註釋
                            </button>
                        </div>
                    )}
                    {mobileTab === 'errors' && renderErrorList()}
                </div>
            </div>
        );
    }

    // --- Desktop Mode ---
    return (
        <div className="flex flex-col h-full gap-4 p-2">
            {renderControls()}
            {isAnalyzing && <div className="text-xs text-zinc-500 text-center animate-pulse">{currentStepInfo}</div>}
            <div className="h-48 shrink-0">
                {renderChart()}
            </div>
            {renderStats()}
            {renderErrorList()}
            <button onClick={writeAnnotations} className="py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-sm text-zinc-300 flex items-center justify-center gap-2 transition-colors">
                <Edit3 size={16} /> 將分析結果寫入棋譜註釋
            </button>

            {/* Breathing animation styles */}
            <style>{`
                @keyframes breathing-ring-animation {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.3); opacity: 0.2; }
                }
                .breathing-ring {
                    animation: breathing-ring-animation 1.5s ease-in-out infinite;
                    transform-origin: center;
                    transform-box: fill-box;
                }
                .breathing-glow {
                    filter: drop-shadow(0 0 3px currentColor);
                }
            `}</style>
        </div>
    );
};

const BadMoveItem: React.FC<{ res: AnalysisResult; idx: number; selectedIndex: number | null; onJump: (index: number, nodeId: string) => void; }> = ({ res, idx, selectedIndex, onJump }) => {
    let borderColor = '', bgColor = '', textColor = '';
    if (res.quality === 'blunder') { borderColor = 'border-purple-900/50'; bgColor = 'bg-purple-950/30 hover:bg-purple-900/20'; textColor = 'text-purple-400'; }
    else if (res.quality === 'mistake') { borderColor = 'border-orange-900/50'; bgColor = 'bg-orange-950/30 hover:bg-orange-900/20'; textColor = 'text-orange-400'; }
    else { borderColor = 'border-zinc-700/50'; bgColor = 'bg-zinc-800/30 hover:bg-zinc-700/20'; textColor = 'text-zinc-400'; }
    const isSelected = selectedIndex === idx;
    const roundNum = Math.ceil(res.moveIndex / 2);
    return (
        <button onClick={() => onJump(idx, res.nodeId)} className={`w-full px-2 py-2.5 rounded text-left border transition-all text-[11px] md:text-xs flex items-center justify-between gap-2 ${borderColor} ${bgColor} ${textColor} ${isSelected ? 'ring-1 ring-white/50 bg-opacity-70' : 'opacity-90'}`}>
            <span className="font-bold shrink-0 flex items-center gap-2">
                <span className="opacity-60 font-mono w-6 text-right">{roundNum}</span>
                <span>{res.moveNotation}</span>
            </span>
            <span className="font-mono opacity-80 flex items-center gap-1">
                <span>{res.score}</span>
                <span className="opacity-60 text-[10px]">(虧{res.deviation})</span>
            </span>
        </button>
    );
};

const StatCard = ({ title, stats, isRed, compact = false }: { title: string, stats: any, isRed: boolean, compact?: boolean }) => (
    <div className={`p-2 rounded border flex flex-col gap-1 ${isRed ? 'bg-red-950/20 border-red-900/30' : 'bg-zinc-900 border-zinc-800'}`}>
        <div className="flex justify-between items-center">
            <span className={`font-bold ${isRed ? 'text-red-400' : 'text-zinc-400'}`}>{title}</span>
            <span className="text-[10px] opacity-60">共 {Math.ceil(stats.total / 2)} 回合</span>
        </div>
        <div className="flex gap-2 mt-1">
            <StatBadge label="錯" count={stats.blunder} color="bg-purple-500/10 text-purple-400 border-purple-500/30" />
            <StatBadge label="失" count={stats.mistake} color="bg-orange-500/10 text-orange-400 border-orange-500/30" />
            <StatBadge label="緩" count={stats.inaccuracy} color="bg-zinc-500/10 text-zinc-400 border-zinc-500/30" />
        </div>
    </div>
);

const StatBadge = ({ label, count, color }: { label: string, count: number, color: string }) => (
    <div className={`flex-1 flex flex-col items-center justify-center p-1 rounded border ${color}`}>
        <span className="text-[10px] opacity-70">{label}</span>
        <span className="font-bold text-xs">{count}</span>
    </div>
);
