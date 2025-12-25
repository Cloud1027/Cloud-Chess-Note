
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { MoveNode, Piece, Point, MemorizationConfig, MemorizationError, PieceColor } from '../types';
import { INITIAL_BOARD_SETUP } from '../constants';
import { getFen, getChineseNotation, fenToBoard, validatePiecePlacement } from '../lib/utils';

export interface NotificationState {
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export interface ConfirmState {
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

// Sound Helper
// Note: Sound files must be in the /public/sounds/ directory
const playSound = (pieceType: string, isCapture: boolean, enabled: boolean) => {
    if (!enabled) return;
    try {
        // Determine sound file
        let soundFile = 'move';
        if (isCapture) {
            // Cannon usually has a distinct capture sound (bomb)
            soundFile = (pieceType === 'cannon' || pieceType === 'C' || pieceType === 'c') ? 'bomb' : 'eat';
        }

        const audio = new Audio(`/sounds/${soundFile}.mp3`);
        audio.volume = 1.0;
        
        // Play and handle potential autoplay restrictions
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch((error) => {
                console.warn("Audio play failed (interaction required or file missing):", error);
            });
        }
    } catch (e) {
        console.error("Audio error:", e);
    }
};

// Helper to ignore move counters for FEN comparison
const getBaseFen = (fen: string): string => {
    const parts = fen.split(' ');
    // Join first 2 parts: board state + turn
    return parts.slice(0, 2).join(' ');
};

// Recursive function to deep copy a branch with new IDs
const cloneBranch = (sourceNode: MoveNode, newParentId: string | null): MoveNode => {
    const newId = 'link-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const newNode: MoveNode = {
        ...sourceNode,
        id: newId,
        parentId: newParentId,
        // Deep copy children
        children: [] 
    };
    
    newNode.children = sourceNode.children.map(child => cloneBranch(child, newId));
    
    // Fix selection logic for cloned node
    if (sourceNode.selectedChildId) {
        const selectedIndex = sourceNode.children.findIndex(c => c.id === sourceNode.selectedChildId);
        if (selectedIndex !== -1 && newNode.children[selectedIndex]) {
            newNode.selectedChildId = newNode.children[selectedIndex].id;
        } else {
            newNode.selectedChildId = newNode.children.length > 0 ? newNode.children[0].id : null;
        }
    }
    
    return newNode;
};

// Recursive Merge Function
const mergeDeep = (targetChildren: MoveNode[], sourceChildren: MoveNode[], targetParentId: string): number => {
    let addedCount = 0;

    for (const source of sourceChildren) {
        if (!source.move) continue;

        const existingTarget = targetChildren.find(t => t.move?.notation === source.move?.notation);

        if (existingTarget) {
            mergeDeep(existingTarget.children, source.children, existingTarget.id);
        } else {
            const newNode = cloneBranch(source, targetParentId);
            targetChildren.push(newNode);
            addedCount++;
        }
    }
    return addedCount;
};

export const useMoveTree = (enableSound: boolean = true) => {
    // 1. State
    const initialBoard = INITIAL_BOARD_SETUP();
    const initialFen = getFen(initialBoard, 'red');

    const [rootNode, setRootNode] = useState<MoveNode>({
        id: 'root',
        parentId: null,
        move: null,
        boardState: initialBoard,
        children: [],
        comment: '',
        turn: 'red',
        selectedChildId: null,
        fen: initialFen
    });

    const [currentNodeId, setCurrentNodeId] = useState<string>('root');
    const [notification, setNotification] = useState<NotificationState>({ show: false, title: '', message: '', type: 'info' });
    const [confirmState, setConfirmState] = useState<ConfirmState>({ show: false, title: '', message: '', onConfirm: () => {} });
    
    // Memorization State
    const [memConfig, setMemConfig] = useState<MemorizationConfig>({ active: false, side: 'red', mode: 'main', randomRange: '' });
    const [memErrors, setMemErrors] = useState<MemorizationError[]>([]);
    const [memTotalSteps, setMemTotalSteps] = useState(0);
    const [memStartNodeId, setMemStartNodeId] = useState<string>('root'); 
    const [showReport, setShowReport] = useState(false);
    const computerTimeoutRef = useRef<number | null>(null);

    const closeNotification = () => setNotification(prev => ({ ...prev, show: false }));
    
    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setConfirmState({ show: true, title, message, onConfirm });
    };

    const closeConfirm = () => {
        setConfirmState(prev => ({ ...prev, show: false }));
    };

    // 2. Helpers
    const findNodeById = (id: string, startNode: MoveNode): MoveNode | null => {
        if (startNode.id === id) return startNode;
        for (const child of startNode.children) {
            const found = findNodeById(id, child);
            if (found) return found;
        }
        return null;
    };

    const findNodeContext = (root: MoveNode, targetId: string) => {
        const search = (node: MoveNode, parent: MoveNode | null, index: number): { node: MoveNode, parent: MoveNode | null, index: number } | null => {
            if (node.id === targetId) return { node, parent, index };
            for (let i = 0; i < node.children.length; i++) {
                const result = search(node.children[i], node, i);
                if (result) return result;
            }
            return null;
        };
        return search(root, null, -1);
    };

    const getPathToNode = (targetId: string, startNode: MoveNode): MoveNode[] | null => {
        if (startNode.id === targetId) return [startNode];
        for (const child of startNode.children) {
            const path = getPathToNode(targetId, child);
            if (path) return [startNode, ...path];
        }
        return null;
    };

    const getRoundNumber = (nodeId: string): number => {
        const path = getPathToNode(nodeId, rootNode);
        if (!path) return 1;
        return Math.floor((path.length - 1) / 2) + 1;
    };

    // 3. Computed Properties
    const currentNode = useMemo(() => {
        return findNodeById(currentNodeId, rootNode) || rootNode;
    }, [rootNode, currentNodeId]);

    const activePath = useMemo(() => {
        const pastPath = getPathToNode(currentNode.id, rootNode);
        if (!pastPath) return [rootNode];

        const futurePath: MoveNode[] = [];
        let curr = currentNode;
        let depth = 0;
        while (curr.children.length > 0 && depth < 200) {
            let nextChild = curr.selectedChildId 
                ? curr.children.find(c => c.id === curr.selectedChildId)
                : curr.children[0];
            if (!nextChild) nextChild = curr.children[0];
            futurePath.push(nextChild);
            curr = nextChild;
            depth++;
        }
        return [...pastPath, ...futurePath];
    }, [currentNode, rootNode]); 

    // --- Memorization: Computer Logic ---
    useEffect(() => {
        if (!memConfig.active) {
            if (computerTimeoutRef.current) clearTimeout(computerTimeoutRef.current);
            return;
        }
        
        const curr = findNodeById(currentNodeId, rootNode);
        if (!curr) return;

        if (curr.children.length === 0) {
            computerTimeoutRef.current = window.setTimeout(() => {
                setMemConfig(prev => ({ ...prev, active: false }));
                setShowReport(true);
            }, 1000);
            return;
        }

        const isPlayerTurn = memConfig.side === 'both' || curr.turn === memConfig.side;

        if (!isPlayerTurn) {
            // Computer moves
            computerTimeoutRef.current = window.setTimeout(() => {
                const candidates = curr.children;
                let nextNode: MoveNode | undefined;

                if (memConfig.mode === 'random') {
                    let allowedIndices = candidates.map((_, i) => i);
                    if (memConfig.randomRange) {
                        try {
                            const range = memConfig.randomRange.toUpperCase();
                            const parts = range.split(/[,\s]+/);
                            const whitelist: number[] = [];
                            parts.forEach(p => {
                                if (p.includes('-')) {
                                    const [start, end] = p.split('-');
                                    const s = start.charCodeAt(0) - 65;
                                    const e = end.charCodeAt(0) - 65;
                                    if (!isNaN(s) && !isNaN(e)) {
                                        for(let k=Math.min(s,e); k<=Math.max(s,e); k++) whitelist.push(k);
                                    }
                                } else {
                                    const idx = p.charCodeAt(0) - 65;
                                    if (!isNaN(idx)) whitelist.push(idx);
                                }
                            });
                            if (whitelist.length > 0) {
                                allowedIndices = allowedIndices.filter(i => whitelist.includes(i));
                            }
                        } catch (e) {}
                    }

                    if (allowedIndices.length === 0) allowedIndices = candidates.map((_, i) => i);
                    const randIndex = allowedIndices[Math.floor(Math.random() * allowedIndices.length)];
                    nextNode = candidates[randIndex];
                } else {
                    nextNode = candidates[0];
                }

                if (nextNode) {
                    setCurrentNodeId(nextNode.id);
                    if (nextNode.move) {
                        playSound(nextNode.move.piece.type, !!nextNode.move.captured, enableSound);
                    }
                }
            }, 800);
        }

        return () => {
            if (computerTimeoutRef.current) clearTimeout(computerTimeoutRef.current);
        };
    }, [memConfig, currentNodeId, rootNode, enableSound]);


    // 4. Actions

    const importGame = (fen: string, moves: { moveStr: string, notation: string, comment?: string }[], treeRoot?: MoveNode) => {
        if (treeRoot) {
            if (!treeRoot.comment) treeRoot.comment = '';
            setRootNode(treeRoot);
            setCurrentNodeId(treeRoot.id);
            return;
        }

        const { board, turn } = fenToBoard(fen);
        const newRoot: MoveNode = {
            id: 'root-' + Date.now(),
            parentId: null,
            move: null,
            boardState: board,
            children: [],
            comment: '',
            turn: turn,
            selectedChildId: null,
            fen: fen
        };

        let currentNode = newRoot;
        let currentBoard = board;
        let currentTurn = turn;

        for (const m of moves) {
            const [fromIdx, toIdx] = m.moveStr.split('-').map(Number);
            const from = { r: Math.floor(fromIdx / 9), c: fromIdx % 9 };
            const to = { r: Math.floor(toIdx / 9), c: toIdx % 9 };
            
            const piece = currentBoard[from.r][from.c];
            if (!piece) break;

            const captured = currentBoard[to.r][to.c];
            
            const newBoard = currentBoard.map(row => [...row]);
            newBoard[to.r][to.c] = piece;
            newBoard[from.r][from.c] = null;
            
            const nextTurn = currentTurn === 'red' ? 'black' : 'red';
            const newFen = getFen(newBoard, nextTurn);

            const newNode: MoveNode = {
                id: 'node-' + Date.now() + Math.random().toString().slice(2, 6),
                parentId: currentNode.id,
                move: { from, to, piece, captured, notation: m.notation },
                boardState: newBoard,
                children: [],
                comment: m.comment || '',
                turn: nextTurn,
                selectedChildId: null,
                fen: newFen
            };

            currentNode.children.push(newNode);
            currentNode.selectedChildId = newNode.id;
            
            currentNode = newNode;
            currentBoard = newBoard;
            currentTurn = nextTurn;
        }

        setRootNode(newRoot);
        setCurrentNodeId(newRoot.id);
    };

    const addMove = (moveData: { from: Point; to: Point; piece: Piece; captured: Piece | null; notation: string }, newBoard: (Piece|null)[][]) => {
        if (memConfig.active) {
            const curr = findNodeById(currentNodeId, rootNode);
            if (!curr) return false;

            const isPlayerTurn = memConfig.side === 'both' || curr.turn === memConfig.side;
            if (!isPlayerTurn) return false; 

            const matchedChild = curr.children.find(child => {
                if (!child.move) return false;
                const m = child.move;
                return m.from.r === moveData.from.r && m.from.c === moveData.from.c &&
                       m.to.r === moveData.to.r && m.to.c === moveData.to.c;
            });

            if (matchedChild) {
                // Correct Move
                setCurrentNodeId(matchedChild.id);
                // Play sound for correct move
                playSound(moveData.piece.type, !!moveData.captured, enableSound);
                setMemTotalSteps(n => n + 1);
                return true;
            } else {
                // Wrong Move
                const round = getRoundNumber(curr.id);
                setMemErrors(prev => {
                    const idx = prev.findIndex(e => e.nodeId === curr.id);
                    if (idx >= 0) {
                        const newArr = [...prev];
                        newArr[idx] = { ...newArr[idx], count: newArr[idx].count + 1 };
                        return newArr;
                    } else {
                        const corrects = curr.children.map(c => c.move?.notation || '未知');
                        return [...prev, { round, nodeId: curr.id, correctNotations: corrects, count: 1 }];
                    }
                });
                return false; 
            }
        }

        // --- Play Sound ---
        playSound(moveData.piece.type, !!moveData.captured, enableSound);

        const newRoot = JSON.parse(JSON.stringify(rootNode));
        const ctx = findNodeContext(newRoot, currentNodeId);
        if (!ctx) return false; 
        const nodeInNewTree = ctx.node;

        const existingChild = nodeInNewTree.children.find((child: MoveNode) => child.move?.notation === moveData.notation);

        if (existingChild) {
            nodeInNewTree.selectedChildId = existingChild.id;
            setRootNode(newRoot);
            setCurrentNodeId(existingChild.id);
        } else {
            const nextTurn = nodeInNewTree.turn === 'red' ? 'black' : 'red';
            const newFen = getFen(newBoard, nextTurn);

            const newNode: MoveNode = {
                id: Date.now().toString() + Math.random().toString().slice(2,6),
                parentId: nodeInNewTree.id,
                move: moveData,
                boardState: newBoard,
                children: [],
                comment: '',
                turn: nextTurn,
                selectedChildId: null,
                fen: newFen
            };
            
            nodeInNewTree.children.push(newNode);
            nodeInNewTree.selectedChildId = newNode.id;
            setRootNode(newRoot);
            setCurrentNodeId(newNode.id);
        }
        return true;
    };

    const getHint = useCallback(() => {
        const curr = findNodeById(currentNodeId, rootNode);
        if (!curr || curr.children.length === 0) return null;
        const target = curr.selectedChildId 
            ? curr.children.find(c => c.id === curr.selectedChildId) 
            : curr.children[0];
        
        return target?.move ? { from: target.move.from, to: target.move.to } : null;
    }, [currentNodeId, rootNode]);

    const jumpToMove = (targetNode: MoveNode) => {
        if (memConfig.active) return; 
        const newRoot = JSON.parse(JSON.stringify(rootNode));
        const getPath = (r: MoveNode, tId: string): MoveNode[] | null => {
            if (r.id === tId) return [r];
            for (const c of r.children) {
                const res = getPath(c, tId);
                if (res) return [r, ...res];
            }
            return null;
        };
        const path = getPath(newRoot, targetNode.id);
        if (path) {
            for (let i = 0; i < path.length - 1; i++) {
                path[i].selectedChildId = path[i+1].id;
            }
        }
        setRootNode(newRoot);
        setCurrentNodeId(targetNode.id);
    };

    const updateComment = (id: string, text: string) => {
        const newRoot = JSON.parse(JSON.stringify(rootNode));
        const ctx = findNodeContext(newRoot, id);
        if (ctx) {
            ctx.node.comment = text;
            setRootNode(newRoot);
        }
    };

    const batchUpdateComments = (updates: {id: string, text: string}[]) => {
        const newRoot = JSON.parse(JSON.stringify(rootNode));
        let updatedCount = 0;
        updates.forEach(({id, text}) => {
             const ctx = findNodeContext(newRoot, id);
             if (ctx) {
                 ctx.node.comment = text;
                 updatedCount++;
             }
        });
        if (updatedCount > 0) setRootNode(newRoot);
    };

    const deleteCurrentMove = () => {
        if (currentNodeId === 'root') {
             setNotification({ show: true, title: '操作無效', message: '無法刪除起始局面。', type: 'error' });
             return;
        }
        deleteNode(currentNodeId);
    };

    const deleteNode = (nodeId: string) => {
        if (nodeId === 'root') return;
        
        const newRoot = JSON.parse(JSON.stringify(rootNode));
        const ctx = findNodeContext(newRoot, nodeId);
        
        if (!ctx || !ctx.parent) return;
        const { parent, index } = ctx;
        
        parent.children.splice(index, 1);
        
        let nextNodeId = parent.id; 
        
        if (parent.selectedChildId === nodeId) {
            if (parent.children.length > 0) {
                const newIndex = Math.min(index, parent.children.length - 1);
                const sibling = parent.children[newIndex];
                parent.selectedChildId = sibling.id;
            } else {
                parent.selectedChildId = null;
            }
        }
        
        const exists = findNodeById(currentNodeId, newRoot);
        
        if (!exists) {
            if (parent.selectedChildId) {
                nextNodeId = parent.selectedChildId;
            } else {
                nextNodeId = parent.id;
            }
            setCurrentNodeId(nextNodeId);
        }

        setRootNode(newRoot);
        setNotification({ show: true, title: '刪除成功', message: '已刪除該著法。', type: 'success' });
    };

    const reorderChildren = (childId: string, direction: 'up' | 'down') => {
        const newRoot = JSON.parse(JSON.stringify(rootNode));
        const ctx = findNodeContext(newRoot, childId);
        if (ctx && ctx.parent) {
            const { parent, index } = ctx;
            const siblings = parent.children;
            if (direction === 'up' && index > 0) {
                [siblings[index], siblings[index - 1]] = [siblings[index - 1], siblings[index]];
                setRootNode(newRoot);
            } else if (direction === 'down' && index < siblings.length - 1) {
                [siblings[index], siblings[index + 1]] = [siblings[index + 1], siblings[index]];
                setRootNode(newRoot);
            }
        }
    };

    // --- RECURSIVE LINKING LOGIC ---
    const linkMovesByFen = () => {
        if (currentNodeId === 'root') {
            setNotification({ show: true, title: '操作無效', message: '起始局面無法串聯。', type: 'error' });
            return;
        }

        const newRoot = JSON.parse(JSON.stringify(rootNode));
        const targetFen = currentNode.fen;
        const targetBaseFen = getBaseFen(targetFen);
        
        // 1. Find all identical positions (same FEN) in the tree
        const matchingNodes: MoveNode[] = [];
        const traverse = (n: MoveNode) => {
            if (getBaseFen(n.fen) === targetBaseFen) {
                matchingNodes.push(n);
            }
            n.children.forEach(traverse);
        };
        traverse(newRoot);

        if (matchingNodes.length < 2) {
            setNotification({ show: true, title: '無需串聯', message: '此局面在當前棋譜中是唯一的。', type: 'info' });
            return;
        }

        // 2. Accumulate ALL variations into a temporary "Union List"
        const unionChildren: MoveNode[] = [];
        
        matchingNodes.forEach(node => {
            mergeDeep(unionChildren, node.children, 'temp-union-parent');
        });

        // 3. Apply the Union List back to EVERY matching node.
        let totalAdded = 0;
        
        matchingNodes.forEach(node => {
            const added = mergeDeep(node.children, unionChildren, node.id);
            totalAdded += added;
        });

        if (totalAdded > 0) {
            setRootNode(newRoot);
            setNotification({ 
                show: true, 
                title: '串聯完成', 
                message: `已同步 ${matchingNodes.length} 個相同局面。\n因遞迴合併，共補充了 ${totalAdded} 個變著分支(含深層變著)。`, 
                type: 'success' 
            });
        } else {
            setNotification({ 
                show: true, 
                title: '無需更新', 
                message: `發現 ${matchingNodes.length} 個相同局面，且它們的所有後續變化已完全一致。`, 
                type: 'info' 
            });
        }
    };

    const navigate = useCallback((direction: 'prev' | 'next' | 'start' | 'end') => {
        if (memConfig.active) return;
        if (direction === 'start') { setCurrentNodeId(rootNode.id); return; }
        const curr = findNodeById(currentNodeId, rootNode);
        if (!curr) return;
        if (direction === 'prev') {
            if (curr.parentId) setCurrentNodeId(curr.parentId);
        } else if (direction === 'next') {
            if (curr.children.length > 0) {
                const nextId = curr.selectedChildId || curr.children[0].id;
                setCurrentNodeId(nextId);
            }
        } else if (direction === 'end') {
            let temp = curr;
            while(temp.children.length > 0) {
                const nextChild = temp.selectedChildId ? temp.children.find(c => c.id === temp.selectedChildId) : temp.children[0];
                if (nextChild) temp = nextChild; else temp = temp.children[0];
            }
            setCurrentNodeId(temp.id);
        }
    }, [currentNodeId, rootNode, memConfig.active]);

    const navigateVariation = useCallback((direction: 'prev' | 'next') => {
        if (memConfig.active) return;
        
        let curr = findNodeById(currentNodeId, rootNode);
        if (!curr) return;

        if (direction === 'prev') {
            if (curr.parentId) {
                curr = findNodeById(curr.parentId, rootNode);
            } else {
                setNotification({ show: true, title: '提示', message: '無上一個變著節點', type: 'info' });
                return;
            }

            while (curr && curr.parentId) {
                const parent = findNodeById(curr.parentId, rootNode);
                if (!parent) break;
                
                if (parent.children.length > 1) {
                    setCurrentNodeId(curr.id); 
                    return;
                }
                
                curr = parent; 
            }
            setNotification({ show: true, title: '提示', message: '無上一個變著節點', type: 'info' });
        } else {
            while (curr.children.length > 0) {
                if (curr.children.length > 1) {
                    const nextId = curr.selectedChildId || curr.children[0].id;
                    setCurrentNodeId(nextId); 
                    return;
                }
                
                const nextId = curr.selectedChildId || curr.children[0].id;
                curr = curr.children.find(c => c.id === nextId) || curr.children[0];
            }
            setNotification({ show: true, title: '提示', message: '無下一個變著節點', type: 'info' });
        }
    }, [currentNodeId, rootNode, memConfig.active]);

    const cycleVariation = useCallback((direction: 'up' | 'down') => {
        if (memConfig.active) return;
        
        const curr = findNodeById(currentNodeId, rootNode);
        if (!curr || !curr.parentId) return;

        const parent = findNodeById(curr.parentId, rootNode);
        if (!parent || parent.children.length <= 1) return;

        const currentIndex = parent.children.findIndex(c => c.id === curr.id);
        if (currentIndex === -1) return;

        let targetIndex = -1;
        if (direction === 'up') {
            if (currentIndex > 0) targetIndex = currentIndex - 1;
        } else {
            if (currentIndex < parent.children.length - 1) targetIndex = currentIndex + 1;
        }

        if (targetIndex !== -1) {
            const siblingId = parent.children[targetIndex].id;
            
            const newRoot = JSON.parse(JSON.stringify(rootNode));
            const parentContext = findNodeContext(newRoot, parent.id);
            
            if (parentContext) {
                parentContext.node.selectedChildId = siblingId;
                setRootNode(newRoot);
                setCurrentNodeId(siblingId);
            }
        }
    }, [currentNodeId, rootNode, memConfig.active]);

    const jumpToStep = useCallback((stepIndex: number) => {
        if (memConfig.active) return;
        const getPath = (n: MoveNode): MoveNode[] => {
            let path = [n];
            let curr = n;
            while (curr.children.length > 0) {
                 let next = curr.selectedChildId ? curr.children.find(c => c.id === curr.selectedChildId) : curr.children[0];
                 if (!next) next = curr.children[0];
                 path.push(next);
                 curr = next;
            }
            return path;
        };
        const fullPath = getPath(rootNode);
        if (stepIndex >= 0 && stepIndex < fullPath.length) {
            setCurrentNodeId(fullPath[stepIndex].id);
        }
    }, [rootNode, memConfig.active]);

    const startMemorization = (config: any) => { 
        setMemConfig({ ...config, active: true }); 
        setMemErrors([]);
        setMemTotalSteps(0);
        setMemStartNodeId(currentNodeId);
    };
    
    const stopMemorization = () => { 
        setMemConfig(prev => ({ ...prev, active: false }));
        setShowReport(true);
    };

    const setRootNodePublic = (node: MoveNode) => {
        setRootNode(node);
        setCurrentNodeId(node.id);
    };

    return {
        currentNode,
        rootNode,
        activePath,
        addMove,
        importGame, 
        jumpToMove,
        updateComment,
        batchUpdateComments,
        deleteCurrentMove,
        deleteNode,
        reorderChildren,
        linkMovesByFen,
        navigate,
        navigateVariation,
        cycleVariation, 
        jumpToStep,
        notification,
        closeNotification,
        confirmState,
        showConfirm,
        closeConfirm,
        setRootNode: setRootNodePublic,
        memConfig,
        memErrors,
        memTotalSteps,
        memStartNodeId,
        getHint,
        showReport,
        startMemorization,
        stopMemorization,
        setShowReport
    };
};
