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
    isCompact = false
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

    const handleJumpTo = (indexInResults: number, moveIndex: number) => {
        setSelectedIndex(indexInResults);
        if (onJumpToStep) onJumpToStep(moveIndex);
    };

    // --- Chart Logic (Non-Linear Scale) ---
    const chartHeight = isCompact ? 150 : 200;
    const chartWidth = 600;
    const padding = 0; // Full width

    // Scale Config (Symmetric Non-Linear)
    // Zone 1 (Top 10%): 500 to 2000+
    // Zone 2 (Mid 80%): -500 to 500
    // Zone 3 (Bot 10%): -2000+ to -500
    const midZonePct = 0.8;
    const edgeZonePct = 0.1;
    const scoreThreshold = 500;
    const scoreMaxVisual = 2000; // Cap for linear interpolation in edge zones

    const mapScoreToY = (redAdvScore: number) => {
        // Red Superiority (Positive) -> Top (Y=0)
        // Black Superiority (Negative) -> Bottom (Y=Height)

        // Mid Zone: [-500, 500]
        if (redAdvScore >= -scoreThreshold && redAdvScore <= scoreThreshold) {
            // Map [-500, 500] to [0.9H, 0.1H] (0 is Top)
            // 500 -> 0.1H
            // -500 -> 0.9H

            // Normalize score (-500 to 500) to 0..1
            // (score - min) / (max - min)
            // (score + 500) / 1000
            // ratio 1.0 -> 0.1H (Top)
            // ratio 0.0 -> 0.9H (Bottom)

            const ratio = (redAdvScore + scoreThreshold) / (scoreThreshold * 2);
            // Y = 0.9 - ratio * 0.8
            return chartHeight * (0.9 - ratio * 0.8);
        }

        // Top Zone (Red Adv > 500) -> [0.1H, 0.0H]
        if (redAdvScore > scoreThreshold) {
            const cappedScore = Math.min(redAdvScore, scoreMaxVisual);
            const ratio = (cappedScore - scoreThreshold) / (scoreMaxVisual - scoreThreshold);
            return chartHeight * (0.1 - ratio * 0.1);
        }

        // Bottom Zone (Black Adv > 500 => redAdvScore < -500) -> [0.9H, 1.0H]
        if (redAdvScore < -scoreThreshold) {
            const cappedScore = Math.max(redAdvScore, -scoreMaxVisual);
            // -500 -> 0.9H
            // -2000 -> 1.0H
            // abs(s): 500 -> 2000
            const absScore = Math.abs(cappedScore);
            const ratio = (absScore - scoreThreshold) / (scoreMaxVisual - scoreThreshold);
            return chartHeight * (0.9 + ratio * 0.1);
        }
        return chartHeight / 2;
    };

    const pointsPath = results
        .filter(r => r.score !== null && !isNaN(r.score))
        .map((res, i) => {
            const xIdx = (i / (results.filter(r => r.score !== null).length - 1 || 1)) * chartWidth;

            // Convert to Red Advantage Score
            const redAdvScore = res.isRedTurn ? (res.score!) : -(res.score!);

            const y = mapScoreToY(redAdvScore);
            const cmd = i === 0 ? 'M' : 'L';
            return `${cmd} ${xIdx},${y}`;
        }).join(" ");

    // Zero Line Y
    const zeroY = chartHeight / 2; // Symmetric Center

    // -- Sub-renderers --

    const renderControls = () => (
        <div className="flex gap-2 items-center flex-wrap shrink-0">
            {!isAnalyzing ? (
                <>
                    <button onClick={startCloudAnalysis} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-2 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">
                        <Cloud size={14} /> 雲庫
                    </button>
                    <button onClick={startLocalAnalysis} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white px-2 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">
                        <Cpu size={14} /> 引擎
                    </button>
                    <div className="flex items-center gap-1 bg-zinc-800 rounded px-2 py-1">
                        <span className="text-[10px] text-zinc-400">深度</span>
                        <input type="number" min="5" max="25" value={localDepth} onChange={e => setLocalDepth(Number(e.target.value))} className="w-8 bg-transparent text-center text-xs font-mono focus:outline-none text-amber-400" />
                    </div>
                </>
            ) : (
                <div className="flex-1 flex gap-2 items-center p-1 bg-zinc-900 rounded border border-zinc-800">
                    <button onClick={stopAnalysis} className="px-3 py-1 bg-red-600/20 text-red-500 border border-red-600/50 rounded text-xs animate-pulse font-bold flex items-center gap-1 hover:bg-red-600/30">
                        <StopCircle size={14} /> 停止
                    </button>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[10px] tabular-nums text-zinc-400 w-8 text-right bg-transparent">{Math.round(progress)}%</span>
                </div>
            )}
        </div>
    );

    const renderChart = () => (
        <div className="relative bg-zinc-950 rounded border border-zinc-800 select-none h-full flex flex-col justify-center overflow-hidden">
            {results.length > 0 ? (
                <>
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible preserve-3d absolute inset-0 z-10">
                        {/* Zero Line - Always Center */}
                        <line x1={0} y1={zeroY} x2={chartWidth} y2={zeroY} stroke="#444" strokeDasharray="4" strokeWidth="1" />

                        {/* Path */}
                        <path d={pointsPath} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

                        {/* Interactive Points */}
                        {results.filter(r => r.score !== null).map((res, i, arr) => {
                            const x = (i / (arr.length - 1 || 1)) * chartWidth;
                            // Convert to Red Advantage
                            // Note: useAnalysis results are ALREADY Red-Relative (Absolute)
                            const redAdvScore = res.score!;
                            const y = mapScoreToY(redAdvScore);

                            // Highlight critical errors
                            const isError = res.quality === 'blunder' || res.quality === 'mistake';
                            const color = res.quality === 'blunder' ? '#ef4444' : (res.quality === 'mistake' ? '#f97316' : '#fbbf24');
                            const isSelected = selectedIndex === i;

                            return (
                                <g key={i} onClick={() => handleJumpTo(i, res.moveIndex)} className="cursor-pointer group">
                                    <rect x={x - 5} y={0} width={10} height={chartHeight} fill="transparent" />
                                    <circle cx={x} cy={y} r={selectedIndex === i ? 4 : (isError ? 3 : 0)} fill={isError ? color : '#3b82f6'} className="transition-all duration-200" stroke={isSelected ? '#fff' : 'none'} strokeWidth={isSelected ? 1.5 : 0} />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Y-Axis Labels (Right Side) */}
                    <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-between text-[9px] text-zinc-500 font-mono py-1 z-0 pointer-events-none text-right pr-1 border-r border-zinc-800/50">
                        <span>+2000</span>
                        <span>+500</span>
                        <span>0</span>
                        <span>-500</span>
                        <span>-2000</span>
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
        </div>
    );
};

const BadMoveItem: React.FC<{ res: AnalysisResult; idx: number; selectedIndex: number | null; onJump: (index: number, moveIndex: number) => void; }> = ({ res, idx, selectedIndex, onJump }) => {
    let borderColor = '', bgColor = '', textColor = '';
    if (res.quality === 'blunder') { borderColor = 'border-red-900/50'; bgColor = 'bg-red-950/30 hover:bg-red-900/20'; textColor = 'text-red-400'; }
    else if (res.quality === 'mistake') { borderColor = 'border-orange-900/50'; bgColor = 'bg-orange-950/30 hover:bg-orange-900/20'; textColor = 'text-orange-400'; }
    else { borderColor = 'border-yellow-900/50'; bgColor = 'bg-yellow-950/30 hover:bg-yellow-900/20'; textColor = 'text-yellow-400'; }
    const isSelected = selectedIndex === idx;
    const roundNum = Math.ceil(res.moveIndex / 2);
    return (
        <button onClick={() => onJump(idx, res.moveIndex)} className={`w-full px-2 py-2.5 rounded text-left border transition-all text-[11px] md:text-xs flex items-center justify-between gap-2 ${borderColor} ${bgColor} ${textColor} ${isSelected ? 'ring-1 ring-white/50 bg-opacity-70' : 'opacity-90'}`}>
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
            <StatBadge label="錯" count={stats.blunder} color="bg-red-500/10 text-red-500 border-red-500/30" />
            <StatBadge label="失" count={stats.mistake} color="bg-orange-500/10 text-orange-500 border-orange-500/30" />
            <StatBadge label="緩" count={stats.inaccuracy} color="bg-yellow-500/10 text-yellow-500 border-yellow-500/30" />
        </div>
    </div>
);

const StatBadge = ({ label, count, color }: { label: string, count: number, color: string }) => (
    <div className={`flex-1 flex flex-col items-center justify-center p-1 rounded border ${color}`}>
        <span className="text-[10px] opacity-70">{label}</span>
        <span className="font-bold text-xs">{count}</span>
    </div>
);
