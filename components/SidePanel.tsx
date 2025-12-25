import React, { useEffect, useRef } from 'react';
import { Cloud, Activity, MessageSquare, Split, Trash2, AtSign } from 'lucide-react';
import { MoveNode } from '../types';

// --- Move List Panel ---

interface MoveListPanelProps {
    movePath: MoveNode[]; // The active path from Root to Current (+ Future)
    currentNode: MoveNode;
    onJumpToMove: (node: MoveNode) => void;
    onUpdateComment: (id: string, comment: string) => void;
    onDeleteAfter: (id: string) => void;
}

export const MoveListPanel: React.FC<MoveListPanelProps> = ({ 
    movePath, 
    currentNode, 
    onJumpToMove, 
    onUpdateComment,
    onDeleteAfter
}) => {
    
    // Auto scroll to current move
    const activeRowRef = useRef<HTMLTableRowElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeRowRef.current && tableContainerRef.current) {
            activeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [currentNode.id]);

    const handleDelete = () => {
        if (window.confirm("確定要刪除當前棋步之後的所有招法嗎？此操作無法撤銷。")) {
            onDeleteAfter(currentNode.id);
        }
    };

    // Filter out root node for the table (Root has no move)
    const movesOnly = movePath.filter(n => n.parentId !== null);

    // --- Logic for Variation List (Bottom Panel) ---
    // We want to show alternatives to the *current move*.
    // If currentNode is Root, we show its children (Moves for turn 1).
    // If currentNode is a Move, we show ITS SIBLINGS (Moves for the same turn).
    let variationNodes: MoveNode[] = [];
    let variationParent: MoveNode | undefined;
    
    if (!currentNode.parentId) {
        // Current is Root
        variationNodes = currentNode.children;
        variationParent = currentNode;
    } else {
        // Current is a Move, find its parent in the path
        const parent = movePath.find(n => n.id === currentNode.parentId);
        if (parent) {
            variationNodes = parent.children;
            variationParent = parent;
        }
    }

    return (
        <div className="flex flex-col h-full bg-zinc-900 border-x border-zinc-800 shadow-xl text-sm">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm shrink-0 flex justify-between items-center">
                <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                    <span className="w-2 h-6 bg-amber-600 rounded-sm"></span>
                    招法 & 變著
                </h3>
                {movesOnly.length > 0 && (
                    <button 
                        onClick={handleDelete}
                        className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-800 transition-colors"
                        title="刪除當前之後的招法"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Scrollable Content Area: Moves Table */}
            <div ref={tableContainerRef} className="flex-1 overflow-y-auto custom-scrollbar bg-zinc-950/30">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-zinc-900 text-zinc-500 font-medium sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="px-4 py-2 w-12 text-center border-b border-zinc-800">#</th>
                            <th className="px-2 py-2 border-b border-zinc-800 w-1/2">紅方</th>
                            <th className="px-2 py-2 border-b border-zinc-800 w-1/2">黑方</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                        {movesOnly.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-zinc-600 italic text-xs">
                                    請開始走棋...
                                </td>
                            </tr>
                        ) : (
                            // Group into Red/Black pairs
                            Array.from({ length: Math.ceil(movesOnly.length / 2) }).map((_, i) => {
                                const index = i * 2;
                                const redNode = movesOnly[index];
                                const blackNode = movesOnly[index + 1];
                                
                                const isRedCurrent = redNode?.id === currentNode.id;
                                const isBlackCurrent = blackNode?.id === currentNode.id;

                                // Helper to render a cell
                                const renderCell = (node: MoveNode | undefined, isCurrent: boolean) => {
                                    if (!node || !node.move) return null;
                                    
                                    // Calculate Variation Badge (e.g., 2A)
                                    // We need to look up this node's parent in the path to determine siblings index
                                    let varBadge = null;
                                    const parent = movePath.find(p => p.id === node.parentId);
                                    
                                    if (parent && parent.children.length > 1) {
                                        const totalVars = parent.children.length;
                                        // Find index of this node among siblings
                                        const varIndex = parent.children.findIndex(c => c.id === node.id);
                                        if (varIndex !== -1) {
                                            const letter = String.fromCharCode(65 + varIndex);
                                            varBadge = `${totalVars}${letter}`;
                                        }
                                    }

                                    return (
                                        <div 
                                            className={`
                                                cursor-pointer px-2 py-1.5 rounded flex items-center justify-between group
                                                ${isCurrent ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-zinc-800/50'}
                                            `}
                                            onClick={() => onJumpToMove(node)}
                                        >
                                            <span className="font-medium">{node.move.notation}</span>
                                            
                                            <div className="flex items-center gap-1.5">
                                                {/* Comment Indicator (@) - Left side of badge */}
                                                {node.comment && (
                                                    <AtSign size={12} className={isCurrent ? "text-blue-200" : "text-amber-500"} />
                                                )}
                                                
                                                {/* Variation Badge (e.g. 2A) - Right side */}
                                                {varBadge && (
                                                    <span className={`text-[10px] px-1 rounded font-mono font-bold leading-none py-0.5 ${isCurrent ? 'bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-400 group-hover:bg-zinc-600'}`}>
                                                        {varBadge}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <tr key={i} ref={isRedCurrent || isBlackCurrent ? activeRowRef : null} className="text-zinc-300">
                                        <td className="px-2 py-1.5 text-center text-zinc-600 font-mono text-xs bg-zinc-900/20">{i + 1}</td>
                                        <td className={`px-1 py-1 ${isRedCurrent ? 'bg-blue-900/20' : ''}`}>
                                            {renderCell(redNode, isRedCurrent)}
                                        </td>
                                        <td className={`px-1 py-1 ${isBlackCurrent ? 'bg-blue-900/20' : ''}`}>
                                            {renderCell(blackNode, isBlackCurrent)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Bottom Section: Variations & Comments (Fixed at bottom) */}
            <div className="shrink-0 bg-zinc-900 z-10 border-t border-zinc-800">
                
                {/* 2. Variations List (Siblings of Current) */}
                {variationNodes.length > 0 && (
                     <div className="p-3 border-b border-zinc-800/50">
                        <div className="flex items-center gap-2 mb-2">
                            <Split size={14} className="text-zinc-500" />
                            <h4 className="text-xs font-bold text-zinc-400">
                                變著 ({variationNodes.length}) - 點擊切換分支
                            </h4>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 rounded p-2 grid grid-cols-2 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                            {variationNodes.map((sibling, idx) => {
                                const label = String.fromCharCode(65 + idx); // A, B, C...
                                // Is this the node currently selected/active in the view?
                                const isSelected = sibling.id === currentNode.id;
                                
                                return (
                                    <div 
                                        key={sibling.id} 
                                        onClick={() => onJumpToMove(sibling)}
                                        className={`
                                            flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-all border
                                            ${isSelected 
                                                ? 'bg-blue-900/30 border-blue-600' 
                                                : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 hover:border-zinc-600'}
                                        `}
                                    >
                                        <span className={`
                                            font-mono text-xs font-bold px-1.5 py-0.5 rounded shadow-sm
                                            ${isSelected ? 'bg-blue-600 text-white' : 'bg-amber-900/30 text-amber-500'}
                                        `}>
                                            {label}
                                        </span>
                                        <span className={`flex-1 ${isSelected ? 'text-white font-medium' : 'text-zinc-300'}`}>
                                            {sibling.move?.notation || "開始"}
                                        </span>
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 3. Comments Section */}
                <div className="p-3">
                    <div className="relative group">
                        <MessageSquare size={14} className="absolute top-3 left-3 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
                        <textarea 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-9 pr-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none h-16 transition-all custom-scrollbar"
                            placeholder="添加當前局面注釋..."
                            value={currentNode.comment}
                            onChange={(e) => onUpdateComment(currentNode.id, e.target.value)}
                        ></textarea>
                    </div>
                    {/* Fast Input Buttons */}
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1 no-scrollbar">
                        {['正著', '劣著', '失子', '飛刀', '妙手'].map(tag => (
                            <button 
                                key={tag}
                                onClick={() => onUpdateComment(currentNode.id, (currentNode.comment + " " + tag).trim())}
                                className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-400 whitespace-nowrap transition-colors"
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};


export const CloudPanel: React.FC = () => {
    return (
        <div className="flex flex-col h-full bg-zinc-900 border-x border-zinc-800 shadow-xl">
             {/* Header */}
             <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                    <span className="w-2 h-6 bg-blue-600 rounded-sm"></span>
                    雲庫分析
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-4">
                <button className="w-full py-3 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg flex items-center justify-center gap-2 font-bold shadow-lg shadow-blue-900/30 transition-all active:scale-95 border border-blue-500/30">
                    <Activity size={18} />
                    立即分析當前局面
                </button>
                <div className="bg-zinc-950/50 rounded-lg p-6 border border-zinc-800 flex flex-col items-center text-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                         <Cloud size={32} className="text-zinc-600" />
                    </div>
                    <div className="text-zinc-400 text-sm">
                        <span className="block font-medium text-zinc-300 text-lg mb-1">未連接雲庫</span>
                        <span className="text-xs text-zinc-500">請點擊上方按鈕連接引擎進行分析</span>
                    </div>
                </div>
            </div>
        </div>
    );
};