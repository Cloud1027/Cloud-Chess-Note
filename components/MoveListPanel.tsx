
import React, { useEffect, useRef } from 'react';
import { Split, Trash2, AtSign, MessageSquare, ChevronUp, ChevronDown, Link as LinkIcon, Settings } from 'lucide-react';
import { MoveNode } from '../types';

interface MoveListPanelProps {
    movePath: MoveNode[];
    currentNode: MoveNode;
    rootNode: MoveNode;
    onJumpToMove: (node: MoveNode) => void;
    onUpdateComment: (id: string, comment: string) => void;
    onRequestDelete: (message: string) => void;
    onRequestDeleteNode: (nodeId: string, message: string) => void;
    onReorder: (childId: string, direction: 'up' | 'down') => void;
    onLinkFen: () => void;
    clipboardTags: string[];
    onEditTags: () => void;
    onNodeClick?: (node: MoveNode) => void;      // New: For mobile single click (select only)
    onNodeDoubleClick?: (node: MoveNode) => void; // New: For mobile double click (jump & close)
}

const MoveListPanel: React.FC<MoveListPanelProps> = ({
    movePath,
    currentNode,
    rootNode,
    onJumpToMove,
    onUpdateComment,
    onRequestDelete,
    onRequestDeleteNode,
    onReorder,
    onLinkFen,
    clipboardTags,
    onEditTags,
    onNodeClick,
    onNodeDoubleClick
}) => {
    const activeRowRef = useRef<HTMLTableRowElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const panelContainerRef = useRef<HTMLDivElement>(null);

    // Manual Double Tap Detection Refs
    const lastClickTimeRef = useRef<number>(0);
    const lastClickNodeIdRef = useRef<string | null>(null);

    // Unified Click Handler (Handles Single & Double Clicks)
    const handleNodeClick = (node: MoveNode) => {
        const now = Date.now();
        const timeDiff = now - lastClickTimeRef.current;

        if (timeDiff < 300 && lastClickNodeIdRef.current === node.id) {
            // Double Click Detected
            if (onNodeDoubleClick) onNodeDoubleClick(node);

            // Reset
            lastClickTimeRef.current = 0;
            lastClickNodeIdRef.current = null;
        } else {
            // Single Click
            lastClickTimeRef.current = now;
            lastClickNodeIdRef.current = node.id;

            if (onNodeClick) onNodeClick(node);
            else onJumpToMove(node);
        }
    };

    // Kept for backward compatibility if needed, but unused in new logic
    const handleNodeDoubleClick = (node: MoveNode) => {
        if (onNodeDoubleClick) onNodeDoubleClick(node);
    };

    // Resizing state
    const [heights, setHeights] = React.useState({ moves: 50, variations: 25, comments: 25 });
    const draggingRef = useRef<'resizer1' | 'resizer2' | null>(null);

    const onMouseDown = (id: 'resizer1' | 'resizer2') => {
        draggingRef.current = id;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!draggingRef.current || !panelContainerRef.current) return;
            const containerRect = panelContainerRef.current.getBoundingClientRect();
            const relativeY = ((e.clientY - containerRect.top) / containerRect.height) * 100;
            const hasVariations = variationNodes.length > 0;

            setHeights(prev => {
                const next = { ...prev };
                if (draggingRef.current === 'resizer1') {
                    const diff = relativeY - prev.moves;
                    if (hasVariations) {
                        // Adjusting moves and variations
                        const newMoves = Math.max(10, Math.min(80, relativeY));
                        const available = 100 - newMoves;
                        // Keep ratio for variations/comments or adjust variations
                        const oldRemaining = prev.variations + prev.comments;
                        const factor = available / oldRemaining;
                        next.moves = newMoves;
                        next.variations = prev.variations * factor;
                        next.comments = prev.comments * factor;
                    } else {
                        // Adjusting moves and comments directly
                        const newMoves = Math.max(10, Math.min(90, relativeY));
                        next.moves = newMoves;
                        next.comments = 100 - newMoves;
                    }
                } else if (draggingRef.current === 'resizer2') {
                    // Adjusting variations and comments
                    const movesHeight = prev.moves;
                    const newVarEnd = Math.max(movesHeight + 5, Math.min(95, relativeY));
                    next.variations = newVarEnd - movesHeight;
                    next.comments = 100 - newVarEnd;
                }
                return next;
            });
        };

        const onMouseUp = () => {
            draggingRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [heights]);

    // Ensure we only depend on the ID string
    const currentId = currentNode ? currentNode.id : null;

    useEffect(() => {
        if (tableContainerRef.current) {
            if (currentId && currentId !== 'root' && activeRowRef.current) {
                try {
                    activeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                } catch (e) {
                    // Ignore scroll errors
                }
            } else {
                tableContainerRef.current.scrollTop = 0;
            }
        }
    }, [currentId]);

    const safeMovePath = movePath || [];
    const movesOnly = safeMovePath.filter(n => n && n.parentId !== null);
    const isRoot = currentNode && rootNode && currentNode.id === rootNode.id;

    // Variation Logic: Siblings of the current node (or children if at root)
    let variationNodes: MoveNode[] = [];
    if (currentNode && !currentNode.parentId) {
        variationNodes = currentNode.children || [];
    } else if (currentNode) {
        const parent = safeMovePath.find(n => n.id === currentNode.parentId);
        if (parent) {
            variationNodes = parent.children || [];
        }
    }

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        let message = '確定要刪除當前棋步及之後的所有著法嗎？\n\n';
        message += `當前棋步：${currentNode.move?.notation || "開始局面"} \n`;

        if (variationNodes.length > 1) {
            message += `\n注意：此步驟為變著之一，刪除後將自動切換至其他變化。`;
        } else {
            message += `\n此操作無法復原。`;
        }

        // Trigger parent modal, do NOT use window.confirm
        onRequestDelete(message);
    };

    const handleDeleteVariation = (e: React.MouseEvent, node: MoveNode) => {
        e.preventDefault();
        e.stopPropagation();

        let message = `確定要刪除變著 [${node.move?.notation}] 及其後續所有招法嗎？\n\n此操作無法復原。`;
        onRequestDeleteNode(node.id, message);
    };

    if (!currentNode) return <div className="p-4 text-zinc-500">載入中...</div>;

    return (
        <div className="flex flex-col h-full w-full bg-zinc-900 shadow-xl text-sm overflow-hidden">
            {/* 1. Header */}
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm shrink-0 flex justify-between items-center">
                <h3 className="font-bold text-zinc-200 flex items-center gap-2">
                    <span className="w-2 h-6 bg-amber-600 rounded-sm"></span>
                    招法 & 變著
                </h3>
                {movesOnly.length > 0 && !isRoot && (
                    <button
                        onClick={handleDelete}
                        className="text-zinc-500 hover:text-red-400 p-1.5 rounded hover:bg-zinc-800 transition-colors"
                        title="刪除當前招法"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Main Resizable Area */}
            <div ref={panelContainerRef} className="flex-1 flex flex-col min-h-0 relative">

                {/* 2. Moves Table (Resizable) */}
                <div
                    ref={tableContainerRef}
                    className="overflow-y-auto custom-scrollbar bg-zinc-950/30 relative"
                    style={{ flex: `${heights.moves} 0 0%` }}
                >
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-zinc-900 text-zinc-500 font-medium sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-2 w-12 text-center border-b border-zinc-800">#</th>
                                <th className="px-2 py-2 border-b border-zinc-800 w-1/2">紅方</th>
                                <th className="px-2 py-2 border-b border-zinc-800 w-1/2">黑方</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {/* Root Node Row */}
                            <tr
                                onClick={() => handleNodeClick(rootNode)}
                                className={`cursor-pointer group transition-colors ${isRoot ? 'bg-blue-900/30' : 'hover:bg-zinc-800/30'}`}
                            >
                                <td className="px-2 py-2 text-center text-zinc-600 font-mono text-xs">0</td>
                                <td colSpan={2} className="px-2 py-2">
                                    <div className={`flex items-center justify-center font-bold text-xs border border-dashed rounded py-1 ${isRoot ? 'border-blue-500 text-blue-300 bg-blue-500/10' : 'border-zinc-700 text-zinc-500 group-hover:border-zinc-500 group-hover:text-zinc-300'}`}>
                                        == 開始局面 ==
                                        {rootNode.comment && <AtSign size={12} className="ml-2 text-amber-500" />}
                                    </div>
                                </td>
                            </tr>

                            {movesOnly.length === 0 && isRoot ? (
                                <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-600 italic text-xs">請開始走棋...</td></tr>
                            ) : (
                                Array.from({ length: Math.ceil(movesOnly.length / 2) }).map((_, i) => {
                                    const index = i * 2;
                                    const redNode = movesOnly[index];
                                    const blackNode = movesOnly[index + 1];
                                    const isRedCurrent = redNode?.id === currentNode.id;
                                    const isBlackCurrent = blackNode?.id === currentNode.id;

                                    const renderCell = (node: MoveNode | undefined, isCurrent: boolean) => {
                                        if (!node || !node.move) return null;
                                        let varBadge = null;
                                        const parent = safeMovePath.find(p => p.id === node.parentId);
                                        if (parent && parent.children && parent.children.length > 1) {
                                            const varIndex = parent.children.findIndex(c => c.id === node.id);
                                            if (varIndex !== -1) varBadge = `${parent.children.length}${String.fromCharCode(65 + varIndex)}`;
                                        }

                                        return (
                                            <div
                                                className={`cursor-pointer px-2 py-1.5 rounded flex items-center justify-between group ${isCurrent ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-zinc-800/50'}`}
                                                onClick={() => handleNodeClick(node)}
                                            >
                                                <span className="font-medium truncate">{node.move.notation}</span>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {node.comment && <AtSign size={12} className={isCurrent ? "text-blue-200" : "text-amber-500"} />}
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
                                            <td className={`px-1 py-1 w-[45%] ${isRedCurrent ? 'bg-blue-900/20' : ''}`}>{renderCell(redNode, isRedCurrent)}</td>
                                            <td className={`px-1 py-1 w-[45%] ${isBlackCurrent ? 'bg-blue-900/20' : ''}`}>{renderCell(blackNode, isBlackCurrent)}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Resizer 1 */}
                <div
                    className="h-1.5 bg-zinc-800 hover:bg-amber-600 cursor-row-resize transition-colors shrink-0 z-20"
                    onMouseDown={() => onMouseDown('resizer1')}
                />

                {/* Variation List (Resizable) */}
                {variationNodes.length > 0 ? (
                    <div
                        className="bg-zinc-900 p-3 border-b border-zinc-800/50 overflow-hidden flex flex-col"
                        style={{ flex: `${heights.variations} 0 0%` }}
                    >
                        <div className="flex items-center justify-between mb-2 shrink-0">
                            <div className="flex items-center gap-2">
                                <Split size={14} className="text-zinc-500" />
                                <h4 className="text-xs font-bold text-zinc-400">變著 ({variationNodes.length})</h4>
                            </div>
                            <button
                                onClick={onLinkFen}
                                className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 hover:bg-blue-900/30 text-zinc-400 hover:text-blue-400 rounded text-[10px] border border-zinc-700 hover:border-blue-700/50 transition-colors"
                                title="遍歷並串聯所有相同局面"
                            >
                                <LinkIcon size={12} />
                                串聯局面
                            </button>
                        </div>

                        <div className="bg-zinc-950 border border-zinc-800 rounded p-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1">
                            {variationNodes.map((sibling, idx) => {
                                const isSelected = sibling.id === currentNode.id;
                                return (
                                    <div key={sibling.id}
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm border transition-colors group
                                            ${isSelected ? 'bg-blue-900/20 border-blue-800/50' : 'bg-zinc-900/50 border-zinc-800/50 hover:bg-zinc-800 hover:border-zinc-700'}
                                        `}>

                                        <div className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                                            onClick={() => handleNodeClick(sibling)}
                                        >
                                            <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                                {String.fromCharCode(65 + idx)}
                                            </span>
                                            <span className={`truncate font-medium ${isSelected ? 'text-blue-200' : 'text-zinc-400 hover:text-zinc-200'}`}>
                                                {sibling.move?.notation || "開始"}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1 pl-2 border-l border-zinc-800/50 shrink-0">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onReorder(sibling.id, 'up'); }}
                                                className="p-1 hover:bg-zinc-700 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                                disabled={idx === 0}
                                                title="上移"
                                            >
                                                <ChevronUp size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onReorder(sibling.id, 'down'); }}
                                                className="p-1 hover:bg-zinc-700 rounded text-zinc-600 hover:text-zinc-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                                disabled={idx === variationNodes.length - 1}
                                                title="下移"
                                            >
                                                <ChevronDown size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteVariation(e, sibling)}
                                                className="p-1 hover:bg-red-900/50 rounded text-zinc-600 hover:text-red-400 transition-colors ml-1"
                                                title="刪除此變著"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : null}

                {/* Resizer 2 (Visible if variations exist) */}
                {variationNodes.length > 0 && (
                    <div
                        className="h-1.5 bg-zinc-800 hover:bg-amber-600 cursor-row-resize transition-colors shrink-0 z-20"
                        onMouseDown={() => onMouseDown('resizer2')}
                    />
                )}

                {/* Comments (Resizable) */}
                <div
                    className="p-3 bg-zinc-900 flex flex-col overflow-hidden"
                    style={{ flex: `${variationNodes.length > 0 ? heights.comments : (100 - heights.moves)} 0 0%` }}
                >
                    <div className="relative group flex-1 flex flex-col min-h-0">
                        <MessageSquare size={14} className="absolute top-3 left-3 text-zinc-500 group-focus-within:text-amber-500 transition-colors z-10" />
                        <textarea
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-9 pr-3 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none flex-1 transition-all custom-scrollbar"
                            placeholder={isRoot ? "添加開始局面注釋..." : "添加當前局面注釋..."}
                            value={currentNode.comment || ""}
                            onChange={(e) => onUpdateComment(currentNode.id, e.target.value)}
                        ></textarea>
                    </div>
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1 no-scrollbar shrink-0 items-center">
                        {clipboardTags.map(tag => (
                            <button key={tag} onClick={() => onUpdateComment(currentNode.id, ((currentNode.comment || "") + " " + tag).trim())}
                                className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-400 whitespace-nowrap transition-colors">
                                {tag}
                            </button>
                        ))}
                        <button
                            onClick={onEditTags}
                            className="p-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                            title="自定義標籤"
                        >
                            <Settings size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MoveListPanel;
