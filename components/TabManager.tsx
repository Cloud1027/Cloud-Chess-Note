
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Trash2, Edit2, ArrowUp, ArrowDown, Layout, Check, Palette } from 'lucide-react';
import { GameTab } from '../types';

interface TabManagerProps {
    tabs: GameTab[];
    activeTabId: string;
    onSwitch: (id: string) => void;
    onAdd: () => void;
    onDelete: (id: string) => void;
    onRename: (id: string, newTitle: string) => void;
    onReorder: (id: string, direction: 'up' | 'down') => void;
    onColorChange: (id: string, color: GameTab['colorTag']) => void;
}

const TabManager: React.FC<TabManagerProps> = ({
    tabs,
    activeTabId,
    onSwitch,
    onAdd,
    onDelete,
    onRename,
    onReorder,
    onColorChange
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab && tabs.length > 0) {
        // Fallback to first tab if active ID is not found but tabs exist
        // (This shouldn't happen with our robust sync, but defensive is good)
    }

    if (tabs.length === 0 || !activeTab) {
        return <div className="p-4 text-zinc-500 text-sm">載入中...</div>;
    }

    const currentTab = activeTab;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    const startEditing = (tab: GameTab, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(tab.id);
        setEditValue(tab.title);
    };

    const submitEdit = () => {
        if (editingId && editValue.trim()) {
            onRename(editingId, editValue.trim());
        }
        setEditingId(null);
    };

    const getColorClass = (color: string | undefined) => {
        switch (color) {
            case 'red': return 'bg-red-500';
            case 'blue': return 'bg-blue-500';
            case 'green': return 'bg-green-500';
            case 'yellow': return 'bg-yellow-500';
            default: return 'bg-zinc-600';
        }
    };

    const nextColor = (current: string | undefined): GameTab['colorTag'] => {
        const colors: GameTab['colorTag'][] = ['none', 'red', 'blue', 'green', 'yellow'];
        const idx = colors.indexOf(current as any);
        return colors[(idx + 1) % colors.length];
    };

    return (
        <div className="w-full bg-[#1e1e20] border-b border-zinc-800 flex flex-col shrink-0 relative z-20" ref={containerRef}>
            {/* Top Row: Active Tab Selector & Add */}
            <div className="flex items-center gap-1 p-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex-1 flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-3 py-2 transition-all group"
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className={`w-2 h-2 rounded-full ${getColorClass(currentTab.colorTag)}`} />
                        <span className="font-bold text-zinc-200 text-sm truncate max-w-[140px]">
                            {currentTab.title || '未命名棋譜'}
                        </span>
                        <span className="text-[10px] text-zinc-500 px-1 border border-zinc-700 rounded">
                            {tabs.findIndex(t => t.id === activeTabId) + 1}/{tabs.length}
                        </span>
                    </div>
                    <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <button
                    onClick={onAdd}
                    className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all active:scale-95"
                    title="新增棋譜"
                >
                    <Plus size={18} />
                </button>
            </div>

            {/* Dropdown / Quick Actions Panel */}
            {isOpen ? (
                <div className="absolute top-full left-0 w-full bg-zinc-900 border-b border-r border-zinc-800 shadow-2xl max-h-[400px] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-1">
                    <div className="p-1 space-y-0.5">
                        {tabs.map((tab, idx) => {
                            const isActive = tab.id === activeTabId;
                            return (
                                <div
                                    key={tab.id}
                                    onClick={() => { onSwitch(tab.id); setIsOpen(false); }}
                                    className={`
                                        group flex items-center justify-between p-2 rounded-md cursor-pointer border
                                        ${isActive ? 'bg-blue-900/20 border-blue-800/50' : 'hover:bg-zinc-800 border-transparent hover:border-zinc-700'}
                                    `}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div
                                            className={`w-1.5 h-8 rounded-full shrink-0 ${isActive ? 'bg-blue-500' : 'bg-zinc-700 group-hover:bg-zinc-600'}`}
                                        ></div>

                                        {editingId === tab.id ? (
                                            <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                                                <input
                                                    ref={editInputRef}
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && submitEdit()}
                                                    onBlur={submitEdit}
                                                    className="w-full bg-zinc-950 border border-blue-500 rounded px-1 py-0.5 text-sm text-white focus:outline-none"
                                                />
                                                <button onClick={submitEdit} className="text-green-500 hover:bg-zinc-800 p-1 rounded"><Check size={14} /></button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-medium truncate ${isActive ? 'text-blue-100' : 'text-zinc-300'}`}>
                                                        {tab.title}
                                                    </span>
                                                    <div className={`w-2 h-2 rounded-full ${getColorClass(tab.colorTag)}`} />
                                                </div>
                                                <span className="text-[10px] text-zinc-600 truncate">
                                                    {tab.metadata.redName || '紅方'} vs {tab.metadata.blackName || '黑方'} · {new Date(tab.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons (Visible on Hover or Active) */}
                                    <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'opacity-100' : ''}`}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onColorChange(tab.id, nextColor(tab.colorTag)); }}
                                            className="p-1.5 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 rounded"
                                            title="切換顏色標記"
                                        >
                                            <Palette size={13} />
                                        </button>
                                        <button
                                            onClick={(e) => startEditing(tab, e)}
                                            className="p-1.5 hover:bg-zinc-700 text-zinc-500 hover:text-blue-400 rounded"
                                            title="重新命名"
                                        >
                                            <Edit2 size={13} />
                                        </button>

                                        <div className="flex flex-col gap-0.5">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onReorder(tab.id, 'up'); }}
                                                className="p-0.5 hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300 rounded disabled:opacity-30"
                                                disabled={idx === 0}
                                            >
                                                <ArrowUp size={10} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onReorder(tab.id, 'down'); }}
                                                className="p-0.5 hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300 rounded disabled:opacity-30"
                                                disabled={idx === tabs.length - 1}
                                            >
                                                <ArrowDown size={10} />
                                            </button>
                                        </div>

                                        {tabs.length > 1 && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(tab.id); }}
                                                className="p-1.5 hover:bg-red-900/50 text-zinc-500 hover:text-red-400 rounded ml-1"
                                                title="刪除"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                // Collapsed Actions Bar (Quick access when closed)
                <div className="flex items-center justify-between px-2 pb-2 text-[10px] text-zinc-500">
                    <div className="flex gap-2">
                        <span className="flex items-center gap-1">Alt+<ArrowUp size={10} />/<ArrowDown size={10} /> 切換</span>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={() => startEditing(currentTab, { stopPropagation: () => { } } as any)} className="hover:text-zinc-300">命名</button>
                        <span className="opacity-50">|</span>
                        <button onClick={() => onDelete(currentTab.id)} className="hover:text-red-400 disabled:opacity-50" disabled={tabs.length <= 1}>刪除</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TabManager;
