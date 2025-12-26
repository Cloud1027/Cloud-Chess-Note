
import React, { useState } from 'react';
import { Activity, Cloud, Cpu, Play, StopCircle, RefreshCw, AlertTriangle, Edit3 } from 'lucide-react';
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
    onJumpToStep: (index: number) => void; // index in moves array
    localDepth: number;
    setLocalDepth: (depth: number) => void;
    isCompact?: boolean; // For mobile split view
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
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // --- Chart Logic ---
    const chartHeight = isCompact ? 150 : 220;
    const chartWidth = 600; // Use viewBox width
    const padding = 20;

    const getCoordinates = () => {
        if (results.length === 0) return "";
        const maxY = 600; const minY = -600;
        const validPoints = results.map((res, idx) => ({ ...res, idx })).filter(r => r.score !== null && !isNaN(r.score));
        if (validPoints.length === 0) return "";

        const points = validPoints.map((res) => {
            const x = padding + (res.idx / (results.length - 1 || 1)) * (chartWidth - padding * 2);
            let val = res.score!;

            // SCORE LOGIC:
            // Ensure Absolute Score: Red > 0 (Up), Black < 0 (Down).
            // Input `res.score` is currently handled by AnalysisModal to be Red Perspective?
            // Let's assume input is Red Perspective.
            val = Math.max(minY, Math.min(maxY, val));

            // Chart Y: 0 is Top (MaxY), Height is Bottom (MinY)
            const y = chartHeight - ((val - minY) / (maxY - minY)) * chartHeight;
            return `${x},${y}`;
        });
        return points.join(" ");
    };

    const getQualityColor = (q: string) => {
        switch (q) {
            case 'blunder': return '#dc2626';
            case 'mistake': return '#f97316';
            case 'inaccuracy': return '#eab308';
            default: return '#3b82f6';
        }
    };

    const handleJumpTo = (indexInResults: number, moveIndex: number) => {
        setSelectedIndex(indexInResults);
        onJumpToStep(moveIndex);
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

    // Initial View (Controls)
    if (!isAnalyzing && results.length === 0) {
        return (
            <div className={`grid gap-4 ${isCompact ? 'grid-cols-2 p-2' : 'grid-cols-1 md:grid-cols-2 p-6 bg-zinc-950/50 rounded-xl border border-zinc-800'}`}>
                {/* Cloud Option */}
                <div className={`flex flex-col gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 transition-colors ${isCompact ? 'text-xs' : ''}`}>
                    <div className="flex items-center gap-2">
                        <div className={`rounded-full text-blue-400 ${isCompact ? 'p-1.5 bg-blue-900/10' : 'p-3 bg-blue-900/20'}`}>
                            <Cloud size={isCompact ? 16 : 24} />
                        </div>
                        <div>
                            <h3 className={`font-bold text-zinc-200 ${isCompact ? 'text-sm' : ''}`}>雲庫分析</h3>
                            {!isCompact && <p className="text-xs text-zinc-500">使用 ChessDB 雲端大數據。</p>}
                        </div>
                    </div>
                    <button
                        onClick={startCloudAnalysis}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 mt-auto"
                    >
                        <Play size={14} fill="currentColor" /> 開始
                    </button>
                </div>

                {/* Local AI Option */}
                <div className={`flex flex-col gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition-colors ${isCompact ? 'text-xs' : ''}`}>
                    <div className="flex items-center gap-2">
                        <div className={`rounded-full text-amber-400 ${isCompact ? 'p-1.5 bg-amber-900/10' : 'p-3 bg-amber-900/20'}`}>
                            <Cpu size={isCompact ? 16 : 24} />
                        </div>
                        <div>
                            <h3 className={`font-bold text-zinc-200 ${isCompact ? 'text-sm' : ''}`}>AI 分析</h3>
                            {!isCompact && <p className="text-xs text-zinc-500">Pikafish 本地引擎。</p>}
                        </div>
                    </div>
                    {!isCompact && (
                        <div className="space-y-1 my-1">
                            <div className="flex justify-between text-xs text-zinc-400">
                                <span>深度</span>
                                <span className="text-amber-400 font-bold">{localDepth}</span>
                            </div>
                            <input
                                type="range" min="10" max="25" step="1"
                                value={localDepth}
                                onChange={(e) => setLocalDepth(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                        </div>
                    )}
                    <button
                        onClick={startLocalAnalysis}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20 mt-auto"
                    >
                        <Play size={14} fill="currentColor" /> 開始
                    </button>
                </div>
            </div>
        );
    }

    // Analyzing + Results View
    return (
        <div className={`flex flex-col ${isCompact ? 'h-full' : 'space-y-6'}`}>
            {/* Progress Bar (Only when analyzing) */}
            {isAnalyzing && (
                <div className="space-y-2 bg-zinc-900 p-3 rounded-lg border border-zinc-800 shrink-0">
                    <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-zinc-300 flex items-center gap-2">
                            {analysisMode === 'cloud' ? <Cloud size={14} /> : <Cpu size={14} />}
                            {isCompact ? "分析中..." : currentStepInfo}
                        </span>
                        <span className="font-mono text-blue-400">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                    </div>
                    <button
                        onClick={stopAnalysis}
                        className="w-full py-1.5 bg-zinc-800 hover:bg-red-900/30 text-zinc-400 hover:text-red-400 border border-zinc-700 rounded font-medium transition-colors flex items-center justify-center gap-2 text-xs"
                    >
                        <StopCircle size={14} /> 停止
                    </button>
                </div>
            )}

            {/* Results */}
            {results.length > 0 && !isAnalyzing && (
                <div className={`flex flex-col ${isCompact ? 'h-full overflow-hidden' : 'space-y-6'}`}>
                    {/* Graph Area */}
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-2 relative shrink-0 select-none group overflow-hidden">
                        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="overflow-visible block">
                            {/* Zero Line */}
                            <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#3f3f46" strokeWidth="1" strokeDasharray="4 4" />

                            {/* Curve */}
                            <polyline points={getCoordinates()} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

                            {/* Points */}
                            {results.map((res, idx) => {
                                if (res.score === null || isNaN(res.score)) return null;
                                const x = padding + (idx / (results.length - 1 || 1)) * (chartWidth - padding * 2);
                                let val = res.score;
                                val = Math.max(-600, Math.min(600, val));
                                const y = chartHeight - ((val + 600) / 1200) * chartHeight;
                                const color = getQualityColor(res.quality);
                                const isSelected = selectedIndex === idx;
                                const isHovered = hoverIndex === idx;
                                const r = (isHovered || isSelected) ? 6 : (res.quality !== 'good' ? 3.5 : 1.5); // Scaled for viewBox? No, SVG units.

                                // Adjust 'r' if SVG is scaling? PreserveAspectRatio none might distort circles if we don't handle it.
                                // Actually, circles will stretch if aspect ratio is not 1.
                                // Solution: Use a separate <g> evaluated in logic or rely on uniform scaling.
                                // For simplicity here we assume standard scaling.

                                return (
                                    <g key={idx}>
                                        {isSelected && <circle cx={x} cy={y} r={12} fill={color} fillOpacity="0.3" className="animate-pulse" />}
                                        <circle
                                            cx={x} cy={y} r={r}
                                            fill={color} stroke={isSelected ? "#fff" : "none"} strokeWidth={isSelected ? 1.5 : 0}
                                            className="cursor-pointer transition-all hover:r-8"
                                            onMouseEnter={() => setHoverIndex(idx)}
                                            onMouseLeave={() => setHoverIndex(null)}
                                            onClick={() => handleJumpTo(idx, res.moveIndex)}
                                        />
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Hover Tooltip - Absolute Position */}
                        {hoverIndex !== null && results[hoverIndex] && (
                            <div className="absolute top-2 right-2 bg-zinc-800/95 p-2 rounded border border-zinc-700 text-[10px] md:text-xs shadow-xl backdrop-blur-sm z-10 pointer-events-none min-w-[100px]">
                                <div className="font-bold text-zinc-200 mb-1 border-b border-zinc-700 pb-1">
                                    #{results[hoverIndex].moveIndex} ({results[hoverIndex].isRedTurn ? '紅' : '黑'})
                                </div>
                                <div className={`font-mono font-bold ${results[hoverIndex].score! > 0 ? "text-red-400" : "text-green-400"}`}>
                                    {results[hoverIndex].score}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Report Content */}
                    <div className={`flex-1 overflow-y-auto ${isCompact ? 'mt-2 space-y-2' : 'space-y-4'}`}>
                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setResults([])}
                                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-bold border border-zinc-700"
                            >
                                <RefreshCw size={14} className="inline mr-1" /> 重選
                            </button>
                            <button
                                onClick={writeAnnotations}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold shadow"
                            >
                                <Edit3 size={14} className="inline mr-1" /> 寫入
                            </button>
                        </div>

                        {/* Stats Cards */}
                        <div className={`grid ${isCompact ? 'grid-cols-2 gap-2' : 'grid-cols-1 md:grid-cols-2 gap-4'}`}>
                            <StatCard title="紅方" stats={redStats} isRed={true} compact={isCompact} />
                            <StatCard title="黑方" stats={blackStats} isRed={false} compact={isCompact} />
                        </div>

                        {/* Blunder Review List */}
                        {results.some(r => r.quality !== 'good') && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                                    <AlertTriangle size={14} /> 失誤列表
                                </h3>
                                <div className="space-y-1">
                                    {results.map((res, idx) => {
                                        if (res.quality === 'good') return null;
                                        return <BadMoveItem key={res.nodeId} res={res} idx={idx} selectedIndex={selectedIndex} onJump={handleJumpTo} />;
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
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
        <button onClick={() => onJump(idx, res.moveIndex)} className={`w-full px-2 py-1.5 rounded text-left border transition-all text-[10px] md:text-xs flex items-center justify-between gap-2 ${borderColor} ${bgColor} ${textColor} ${isSelected ? 'ring-1 ring-white/50' : 'opacity-90'}`}>
            <span className="font-bold shrink-0">#{res.moveIndex} {res.moveNotation}</span>
            <span className="font-mono opacity-80">{res.score} (虧{res.deviation})</span>
        </button>
    );
};

const StatCard = ({ title, stats, isRed, compact }: { title: string, stats: any, isRed: boolean, compact: boolean }) => (
    <div className={`rounded p-2 border ${isRed ? 'bg-red-950/10 border-red-900/20' : 'bg-zinc-950/50 border-zinc-800'}`}>
        <h3 className={`font-bold mb-2 flex justify-between items-center ${isRed ? 'text-red-300' : 'text-zinc-300'} ${compact ? 'text-xs' : 'text-sm'}`}>{title} <span className="text-zinc-500 font-normal text-[10px]">{stats.total}</span></h3>
        <div className="space-y-1">
            <StatRow label="錯" count={stats.blunder} total={stats.total} color="bg-red-600" textColor="text-red-400" />
            <StatRow label="失" count={stats.mistake} total={stats.total} color="bg-orange-500" textColor="text-orange-400" />
            <StatRow label="緩" count={stats.inaccuracy} total={stats.total} color="bg-yellow-500" textColor="text-yellow-400" />
        </div>
    </div>
);

const StatRow = ({ label, count, total, color, textColor }: { label: string, count: number, total: number, color: string, textColor: string }) => {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="flex items-center gap-1 text-[10px]">
            <span className={`w-4 ${textColor} font-medium`}>{label}</span>
            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${percent}%` }}></div></div>
            <span className="w-5 text-right font-mono text-zinc-500">{count}</span>
        </div>
    );
};
