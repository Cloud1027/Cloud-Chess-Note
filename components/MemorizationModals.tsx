
import React, { useState } from 'react';
import { BookOpen, Play, CheckCircle, AlertTriangle, X, Copy, Check } from 'lucide-react';
import { MemorizationConfig, MemorizationError, MoveNode } from '../types';

// --- Setup Modal ---

interface MemSetupProps {
    isOpen: boolean;
    onClose: () => void;
    onStart: (config: Omit<MemorizationConfig, 'active'>) => void;
}

export const MemorizationSetupModal: React.FC<MemSetupProps> = ({ isOpen, onClose, onStart }) => {
    const [side, setSide] = useState<MemorizationConfig['side']>('red');
    const [mode, setMode] = useState<MemorizationConfig['mode']>('main');
    const [range, setRange] = useState<string>(''); // Empty = All

    if (!isOpen) return null;

    const handleStart = () => {
        onStart({ side, mode, randomRange: range });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <BookOpen className="text-amber-500" size={20} />
                        背譜模式設定
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>
                
                <div className="p-5 space-y-6">
                    {/* Side Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-zinc-400">選擇執方</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['red', 'black', 'both'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSide(s)}
                                    className={`py-2 px-1 rounded-lg text-sm font-bold border transition-all ${side === s ? 'bg-amber-600/20 border-amber-500 text-amber-400' : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                                >
                                    {s === 'red' ? '執紅' : s === 'black' ? '執黑' : '雙方'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mode Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-zinc-400">電腦回應模式</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setMode('main')}
                                className={`py-2 rounded-lg text-sm font-bold border transition-all ${mode === 'main' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                            >
                                強制主變
                            </button>
                            <button
                                onClick={() => setMode('random')}
                                className={`py-2 rounded-lg text-sm font-bold border transition-all ${mode === 'random' ? 'bg-purple-600/20 border-purple-500 text-purple-400' : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                            >
                                隨機變著
                            </button>
                        </div>
                    </div>

                    {/* Random Range (Only if Random) */}
                    {mode === 'random' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2">
                            <label className="text-sm font-bold text-zinc-400 flex justify-between">
                                隨機範圍 (變著順序)
                                <span className="text-xs font-normal text-zinc-500">留空代表全部</span>
                            </label>
                            <input 
                                type="text"
                                value={range}
                                onChange={(e) => setRange(e.target.value.toUpperCase())}
                                placeholder="例如: A-C 或 A,B,D"
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-purple-500 uppercase font-mono placeholder:normal-case"
                            />
                            <p className="text-xs text-zinc-500">
                                * 將從棋譜樹中標記為 A, B, C... 的變著中隨機選擇
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white">取消</button>
                    <button onClick={handleStart} className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold shadow-lg shadow-amber-900/20 flex items-center gap-2">
                        <Play size={16} fill="currentColor" /> 開始
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Report Modal ---

interface MemReportProps {
    isOpen: boolean;
    onClose: () => void;
    errors: MemorizationError[];
    totalSteps: number;
    activePath: MoveNode[]; // Full path played
    startNodeId: string;    // ID where memorization started
    endNodeId: string;      // ID where memorization ended
}

export const MemorizationReportModal: React.FC<MemReportProps> = ({ 
    isOpen, 
    onClose, 
    errors, 
    totalSteps,
    activePath,
    startNodeId,
    endNodeId
}) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const totalErrors = errors.reduce((acc, curr) => acc + curr.count, 0);
    const successRate = Math.max(0, Math.round(((totalSteps - totalErrors) / Math.max(totalSteps, 1)) * 100));
    
    // Determine grade
    let grade = 'S';
    let color = 'text-yellow-400';
    if (successRate < 60) { grade = 'C'; color = 'text-zinc-500'; }
    else if (successRate < 80) { grade = 'B'; color = 'text-blue-400'; }
    else if (successRate < 100) { grade = 'A'; color = 'text-green-400'; }

    // Indices for context calculation
    const startIndex = activePath.findIndex(n => n.id === startNodeId);
    const endIndex = activePath.findIndex(n => n.id === endNodeId);
    
    // Filter moves (ignore root)
    const movesOnly = activePath.filter(n => n.move !== null);
    
    // Generate text for clipboard
    const generateText = () => {
        let text = `【背譜報告】評級:${grade} 步數:${totalSteps} 錯誤:${totalErrors}\n\n`;
        if (errors.length > 0) {
            text += "【錯誤詳情】\n";
            errors.forEach(e => {
                text += `第 ${e.round} 回合: 錯誤 ${e.count} 次\n`;
            });
            text += "\n";
        }
        let round = 1;
        for (let i = 0; i < movesOnly.length; i+=2) {
            const red = movesOnly[i];
            const black = movesOnly[i+1];
            
            // Re-calculate visual index relative to full path to check against startIndex
            const redRealIndex = activePath.findIndex(n => n.id === red.id);
            const blackRealIndex = black ? activePath.findIndex(n => n.id === black.id) : -1;
            
            const getMark = (node: MoveNode, realIdx: number) => {
                if (realIdx < startIndex || realIdx > endIndex) return ""; // Context
                // IMPORTANT: Check error by PARENT ID, because error is recorded at the state BEFORE the move
                const err = errors.find(e => e.nodeId === node.parentId);
                return err ? "(錯)" : "(正)";
            };
            
            const redMark = getMark(red, redRealIndex);
            const blackMark = black ? getMark(black, blackRealIndex) : "";
            
            text += `${round}. ${red.move?.notation}${redMark}  ${black ? black.move?.notation + blackMark : ""}\n`;
            round++;
        }
        return text;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generateText());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[85vh]">
                <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900 text-center relative shrink-0">
                    <h2 className="text-2xl font-bold text-white mb-1">背譜結算報告</h2>
                    <div className="text-zinc-500 text-sm">本次練習共走了 {totalSteps} 步 (不含電腦回應)</div>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-zinc-950/50">
                    {/* Score Card */}
                    <div className="flex justify-center items-center gap-6 mb-8">
                        <div className="text-center">
                            <div className={`text-5xl font-black ${color} drop-shadow-lg mb-1`}>{grade}</div>
                            <div className="text-xs text-zinc-500 font-bold tracking-widest uppercase">等級</div>
                        </div>
                        <div className="w-px h-12 bg-zinc-800"></div>
                        <div className="text-center">
                            <div className="text-3xl font-bold text-white mb-1">{totalErrors}</div>
                            <div className="text-xs text-zinc-500 font-bold">錯誤次數</div>
                        </div>
                    </div>

                    {/* Error Details (Restored) */}
                    {errors.length > 0 && (
                        <div className="mb-4 bg-red-950/20 border border-red-900/30 rounded-lg p-3">
                            <h4 className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1">
                                <AlertTriangle size={12} /> 錯誤詳情
                            </h4>
                            <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1">
                                {errors.map((e, idx) => (
                                    <div key={idx} className="text-xs text-red-300 flex justify-between">
                                        <span>第 {e.round} 回合</span>
                                        <span>錯誤 {e.count} 次</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Move List */}
                    <div className="space-y-3">
                         <div className="flex justify-between items-center mb-2">
                             <h3 className="font-bold text-zinc-400 text-sm">完整棋譜回顧</h3>
                             <div className="flex gap-2 text-[10px]">
                                 <span className="flex items-center gap-1 text-zinc-500"><span className="w-2 h-2 bg-zinc-500 rounded-full"></span>上下文</span>
                                 <span className="flex items-center gap-1 text-green-500"><span className="w-2 h-2 bg-green-500 rounded-full"></span>正確</span>
                                 <span className="flex items-center gap-1 text-red-500"><span className="w-2 h-2 bg-red-500 rounded-full"></span>錯誤</span>
                             </div>
                         </div>
                         
                         <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 font-mono text-sm leading-relaxed max-h-64 overflow-y-auto custom-scrollbar">
                            {movesOnly.length === 0 ? <div className="text-zinc-600 italic text-center">無走棋記錄</div> : (
                                <div className="grid grid-cols-[3rem_1fr_1fr] gap-y-1">
                                    {Array.from({ length: Math.ceil(movesOnly.length / 2) }).map((_, i) => {
                                        const red = movesOnly[i*2];
                                        const black = movesOnly[i*2+1];
                                        const round = i + 1;
                                        
                                        // Helper to determine style
                                        const getStyle = (node: MoveNode) => {
                                            const realIdx = activePath.findIndex(n => n.id === node.id);
                                            // 1. Before Start or After End -> Context (White/Gray)
                                            if (realIdx < startIndex || realIdx > endIndex) return "text-zinc-500"; 
                                            
                                            // 2. Inside range -> Check error
                                            // IMPORTANT: Check error by PARENT ID, because error is recorded at the state BEFORE the move
                                            const err = errors.find(e => e.nodeId === node.parentId);
                                            if (err) return "text-red-400 font-bold"; // Red for error
                                            
                                            // 3. Correct
                                            return "text-green-400"; // Green for correct
                                        };

                                        return (
                                            <React.Fragment key={i}>
                                                <div className="text-zinc-600 text-right pr-3">{round}.</div>
                                                <div className={getStyle(red)}>{red.move?.notation}</div>
                                                <div className={black ? getStyle(black) : ""}>{black?.move?.notation}</div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            )}
                         </div>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex gap-3 shrink-0">
                    <button 
                        onClick={handleCopy}
                        className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 border border-zinc-700"
                    >
                        {copied ? <Check size={18} className="text-green-500"/> : <Copy size={18}/>} 複製棋譜
                    </button>
                    <button onClick={onClose} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition-colors">
                        關閉並返回
                    </button>
                </div>
            </div>
        </div>
    );
};
