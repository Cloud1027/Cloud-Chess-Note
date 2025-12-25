
import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, RotateCw, RefreshCcw, Trash2, ArrowUpDown } from 'lucide-react';
import ChessBoard from './ChessBoard';
import { Piece, PieceColor, Point } from '../types';
import { INITIAL_BOARD_SETUP, PIECES } from '../constants';
import { getFen, fenToBoard, validatePiecePlacement } from '../lib/utils';

interface BoardEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialFen: string;
    onConfirm: (fen: string) => void;
    isFlippedInitial: boolean;
}

const PIECE_TYPES = ['king', 'advisor', 'elephant', 'horse', 'chariot', 'cannon', 'soldier'];
const PIECE_LIMITS: Record<string, number> = {
    king: 1, advisor: 2, elephant: 2, horse: 2, chariot: 2, cannon: 2, soldier: 5
};

const BoardEditorModal: React.FC<BoardEditorModalProps> = ({ isOpen, onClose, initialFen, onConfirm, isFlippedInitial }) => {
    // Editor State
    const [board, setBoard] = useState<(Piece | null)[][]>(INITIAL_BOARD_SETUP());
    const [turn, setTurn] = useState<PieceColor>('red');
    const [isFlipped, setIsFlipped] = useState(isFlippedInitial);
    
    // Selection State
    // Selected from Board: { type: 'board', r, c }
    // Selected from Box: { type: 'box', pieceType, color }
    const [selectedSource, setSelectedSource] = useState<{type: 'board', r: number, c: number} | {type: 'box', piece: Piece} | null>(null);
    
    // Mini Selector Popup State
    const [miniSelector, setMiniSelector] = useState<{r: number, c: number, x: number, y: number} | null>(null);
    
    // UI State
    const [fenInput, setFenInput] = useState('');
    const [copyFeedback, setCopyFeedback] = useState(false);
    
    // Double Click Detection
    const lastClickTimeRef = useRef<{time: number, r: number, c: number} | null>(null);
    // TextArea Ref for fallback focus
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Init
    useEffect(() => {
        if (isOpen) {
            const { board: loadedBoard, turn: loadedTurn } = fenToBoard(initialFen);
            setBoard(loadedBoard);
            setTurn(loadedTurn);
            setFenInput(initialFen);
            setSelectedSource(null);
            setMiniSelector(null);
            setIsFlipped(isFlippedInitial);
        }
    }, [isOpen, initialFen, isFlippedInitial]);

    // Update FEN when board changes
    useEffect(() => {
        if (isOpen) {
            const newFen = getFen(board, turn);
            setFenInput(newFen);
        }
    }, [board, turn, isOpen]);

    if (!isOpen) return null;

    // --- Actions ---

    const handleSquareClick = (p: Point, rect: DOMRect) => {
        const now = Date.now();
        const last = lastClickTimeRef.current;
        const isDouble = last && (now - last.time < 300) && last.r === p.r && last.c === p.c;
        lastClickTimeRef.current = { time: now, r: p.r, c: p.c };

        // Hide Mini Selector if open
        if (miniSelector) setMiniSelector(null);

        const clickedPiece = board[p.r][p.c];

        // 1. Double Click -> Remove Piece (Clear)
        if (isDouble && clickedPiece) {
            const newBoard = board.map(row => [...row]);
            newBoard[p.r][p.c] = null;
            setBoard(newBoard);
            setSelectedSource(null);
            return;
        }

        // 2. Handle Placement (If we have a selection)
        if (selectedSource) {
            let pieceToPlace: Piece | null = null;
            
            if (selectedSource.type === 'box') {
                pieceToPlace = selectedSource.piece;
            } else {
                // From Board
                pieceToPlace = board[selectedSource.r][selectedSource.c];
            }

            if (pieceToPlace) {
                // Validate Placement
                if (!validatePiecePlacement(pieceToPlace.type, pieceToPlace.color, p.r, p.c)) {
                    // Invalid placement -> Shake or just select the target instead?
                    // If clicked on another piece, maybe select that instead
                    if (clickedPiece) {
                        setSelectedSource({ type: 'board', r: p.r, c: p.c });
                    } else {
                        // Clicking empty invalid spot -> Deselect
                        setSelectedSource(null);
                    }
                    return;
                }

                // Execute Move/Place
                const newBoard = board.map(row => [...row]);
                
                // If moving from board, clear source first
                if (selectedSource.type === 'board') {
                    // If source == target, just deselect
                    if (selectedSource.r === p.r && selectedSource.c === p.c) {
                        setSelectedSource(null);
                        return;
                    }
                    newBoard[selectedSource.r][selectedSource.c] = null;
                }

                // Place piece
                newBoard[p.r][p.c] = pieceToPlace;
                setBoard(newBoard);
                setSelectedSource(null);
            }
            return;
        }

        // 3. Handle Selection (No current selection)
        if (clickedPiece) {
            setSelectedSource({ type: 'board', r: p.r, c: p.c });
        } else {
            // Clicked Empty Spot -> Show Mini Selector
            setMiniSelector({ r: p.r, c: p.c, x: 0, y: 0 }); // Coords are logic, x/y unused if centered
        }
    };

    const handleBoxSelect = (piece: Piece) => {
        // If we select a piece from box, set it as source
        setSelectedSource({ type: 'box', piece });
        setMiniSelector(null);
    };

    const handleReset = () => {
        setBoard(INITIAL_BOARD_SETUP());
        setTurn('red');
    };

    const handleClear = () => {
        // Clear all except Kings
        const newBoard = Array(10).fill(null).map(() => Array(9).fill(null));
        // Find kings in current board to keep them? Or just place default kings?
        // Usually editors place kings at default spots if cleared.
        // Red King
        newBoard[9][4] = { type: 'king', color: 'red', text: PIECES.red.king };
        // Black King
        newBoard[0][4] = { type: 'king', color: 'black', text: PIECES.black.king };
        setBoard(newBoard);
    };

    const handleCopy = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(fenInput).then(() => {
                setCopyFeedback(true);
                setTimeout(() => setCopyFeedback(false), 2000);
            }).catch(err => {
                // If write fails, select text
                textareaRef.current?.select();
            });
        } else {
            textareaRef.current?.select();
            try {
                document.execCommand('copy');
                setCopyFeedback(true);
                setTimeout(() => setCopyFeedback(false), 2000);
            } catch (e) {}
        }
    };

    const handlePaste = async () => {
        try {
            // Check for API support
            if (!navigator.clipboard || !navigator.clipboard.readText) {
                throw new Error("Clipboard API not supported");
            }

            const text = await navigator.clipboard.readText();
            if (text) {
                if (text.indexOf('/') === -1) {
                    alert('剪貼簿內容似乎不是有效的 FEN (格式不符)');
                    return;
                }
                
                try {
                    const { board: newBoard, turn: newTurn } = fenToBoard(text);
                    setBoard(newBoard);
                    setTurn(newTurn);
                } catch (err) {
                    alert('FEN 解析失敗，請確認格式');
                }
            } else {
                 // Empty clipboard logic if needed
            }
        } catch (e) {
            // Suppress console error for known permission issues to avoid confusing users/developers
            // console.error("Paste failed", e);
            
            // Provide a gentle fallback instructions
            alert('無法自動讀取剪貼簿 (瀏覽器權限限制)。\n\n請手動將 FEN 貼上至下方的輸入框中 (Ctrl+V)。');
            
            // Focus the textarea to help the user
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.select();
            }
        }
    };

    // Calculate Counts for Box Dimming
    const getPieceCounts = () => {
        const counts: Record<string, number> = {};
        board.flat().forEach(p => {
            if (p) {
                const key = `${p.color}-${p.type}`;
                counts[key] = (counts[key] || 0) + 1;
            }
        });
        return counts;
    };
    const pieceCounts = getPieceCounts();

    // Render helper for a piece button
    const renderPieceBtn = (type: string, color: 'red' | 'black', label: string) => {
        const count = pieceCounts[`${color}-${type}`] || 0;
        const max = PIECE_LIMITS[type];
        const isMaxed = count >= max;
        const p: Piece = { type: type as any, color, text: label };
        const isSelected = selectedSource?.type === 'box' && selectedSource.piece.color === color && selectedSource.piece.type === type;

        return (
            <button 
                key={`${color}-${type}`}
                onClick={() => handleBoxSelect(p)}
                className={`
                    w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold font-serif text-lg shadow-sm border
                    ${isSelected ? 'ring-2 ring-blue-500 scale-110 z-10' : ''}
                    ${isMaxed ? 'opacity-30 cursor-not-allowed bg-zinc-800 border-zinc-700 grayscale' : 'cursor-pointer hover:brightness-110'}
                    ${color === 'red' 
                        ? (isMaxed ? 'text-zinc-500' : 'bg-[#f0d9b5] text-[#a61c1c] border-[#a61c1c]') 
                        : (isMaxed ? 'text-zinc-500' : 'bg-[#f0d9b5] text-black border-black')
                    }
                `}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full h-full md:max-w-6xl flex flex-col md:flex-row overflow-hidden bg-zinc-900 md:rounded-xl md:h-[95vh] md:border border-zinc-800 shadow-2xl">
                
                {/* 1. Board Area (Top on mobile, Left on desktop) */}
                <div className="flex-1 relative bg-[#2a2a2e] flex items-center justify-center p-2 min-h-0">
                    <div className="w-full h-full max-w-[600px] flex flex-col justify-center">
                        <ChessBoard 
                            currentBoard={board}
                            isFlipped={isFlipped}
                            isMirrored={false}
                            mode="edit"
                            selectedCoord={selectedSource?.type === 'board' ? {r: selectedSource.r, c: selectedSource.c} : null}
                            onSquareClick={handleSquareClick}
                        />
                    </div>

                    {/* Mini Selector Overlay */}
                    {miniSelector && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setMiniSelector(null)}>
                            <div className="bg-zinc-800 p-4 rounded-xl shadow-2xl border border-zinc-700 grid grid-cols-4 gap-3 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                <div className="col-span-4 text-center text-zinc-400 text-xs mb-1 font-bold">
                                    選擇棋子放入 ({miniSelector.r}, {miniSelector.c})
                                </div>
                                {(['red', 'black'] as const).map(color => (
                                    PIECE_TYPES.map(type => {
                                        if (!validatePiecePlacement(type, color, miniSelector.r, miniSelector.c)) return null;
                                        const label = (PIECES as any)[color][type];
                                        return (
                                            <button 
                                                key={`mini-${color}-${type}`}
                                                onClick={() => {
                                                    const newBoard = board.map(row => [...row]);
                                                    newBoard[miniSelector.r][miniSelector.c] = { type: type as any, color, text: label };
                                                    setBoard(newBoard);
                                                    setMiniSelector(null);
                                                }}
                                                className="w-10 h-10 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center border border-zinc-600 shadow-sm"
                                            >
                                                <span className={`font-bold font-serif text-lg ${color === 'red' ? 'text-red-500' : 'text-black bg-white/10 rounded-full w-8 h-8 flex items-center justify-center'}`}>
                                                    {label}
                                                </span>
                                            </button>
                                        );
                                    })
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Controls (Bottom on mobile, Right on desktop) */}
                <div className="w-full md:w-80 bg-zinc-900 border-t md:border-t-0 md:border-l border-zinc-800 flex flex-col shrink-0 h-auto max-h-[50vh] md:max-h-none">
                    
                    {/* Header (Desktop only) */}
                    <div className="hidden md:flex px-4 py-3 border-b border-zinc-800 justify-between items-center bg-zinc-900">
                        <h3 className="font-bold text-zinc-200">棋盤編輯器</h3>
                        <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white"><X size={20} /></button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 md:space-y-6 custom-scrollbar">
                        
                        {/* Piece Box Selector - Unified Container */}
                        <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/50">
                            {/* Red Row */}
                            <div className="flex justify-between gap-1 mb-2">
                                {PIECE_TYPES.map(type => {
                                    if(type === 'king') return null;
                                    return renderPieceBtn(type, 'red', PIECES.red[type]);
                                })}
                            </div>
                            {/* Black Row */}
                            <div className="flex justify-between gap-1">
                                {PIECE_TYPES.map(type => {
                                    if(type === 'king') return null;
                                    return renderPieceBtn(type, 'black', PIECES.black[type]);
                                })}
                            </div>
                        </div>

                        {/* Actions Grid */}
                        <div className="grid grid-cols-4 gap-2">
                            <button onClick={handleReset} className="flex flex-col items-center justify-center p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-xs gap-1 text-zinc-300 border border-zinc-700">
                                <RotateCw size={16} /> <span className="scale-90">擺滿</span>
                            </button>
                            <button onClick={handleClear} className="flex flex-col items-center justify-center p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-xs gap-1 text-zinc-300 border border-zinc-700">
                                <Trash2 size={16} /> <span className="scale-90">清空</span>
                            </button>
                            <button onClick={() => setIsFlipped(!isFlipped)} className="flex flex-col items-center justify-center p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-xs gap-1 text-zinc-300 border border-zinc-700">
                                <ArrowUpDown size={16} /> <span className="scale-90">翻轉</span>
                            </button>
                            <button onClick={() => setTurn(turn === 'red' ? 'black' : 'red')} className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs gap-1 font-bold border transition-colors ${turn === 'red' ? 'bg-red-900/20 text-red-400 border-red-900/50' : 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}>
                                <RefreshCcw size={16} /> <span className="scale-90">{turn === 'red' ? '紅先' : '黑先'}</span>
                            </button>
                        </div>

                        {/* FEN IO - Compact */}
                        <div className="flex gap-2">
                            <button onClick={handleCopy} className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-600/30 rounded-lg text-sm flex items-center justify-center gap-1.5 font-medium transition-colors">
                                {copyFeedback ? <Check size={14} /> : <Copy size={14} />} 複製 FEN
                            </button>
                            <button onClick={handlePaste} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium transition-colors">
                                貼上 FEN
                            </button>
                        </div>
                        
                        {/* FEN Input (Desktop only or optional expand?) 
                            On mobile, users mostly use buttons. We can hide the textarea to save space or make it small.
                        */}
                        <textarea 
                            ref={textareaRef}
                            value={fenInput}
                            onChange={(e) => {
                                setFenInput(e.target.value);
                                try {
                                    const { board: b, turn: t } = fenToBoard(e.target.value);
                                    setBoard(b);
                                    setTurn(t);
                                } catch {}
                            }}
                            placeholder="FEN 串..."
                            className="w-full h-14 bg-black/20 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none focus:border-amber-500 focus:bg-black/40 resize-none transition-colors"
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex gap-3 shrink-0 pb-6 md:pb-4">
                        <button onClick={onClose} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-lg transition-colors text-sm">
                            取消
                        </button>
                        <button onClick={() => onConfirm(fenInput)} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-amber-900/20 text-sm">
                            確定
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BoardEditorModal;
