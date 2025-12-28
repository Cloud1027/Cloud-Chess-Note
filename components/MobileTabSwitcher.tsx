
import React from 'react';
import { X, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { GameTab } from '../types';

interface MobileTabSwitcherProps {
    isOpen: boolean;
    onClose: () => void;
    tabs: GameTab[];
    activeTabId: string;
    onSwitch: (id: string) => void;
    onAdd: () => void;
    onDelete: (id: string) => void;
}

const MobileTabSwitcher: React.FC<MobileTabSwitcherProps> = ({
    isOpen,
    onClose,
    tabs,
    activeTabId,
    onSwitch,
    onAdd,
    onDelete
}) => {
    if (!isOpen) return null;

    const getColorBorder = (color: string | undefined) => {
        switch (color) {
            case 'blue': return 'border-blue-500';
            case 'green': return 'border-green-500';
            case 'red': return 'border-red-500';
            case 'orange': return 'border-orange-500';
            case 'purple': return 'border-purple-500';
            case 'teal': return 'border-teal-500';
            case 'dark': return 'border-zinc-500';
            case 'pink': return 'border-pink-400';
            case 'yellow': return 'border-yellow-400';
            case 'coffee': return 'border-amber-700';
            default: return 'border-zinc-700';
        }
    };

    const getTextColor = (color: string | undefined) => {
        switch (color) {
            case 'blue': return 'text-blue-400';
            case 'green': return 'text-green-400';
            case 'red': return 'text-red-400';
            case 'orange': return 'text-orange-400';
            case 'purple': return 'text-purple-400';
            case 'teal': return 'text-teal-400';
            case 'dark': return 'text-zinc-400';
            case 'pink': return 'text-pink-400';
            case 'yellow': return 'text-yellow-400';
            case 'coffee': return 'text-amber-600';
            default: return 'text-zinc-600';
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-zinc-950 flex flex-col animate-in slide-in-from-bottom-5 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
                <h3 className="font-bold text-lg text-zinc-200">切換棋譜 ({tabs.length})</h3>
                <div className="flex gap-2">
                    <button
                        onClick={onAdd}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-1 font-bold text-sm"
                    >
                        <Plus size={16} /> 新增
                    </button>
                    <button onClick={onClose} className="p-2 bg-zinc-800 rounded-lg text-zinc-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Grid List */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="grid grid-cols-2 gap-3">
                    {tabs.map((tab) => {
                        const isActive = tab.id === activeTabId;
                        return (
                            <div
                                key={tab.id}
                                onClick={() => { onSwitch(tab.id); onClose(); }}
                                className={`
                                    relative flex flex-col aspect-[4/3] rounded-xl border-2 p-3 cursor-pointer transition-all
                                    ${isActive
                                        ? 'bg-zinc-800 border-blue-500 shadow-lg shadow-blue-900/20'
                                        : `bg-zinc-900 ${getColorBorder(tab.colorTag)} hover:bg-zinc-800`}
                                `}
                            >
                                <div className="flex-1 flex flex-col justify-center items-center text-center gap-1">
                                    <div className={`w-10 h-10 rounded-full bg-zinc-950 flex items-center justify-center text-lg font-bold font-serif ${getTextColor(tab.colorTag)} border border-zinc-800 mb-1`}>
                                        弈
                                    </div>
                                    <div className="font-bold text-zinc-200 line-clamp-1 w-full px-1">
                                        {tab.title}
                                    </div>
                                    <div className="text-[10px] text-zinc-500">
                                        {new Date(tab.createdAt).toLocaleDateString()}
                                    </div>
                                </div>

                                {isActive && (
                                    <div className="absolute top-2 right-2 text-blue-500">
                                        <CheckCircle2 size={18} fill="currentColor" className="text-zinc-900" />
                                    </div>
                                )}

                                {tabs.length > 1 && !isActive && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(tab.id); }}
                                        className="absolute top-2 right-2 p-1.5 text-zinc-600 hover:text-red-400 bg-zinc-950/50 rounded-full backdrop-blur-sm"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}

                                {/* Meta Summary */}
                                <div className="mt-auto pt-2 border-t border-zinc-800/50 flex justify-between items-center text-[10px] text-zinc-500 w-full">
                                    <span className="truncate max-w-[45%] text-red-900/70 font-bold">{tab.metadata.redName || '紅'}</span>
                                    <span>vs</span>
                                    <span className="truncate max-w-[45%] text-zinc-600 font-bold">{tab.metadata.blackName || '黑'}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default MobileTabSwitcher;
