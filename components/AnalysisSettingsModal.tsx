import React from 'react';
import { Cloud, Cpu, X, Check } from 'lucide-react';

interface AnalysisSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    analysisMode: 'cloud' | 'local';
    setAnalysisMode: (mode: 'cloud' | 'local') => void;
    localDepth: number;
    setLocalDepth: (depth: number) => void;
    onStart?: (mode: 'cloud' | 'local', depth: number) => void;
}

export const AnalysisSettingsModal: React.FC<AnalysisSettingsModalProps> = ({
    isOpen,
    onClose,
    analysisMode,
    setAnalysisMode,
    localDepth,
    setLocalDepth,
    onStart
}) => {
    const handleConfirm = () => {
        if (onStart) onStart(analysisMode, localDepth);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
                    <h3 className="font-bold text-zinc-100">分析設定</h3>
                    <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Mode Selection */}
                    <div className="space-y-3">
                        <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">分析模式</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setAnalysisMode('cloud')}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${analysisMode === 'cloud' ? 'bg-blue-600/20 border-blue-600 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                            >
                                <Cloud size={24} />
                                <span className="text-sm font-bold">雲庫查詢</span>
                            </button>
                            <button
                                onClick={() => setAnalysisMode('local')}
                                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${analysisMode === 'local' ? 'bg-amber-600/20 border-amber-600 text-amber-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}`}
                            >
                                <Cpu size={24} />
                                <span className="text-sm font-bold">本機引擎</span>
                            </button>
                        </div>
                    </div>

                    {/* Depth Slider (Only for Engine) */}
                    <div className={`space-y-3 transition-opacity duration-200 ${analysisMode === 'local' ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                        <div className="flex justify-between items-center">
                            <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider">引擎深度</label>
                            <span className="text-amber-500 font-mono font-bold text-lg">{localDepth}</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="30"
                            value={localDepth}
                            onChange={(e) => setLocalDepth(parseInt(e.target.value))}
                            className="w-full accent-amber-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                            <span>10 (快)</span>
                            <span>30 (強)</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
                    <button
                        onClick={handleConfirm}
                        className="w-full py-3 bg-zinc-100 hover:bg-white text-zinc-900 rounded-lg font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                        <Check size={18} /> 確定
                    </button>
                </div>
            </div>
        </div>
    );
};
