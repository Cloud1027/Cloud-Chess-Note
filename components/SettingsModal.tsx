import React from 'react';
import { X, Volume2, VolumeX, Eye, EyeOff, Wind, Monitor, Grid, Activity } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onUpdate: (newSettings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onUpdate }) => {
    if (!isOpen) return null;

    const toggle = (key: keyof AppSettings) => {
        onUpdate({ ...settings, [key]: !settings[key] });
    };

    const handleChange = (key: keyof AppSettings, value: any) => {
        onUpdate({ ...settings, [key]: value });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">系統設定</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar max-h-[70vh]">

                    {/* 1. Sound */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${settings.enableSound ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                {settings.enableSound ? <Volume2 size={20} /> : <VolumeX size={20} />}
                            </div>
                            <div>
                                <div className="font-bold text-zinc-200">遊戲音效</div>
                                <div className="text-xs text-zinc-500">落子聲與吃子聲</div>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={settings.enableSound} onChange={() => toggle('enableSound')} className="sr-only peer" />
                            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>

                    <hr className="border-zinc-800" />

                    {/* 2. Player Names */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${settings.showPlayerNames ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                {settings.showPlayerNames ? <Eye size={20} /> : <EyeOff size={20} />}
                            </div>
                            <div>
                                <div className="font-bold text-zinc-200">顯示棋手姓名</div>
                                <div className="text-xs text-zinc-500">在棋盤上下方顯示名稱</div>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={settings.showPlayerNames} onChange={() => toggle('showPlayerNames')} className="sr-only peer" />
                            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {/* 3. Variation Arrows */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${settings.showVariationArrows ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                <Wind size={20} />
                            </div>
                            <div>
                                <div className="font-bold text-zinc-200">顯示變著導引</div>
                                <div className="text-xs text-zinc-500">顯示藍色分支箭頭 (A/B)</div>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={settings.showVariationArrows} onChange={() => toggle('showVariationArrows')} className="sr-only peer" />
                            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {/* 3.1 Engine Arrows */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${settings.showEngineArrows ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                <Activity size={20} />
                            </div>
                            <div>
                                <div className="font-bold text-zinc-200">顯示引擎建議</div>
                                <div className="text-xs text-zinc-500">顯示引擎最佳著法 (紅/綠箭頭)</div>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={settings.showEngineArrows} onChange={() => toggle('showEngineArrows')} className="sr-only peer" />
                            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    {/* 3.5 Show Coords (Extra) */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${settings.showCoords ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                <Grid size={20} />
                            </div>
                            <div>
                                <div className="font-bold text-zinc-200">顯示棋盤座標</div>
                                <div className="text-xs text-zinc-500">顯示邊緣的 1-9 數字</div>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={settings.showCoords} onChange={() => toggle('showCoords')} className="sr-only peer" />
                            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    <hr className="border-zinc-800" />

                    {/* 4. Animation Speed */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
                                    <Monitor size={20} />
                                </div>
                                <div>
                                    <div className="font-bold text-zinc-200">走棋速度</div>
                                    <div className="text-xs text-zinc-500">{settings.animationSpeed} ms</div>
                                </div>
                            </div>
                        </div>
                        <div className="px-1">
                            <input
                                type="range"
                                min="0"
                                max="1000"
                                step="100"
                                value={settings.animationSpeed}
                                onChange={(e) => handleChange('animationSpeed', parseInt(e.target.value))}
                                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
                            />
                            <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                                <span>瞬間 (0ms)</span>
                                <span>慢速 (1s)</span>
                            </div>
                        </div>
                    </div>

                    {/* 5. Board Size */}
                    <div className="space-y-2">
                        <div className="font-bold text-zinc-200">棋盤大小</div>
                        <div className="grid grid-cols-3 gap-2">
                            {(['small', 'medium', 'large'] as const).map(size => {
                                let label = '';
                                if (size === 'small') label = '小 (緊湊)';
                                if (size === 'medium') label = '中 (標準)';
                                if (size === 'large') label = '大 (舒適)';

                                return (
                                    <button
                                        key={size}
                                        onClick={() => handleChange('boardSize', size)}
                                        className={`py-2 px-1 rounded-lg text-sm font-bold border transition-all ${settings.boardSize === size ? 'bg-amber-600/20 border-amber-500 text-amber-400' : 'bg-zinc-950 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold transition-colors">
                        關閉
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;