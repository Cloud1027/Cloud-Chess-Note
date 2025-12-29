
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { GameState, Piece, Point, PieceColor, MoveNode, AppSettings } from '../types';
import { INITIAL_BOARD_SETUP } from '../constants';
import { toChineseNum, getChineseNotation } from '../lib/utils';

interface ChessBoardProps {
    currentBoard?: (Piece | null)[][];
    currentTurn?: PieceColor;
    lastMove?: { from: Point; to: Point } | null;
    onMoveMade?: (move: { from: Point; to: Point; piece: Piece; captured: Piece | null; notation: string }, newBoard: (Piece | null)[][]) => boolean;
    isFlipped: boolean;
    isMirrored: boolean;
    redName?: string;
    blackName?: string;
    // Editor Props
    mode?: 'play' | 'edit';
    selectedCoord?: Point | null; // Override internal selection
    onSquareClick?: (point: Point, rect: DOMRect) => void;
    // Visual Effects
    flashCoord?: Point | null; // Coordinate to flash "X"
    hintMove?: { from: Point; to: Point } | null; // Hint Effect

    // New props for Arrows
    currentNode?: MoveNode;
    onNodeSelect?: (node: MoveNode) => void;
    engineBestMoves?: { from: Point; to: Point; color: 'red' | 'black' }[];

    settings?: AppSettings;
    shouldAnimate?: boolean;
    isLocked?: boolean;
}

// --- Logic helpers ---
const canMove = (board: (Piece | null)[][], fr: number, fc: number, tr: number, tc: number): boolean => {
    const p = board[fr][fc];
    if (!p) return false;
    const target = board[tr][tc];
    if (target && target.color === p.color) return false;
    const dr = tr - fr; const dc = tc - fc;
    const absDr = Math.abs(dr); const absDc = Math.abs(dc);

    switch (p.type) {
        case 'king':
            if (target && target.type === 'king' && fc === tc) {
                let count = 0;
                for (let i = Math.min(fr, tr) + 1; i < Math.max(fr, tr); i++) if (board[i][fc]) count++;
                return count === 0;
            }
            return (absDr + absDc === 1) && tc >= 3 && tc <= 5 && (p.color === 'red' ? tr >= 7 : tr <= 2);
        case 'advisor': return absDr === 1 && absDc === 1 && tc >= 3 && tc <= 5 && (p.color === 'red' ? tr >= 7 : tr <= 2);
        case 'elephant': return absDr === 2 && absDc === 2 && !board[fr + dr / 2][fc + dc / 2] && (p.color === 'red' ? tr >= 5 : tr <= 4);
        case 'horse': return ((absDr === 2 && absDc === 1 && !board[fr + dr / 2][fc]) || (absDr === 1 && absDc === 2 && !board[fr][fc + dc / 2]));
        case 'chariot':
            if (fr !== tr && fc !== tc) return false;
            return countPiecesBetween(board, fr, fc, tr, tc) === 0;
        case 'cannon':
            if (fr !== tr && fc !== tc) return false;
            let count = countPiecesBetween(board, fr, fc, tr, tc);
            return target ? count === 1 : count === 0;
        case 'soldier':
            if (p.color === 'red') {
                if (tr > fr) return false;
                return fr >= 5 ? (dr === -1 && dc === 0) : (dr === -1 && dc === 0 || dr === 0 && absDc === 1);
            } else {
                if (tr < fr) return false;
                return fr <= 4 ? (dr === 1 && dc === 0) : (dr === 1 && dc === 0 || dr === 0 && absDc === 1);
            }
    }
    return false;
};

const countPiecesBetween = (board: (Piece | null)[][], fr: number, fc: number, tr: number, tc: number) => {
    let count = 0;
    if (fr === tr) { for (let j = Math.min(fc, tc) + 1; j < Math.max(fc, tc); j++) if (board[fr][j]) count++; }
    else { for (let i = Math.min(fr, tr) + 1; i < Math.max(fr, tr); i++) if (board[i][fc]) count++; }
    return count;
};

// Helper to find the king and check if it's under attack
const isKingInCheck = (board: (Piece | null)[][], kingColor: PieceColor): boolean => {
    // 1. Find King
    let kingPos: Point | null = null;
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (p && p.type === 'king' && p.color === kingColor) {
                kingPos = { r, c };
                break;
            }
        }
        if (kingPos) break;
    }
    if (!kingPos) return false;

    // 2. Check if any enemy piece can move to King's position
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const p = board[r][c];
            if (p && p.color !== kingColor) {
                if (canMove(board, r, c, kingPos.r, kingPos.c)) {
                    return true;
                }
            }
        }
    }
    return false;
};

interface AnimationState {
    active: boolean;
    startTime: number;
    duration: number;
    from: Point;
    to: Point;
    piece: Piece;
    isCannonCapture: boolean;
}

interface ShakeState {
    active: boolean;
    startTime: number;
    duration: number;
    r: number;
    c: number;
}

const ChessBoard: React.FC<ChessBoardProps> = ({
    onMoveMade,
    currentBoard,
    currentTurn,
    lastMove,
    isFlipped,
    isMirrored,
    redName,
    blackName,
    mode = 'play',
    selectedCoord,
    onSquareClick,
    flashCoord,
    hintMove,
    currentNode,
    onNodeSelect,
    settings,
    shouldAnimate = true,
    engineBestMoves,
    isLocked = false
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // Fix: useRef requires an initial value to satisfy certain TypeScript configurations.
    const requestRef = useRef<number | undefined>(undefined);

    // Unique ID for SVG defs to prevent conflicts when multiple boards exist
    const uniqueId = useMemo(() => Math.random().toString(36).substring(2, 9), []);
    const maskId = `arrowFadeMask-${uniqueId}`;
    const patternId = `flowPattern-${uniqueId}`;
    const gradientId = `fadeGradient-${uniqueId}`;
    const markerBlueId = `arrowhead-blue-${uniqueId}`;
    const markerGreenId = `arrowhead-green-${uniqueId}`;

    // Internal State
    const [localState, setLocalState] = useState<GameState>({
        board: INITIAL_BOARD_SETUP(),
        turn: 'red',
        moves: [],
        selectedPiece: null,
        lastMove: null
    });

    // Marked Squares for Orange Effect (Double click to toggle)
    const [markedSquares, setMarkedSquares] = useState<Set<string>>(new Set());

    // Refs for Animation
    const prevBoardRef = useRef<(Piece | null)[][]>(INITIAL_BOARD_SETUP());
    const animationRef = useRef<AnimationState | null>(null);
    const shakeRef = useRef<ShakeState | null>(null);
    const prevLastMoveRef = useRef<{ from: Point; to: Point } | null>(null);

    // Flash State for Wrong Moves
    const [activeFlashes, setActiveFlashes] = useState<{ r: number, c: number, id: number }[]>([]);

    // Manual Arrow State
    const [manualArrows, setManualArrows] = useState<{ from: Point, to: Point }[]>([]);
    const [dragArrow, setDragArrow] = useState<{ start: Point, current: { x: number, y: number } } | null>(null);

    // Hover State for Variation Arrows (to bring to front)
    const [hoveredVariationId, setHoveredVariationId] = useState<string | null>(null);

    useEffect(() => {
        if (flashCoord) {
            const id = Date.now();
            setActiveFlashes(prev => [...prev, { ...flashCoord, id }]);
            setTimeout(() => {
                setActiveFlashes(prev => prev.filter(f => f.id !== id));
            }, 800);
        }
    }, [flashCoord]);

    // Clear manual arrows when board changes (FEN changes implies different board)
    useEffect(() => {
        setManualArrows([]);
        setHoveredVariationId(null);
        // Only clear selection if the ACTUAL position changed (FEN), not just board reference
        setLocalState(prev => ({ ...prev, selectedPiece: null }));
    }, [currentNode?.fen]); // Changed from currentBoard to currentNode.fen

    // Handle Props Update & Trigger Animations
    useEffect(() => {
        if (currentBoard) {
            // 1. Detect Move Animation
            const hasLastMoveChanged = lastMove && (!prevLastMoveRef.current ||
                lastMove.from.r !== prevLastMoveRef.current.from.r ||
                lastMove.from.c !== prevLastMoveRef.current.from.c ||
                lastMove.to.r !== prevLastMoveRef.current.to.r ||
                lastMove.to.c !== prevLastMoveRef.current.to.c
            );

            if (hasLastMoveChanged) {
                if (shouldAnimate) {
                    const prevBoard = prevBoardRef.current;
                    const movingPiece = currentBoard[lastMove.to.r][lastMove.to.c];
                    const animDuration = settings?.animationSpeed ?? 300;

                    if (movingPiece && animDuration > 0) {
                        let isCannonCapture = false;
                        if (movingPiece.type === 'cannon') {
                            const targetInPrev = prevBoard[lastMove.to.r][lastMove.to.c];
                            if (targetInPrev && targetInPrev.color !== movingPiece.color) {
                                isCannonCapture = true;
                            }
                        }
                        animationRef.current = {
                            active: true,
                            startTime: Date.now(),
                            duration: animDuration,
                            from: lastMove.from,
                            to: lastMove.to,
                            piece: movingPiece,
                            isCannonCapture
                        };
                    }
                }
                prevLastMoveRef.current = lastMove;
            } else if (!lastMove) {
                animationRef.current = null;
                prevLastMoveRef.current = null;
            }

            // 2. Detect Check (Shake)
            const playerUnderAttack = currentTurn || 'black';
            if (isKingInCheck(currentBoard, playerUnderAttack)) {
                for (let r = 0; r < 10; r++) {
                    for (let c = 0; c < 9; c++) {
                        const p = currentBoard[r][c];
                        if (p && p.type === 'king' && p.color === playerUnderAttack) {
                            shakeRef.current = {
                                active: true,
                                startTime: Date.now() + (settings?.animationSpeed ?? 300),
                                duration: 500,
                                r, c
                            };
                            break;
                        }
                    }
                }
            } else {
                shakeRef.current = null;
            }

            setLocalState(prev => ({
                ...prev,
                board: currentBoard,
                turn: currentTurn || 'red',
                // selectedPiece: null, // Don't clear here! Let the FEN-watcher handle clearing.
                lastMove: lastMove || null
            }));

            prevBoardRef.current = currentBoard;
        }
    }, [currentBoard, currentTurn, lastMove, settings?.animationSpeed, shouldAnimate]);

    const [dimensions, setDimensions] = useState({ width: 500, height: 600, gridSize: 50, offsetX: 50, offsetY: 50, dpr: 1 });

    useEffect(() => {
        if (!containerRef.current) return;

        const updateDimensions = () => {
            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                if (clientWidth === 0 || clientHeight === 0) return;

                let horizontalGridsNeeded = 12;
                let verticalGridsNeeded = 13;
                let maxGridSize = 80;

                if (settings?.boardSize === 'large') {
                    // Mobile portrait optimization:
                    // The board is 9 lines wide (indices 0..8). Visual width is 8 * gridSize.
                    // Piece radius is ~0.45 gridSize. So edge pieces need 0.45 margin.
                    // Total width needed = 8 + 0.5*2 = 9 grids.
                    // Setting to 9.2 gives a tiny safe padding.
                    horizontalGridsNeeded = 9.2;
                    verticalGridsNeeded = 11;
                    maxGridSize = 999;
                } else if (settings?.boardSize === 'small') {
                    horizontalGridsNeeded = 14;
                    verticalGridsNeeded = 15;
                    maxGridSize = 35;
                }

                const maxGridW = clientWidth / horizontalGridsNeeded;
                const maxGridH = clientHeight / verticalGridsNeeded;

                let gridSize = Math.min(maxGridW, maxGridH);
                if (gridSize > maxGridSize) gridSize = maxGridSize;

                const boardPixelW = 8 * gridSize;
                const boardPixelH = 9 * gridSize;

                const offsetX = (clientWidth - boardPixelW) / 2;
                const freeVerticalSpace = clientHeight - boardPixelH;
                const offsetY = (freeVerticalSpace / 2);

                const dpr = window.devicePixelRatio || 1;
                setDimensions({
                    width: clientWidth,
                    height: clientHeight,
                    gridSize: gridSize,
                    offsetX: offsetX,
                    offsetY: offsetY,
                    dpr: dpr
                });
            }
        };

        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(updateDimensions);
        });

        resizeObserver.observe(containerRef.current);

        // Initial calculation
        updateDimensions();

        // iOS WebKit needs multiple delayed recalculations because:
        // 1. Flexbox layout may not be complete on first render
        // 2. Safari reports wrong clientWidth initially
        // Stage 1: Quick retry (50ms) - catches most layout delays
        const timer1 = setTimeout(updateDimensions, 50);
        // Stage 2: Medium retry (200ms) - catches slower devices
        const timer2 = setTimeout(updateDimensions, 200);
        // Stage 3: Final retry (500ms) - last resort for very slow layouts
        const timer3 = setTimeout(updateDimensions, 500);

        // iOS Safari fallback: orientation/resize events
        const handleResize = () => {
            // Clear any pending timers and recalculate with delays
            updateDimensions();
            setTimeout(updateDimensions, 100);
            setTimeout(updateDimensions, 300);
        };
        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        return () => {
            resizeObserver.disconnect();
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('orientationchange', handleResize);
        };
    }, [settings?.boardSize]);

    // --- Transformation Logic ---
    const getVisualPos = (r: number, c: number) => {
        let vr = r;
        let vc = c;

        if (isFlipped) {
            vr = 9 - r;
            vc = 8 - c;
        }

        if (isMirrored) {
            vc = 8 - vc;
        }

        return { r: vr, c: vc };
    };

    const getLogicalPos = (vr: number, vc: number) => {
        let c = vc;
        let r = vr;
        if (isMirrored) {
            c = 8 - c;
        }
        if (isFlipped) {
            r = 9 - r;
            c = 8 - c;
        }
        return { r, c };
    };

    const getPixelPos = (r: number, c: number) => {
        const v = getVisualPos(r, c);
        const { gridSize, offsetX, offsetY } = dimensions;
        return {
            x: offsetX + v.c * gridSize,
            y: offsetY + v.r * gridSize
        };
    };

    const getLogicalFromPixel = (x: number, y: number): Point | null => {
        const { gridSize, offsetX, offsetY } = dimensions;
        const vc = Math.round((x - offsetX) / gridSize);
        const vr = Math.round((y - offsetY) / gridSize);

        if (vr < 0 || vr > 9 || vc < 0 || vc > 8) return null;
        return getLogicalPos(vr, vc);
    };

    const easeOutCubic = (x: number): number => {
        return 1 - Math.pow(1 - x, 3);
    };

    // --- Drawing Loop ---
    const renderFrame = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height, gridSize, offsetX, offsetY, dpr } = dimensions;
        if (width === 0 || height === 0) return;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const { board, selectedPiece } = localState;
        const activeSelection = (mode === 'edit' && selectedCoord !== undefined) ? selectedCoord : selectedPiece;

        const now = Date.now();
        let animMove = animationRef.current;
        let shake = shakeRef.current;

        if (animMove && now > animMove.startTime + animMove.duration) {
            animMove = null;
            animationRef.current = null;
        }
        if (shake && now > shake.startTime + shake.duration) {
            shake = null;
            shakeRef.current = null;
        }

        // 1. Board Background
        ctx.clearRect(0, 0, width, height);
        let grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#cbbfa0'); grad.addColorStop(0.2, '#eaddcf'); grad.addColorStop(0.5, '#dcc7aa'); grad.addColorStop(0.8, '#cbbfa0'); grad.addColorStop(1, '#bba98b');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

        // 2. Draw Grid Lines
        ctx.strokeStyle = '#3d2b1f'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 10; i++) {
            ctx.beginPath(); ctx.moveTo(offsetX, offsetY + i * gridSize); ctx.lineTo(offsetX + 8 * gridSize, offsetY + i * gridSize); ctx.stroke();
        }
        for (let j = 0; j < 9; j++) {
            if (j === 0 || j === 8) {
                ctx.beginPath(); ctx.moveTo(offsetX + j * gridSize, offsetY); ctx.lineTo(offsetX + j * gridSize, offsetY + 9 * gridSize); ctx.stroke();
            } else {
                ctx.beginPath(); ctx.moveTo(offsetX + j * gridSize, offsetY); ctx.lineTo(offsetX + j * gridSize, offsetY + 4 * gridSize); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(offsetX + j * gridSize, offsetY + 5 * gridSize); ctx.lineTo(offsetX + j * gridSize, offsetY + 9 * gridSize); ctx.stroke();
            }
        }
        ctx.strokeStyle = '#2a1a10'; ctx.lineWidth = 4; ctx.strokeRect(offsetX - 4, offsetY - 4, 8 * gridSize + 8, 9 * gridSize + 8);
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#3d2b1f';

        // Palace
        const drawX = (baseR: number) => {
            const y1 = offsetY + baseR * gridSize;
            const y2 = offsetY + (baseR + 2) * gridSize;
            const x1 = offsetX + 3 * gridSize;
            const x2 = offsetX + 5 * gridSize;
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x2, y1); ctx.lineTo(x1, y2); ctx.stroke();
        };
        drawX(0);
        drawX(7);

        // 3. Labels
        if (settings?.showCoords !== false) {
            ctx.font = `bold ${gridSize * 0.4}px sans-serif`; ctx.fillStyle = '#000000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const drawCoords = (y: number, isTop: boolean) => {
                for (let c = 0; c < 9; c++) {
                    let text = '';
                    const logicalC = isMirrored ? (8 - c) : c;
                    let val = 0;
                    if (isFlipped) {
                        // Fliped: Red on Top, Black on Bottom
                        // Top (Red): Left to Right 9 to 1
                        // Bottom (Black): Right to Left 1 to 9 (which means left to right 9 to 1 visually in standard view, but here relative to board?)
                        // Wait, Standard Xiangqi:
                        // Red (Bottom): Right to Left 1-9
                        // Black (Top): Right to Left 1-9 (from their perspective) -> Left to Right 1-9 (from viewer) if not flipped?
                        // Actually standard: 
                        // Bottom (Red): 9 8 7 6 5 4 3 2 1 (Left to Right) if using standard coords? No, it's 1 on Right. So 9...1
                        // Top (Black): 1 2 3 4 5 6 7 8 9 (Left to Right)

                        // If Flipped (Black Bottom):
                        // Top (Red): 1 2 3 4 5 6 7 8 9 (Left to Right) -> Chinese Chars
                        // Bottom (Black): 9 8 7 6 5 4 3 2 1 (Left to Right) -> Numbers 1-9?

                        // Let's re-verify Standard View (Red Bottom):
                        // Bottom: 9...1 (Left-Right). "九...一" or "9...1"? Red is usually Chinese.
                        // Top: 1...9 (Left-Right). Black is usually Numbers.

                        // Current Code (Non-flipped):
                        // Top: val = logicalC + 1 (1..9). Text=val.toString(). Correct (Black).
                        // Bottom: val = 9 - logicalC (9..1). Text=toChineseNum(val). Correct (Red).

                        // Flipped View (Red Top, Black Bottom):
                        // Top (Red): Should be 9..1 (Left-Right) ? Or from Red's perspective (Right to Left 1..9)?
                        // If Red is Top, and we view from Black's side.
                        // Black (Bottom): Should be 1..9 from Right to Left. So Left to Right is 9..1.
                        // Red (Top): Should be 1..9 from Right to Left (their Right). So Left to Right is 1..9.

                        // Let's check the bug request. "Black coordinates should be 1 to 9 from Right to Left".
                        // Use 9 - logicalC produces 9..1 (Left to Right), which means 1 is on Right. Correct.

                        if (isTop) {
                            // Red is Top. From Viewer (Black's) perspective:
                            // Red's Right is Viewer's Left. Red's Right is 'One'. So Viewer's Left is 'One'.
                            // So Left to Right 1..9.
                            val = logicalC + 1;
                            text = toChineseNum(val);
                        } else {
                            // Black is Bottom. 
                            // Black's Right is Viewer's Right. Black's Right is '1'.
                            // So Viewer's Right is '1'. Left is '9'.
                            // So Left to Right: 9..1.
                            val = 9 - logicalC;
                            text = val.toString();
                        }
                    } else {
                        // Standard (Red Bottom)
                        if (isTop) { val = logicalC + 1; text = val.toString(); } else { val = 9 - logicalC; text = toChineseNum(val); }
                    }
                    ctx.fillText(text, offsetX + c * gridSize, y);
                }
            }
            drawCoords(offsetY - (gridSize * 0.8), true);
            drawCoords(offsetY + (gridSize * 9.8), false);
        }

        // River Text
        ctx.save();
        ctx.font = `bold ${gridSize * 0.6}px "KaiTi", "STKaiti", serif`;
        const riverY = offsetY + 4.5 * gridSize;
        let leftText = "楚 河";
        let rightText = "漢 界";
        if (isFlipped) { leftText = "漢 界"; rightText = "楚 河"; }
        if (isMirrored) { [leftText, rightText] = [rightText, leftText]; }
        ctx.fillText(leftText, offsetX + 2 * gridSize, riverY);
        ctx.fillText(rightText, offsetX + 6 * gridSize, riverY);
        ctx.restore();

        // 4. Markers
        const drawMark = (r: number, c: number) => {
            const v = getVisualPos(r, c);
            const x = offsetX + v.c * gridSize; const y = offsetY + v.r * gridSize; const gap = 4; const len = gridSize * 0.2; ctx.lineWidth = 2;
            const drawCorner = (dx: number, dy: number) => {
                ctx.beginPath(); ctx.moveTo(x + dx * gap, y + dy * (gap + len)); ctx.lineTo(x + dx * gap, y + dy * gap); ctx.lineTo(x + dx * (gap + len), y + dy * gap); ctx.stroke();
            };
            if (v.c > 0) { drawCorner(-1, -1); drawCorner(-1, 1); }
            if (v.c < 8) { drawCorner(1, -1); drawCorner(1, 1); }
        };
        [[2, 1], [2, 7], [7, 1], [7, 7], [3, 0], [3, 2], [3, 4], [3, 6], [3, 8], [6, 0], [6, 2], [6, 4], [6, 6], [6, 8]].forEach(p => drawMark(p[0], p[1]));

        // 4.5 Extra Marked Squares (Visual Effect - Double Click)
        if (markedSquares.size > 0) {
            markedSquares.forEach(key => {
                const [r, c] = key.split(',').map(Number);
                const v = getVisualPos(r, c);
                const x = offsetX + v.c * gridSize;
                const y = offsetY + v.r * gridSize;

                // Pulse Animation
                const pulse = (Math.sin(now / 200) + 1) / 2; // 0 to 1
                const radius = gridSize * 0.48 + (pulse * 2); // Slight breathe
                const alpha = 0.6 + 0.2 * pulse;

                ctx.save();
                ctx.translate(x, y);

                // Outer Glow Ring
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(249, 115, 22, ${alpha})`; // Orange-500
                ctx.lineWidth = 4;
                ctx.stroke();

                // Inner Fill
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(251, 146, 60, 0.2)`; // Orange-400 low opacity
                ctx.fill();

                ctx.restore();
            });
        }

        // 5. Last Move
        if (localState.lastMove && mode === 'play') {
            const { from, to } = localState.lastMove;
            const drawIndicator = (p: Point) => {
                const v = getVisualPos(p.r, p.c);
                ctx.beginPath(); ctx.arc(offsetX + v.c * gridSize, offsetY + v.r * gridSize, gridSize * 0.45, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(0, 100, 255, 0.5)"; ctx.lineWidth = 4; ctx.stroke();
            };
            drawIndicator(from); drawIndicator(to);
        }

        // Draw Piece Helper
        const drawPiece = (piece: Piece, r: number, c: number, scale: number = 1, offsetXPx: number = 0, offsetYPx: number = 0) => {
            const v = getVisualPos(r, c);
            const centerX = offsetX + v.c * gridSize + offsetXPx;
            const centerY = offsetY + v.r * gridSize + offsetYPx;
            drawPieceAt(piece, centerX, centerY, scale);
        };

        const drawPieceAt = (piece: Piece, x: number, y: number, scale: number = 1) => {
            const PIECE_RADIUS = gridSize * 0.45;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            ctx.shadowBlur = 6; ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowOffsetY = 4; ctx.shadowOffsetX = 2;
            ctx.beginPath(); ctx.arc(0, 0, PIECE_RADIUS, 0, Math.PI * 2);
            if (piece.color === 'red') {
                ctx.fillStyle = '#fdfdfd'; ctx.fill(); ctx.shadowColor = "transparent";
                ctx.lineWidth = 4; ctx.strokeStyle = '#a61c1c'; ctx.stroke();
                ctx.beginPath(); ctx.arc(0, 0, PIECE_RADIUS - 6, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = '#e5e5e5'; ctx.stroke();
                ctx.fillStyle = '#a61c1c';
            } else {
                let pGrad = ctx.createRadialGradient(-10, -10, 5, 0, 0, PIECE_RADIUS);
                pGrad.addColorStop(0, '#2563eb'); pGrad.addColorStop(1, '#1e3a8a');
                ctx.fillStyle = pGrad; ctx.fill(); ctx.shadowColor = "transparent";
                ctx.lineWidth = 4; ctx.strokeStyle = '#000000'; ctx.stroke();
                ctx.fillStyle = '#ffffff';
            }
            ctx.font = `bold ${gridSize * 0.65}px 'KaiTi', 'Kaiti SC', 'STKaiti', 'Microsoft JhengHei', serif`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(piece.text, 0, (gridSize * 0.01));
            ctx.restore();
        }

        // 6. Draw Pieces
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const piece = board[r][c];
                if (!piece) continue;
                if (animMove && r === animMove.to.r && c === animMove.to.c) continue;

                let shakeOffsetX = 0;
                let shakeOffsetY = 0;
                if (shake && shake.r === r && shake.c === c) {
                    const shakeProgress = (now - shake.startTime) / shake.duration;
                    if (shakeProgress >= 0 && shakeProgress <= 1) {
                        const intensity = (1 - shakeProgress) * gridSize * 0.15;
                        shakeOffsetX = (Math.random() - 0.5) * intensity;
                        shakeOffsetY = (Math.random() - 0.5) * intensity;
                    }
                }
                drawPiece(piece, r, c, 1, shakeOffsetX, shakeOffsetY);
            }
        }

        // 7. Draw Moving Piece
        if (animMove) {
            const progress = Math.min(1, (now - animMove.startTime) / animMove.duration);
            const eased = easeOutCubic(progress);
            const vFrom = getVisualPos(animMove.from.r, animMove.from.c);
            const vTo = getVisualPos(animMove.to.r, animMove.to.c);
            const startX = offsetX + vFrom.c * gridSize;
            const startY = offsetY + vFrom.r * gridSize;
            const endX = offsetX + vTo.c * gridSize;
            const endY = offsetY + vTo.r * gridSize;
            const currentX = startX + (endX - startX) * eased;
            const currentY = startY + (endY - startY) * eased;
            let scale = 1;
            if (animMove.isCannonCapture) {
                scale = 1 + Math.sin(progress * Math.PI) * 0.5;
            }
            drawPieceAt(animMove.piece, currentX, currentY, scale);
        }

        // Active Selection
        if (activeSelection) {
            const v = getVisualPos(activeSelection.r, activeSelection.c);
            ctx.save();
            ctx.beginPath();
            ctx.arc(offsetX + v.c * gridSize, offsetY + v.r * gridSize, gridSize * 0.48, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(34, 197, 94, 0.9)";
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
        }

        // 8. Hints
        if (activeSelection && mode === 'play') {
            for (let r = 0; r < 10; r++) {
                for (let c = 0; c < 9; c++) {
                    if (canMove(board, activeSelection.r, activeSelection.c, r, c)) {
                        const v = getVisualPos(r, c);
                        const targetP = board[r][c];
                        ctx.beginPath();
                        if (targetP) {
                            ctx.arc(offsetX + v.c * gridSize, offsetY + v.r * gridSize, gridSize * 0.48, 0, Math.PI * 2);
                            ctx.strokeStyle = "rgba(168, 85, 247, 0.9)";
                            ctx.lineWidth = 4;
                            ctx.stroke();
                        } else {
                            ctx.arc(offsetX + v.c * gridSize, offsetY + v.r * gridSize, gridSize * 0.12, 0, Math.PI * 2);
                            ctx.fillStyle = "rgba(22, 163, 74, 0.8)"; ctx.fill();
                        }
                    }
                }
            }
        }

        // 9. Hint Effect (Moved here to draw ON TOP of pieces)
        if (hintMove) {
            const { from } = hintMove; // Only use 'from'
            const pulse = (Math.sin(now / 150) + 1) / 2; // 0 to 1 oscillating
            const alphaFill = 0.3 + 0.2 * pulse;
            const alphaStroke = 0.6 + 0.4 * pulse;

            // Draw Source Highlight ONLY
            const vFrom = getVisualPos(from.r, from.c);
            const xF = offsetX + vFrom.c * gridSize;
            const yF = offsetY + vFrom.r * gridSize;

            ctx.save();
            ctx.beginPath();
            ctx.arc(xF, yF, gridSize * 0.48, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 215, 0, ${alphaFill})`; // Pulsing Gold
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 215, 0, ${alphaStroke})`;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
        }

        // 9.5 Engine Best Move Arrows
        if (engineBestMoves && engineBestMoves.length > 0) {
            engineBestMoves.forEach(arrow => {
                const start = getVisualPos(arrow.from.r, arrow.from.c);
                const end = getVisualPos(arrow.to.r, arrow.to.c);
                const startX = offsetX + start.c * gridSize;
                const startY = offsetY + start.r * gridSize;
                const endX = offsetX + end.c * gridSize;
                const endY = offsetY + end.r * gridSize;

                // Color based on side
                const color = arrow.color === 'red' ? '#d946ef' : '#22c55e'; // Fuschia-500 (Magenta-ish) vs Green-500

                ctx.save();
                ctx.beginPath();
                // Arrow Logic
                const angle = Math.atan2(endY - startY, endX - startX);
                const len = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                const shorten = gridSize * 0.35; // Don't cover piece completely
                const drawLen = Math.max(0, len - shorten);

                // End point adjusted
                const adjEndX = startX + Math.cos(angle) * drawLen;
                const adjEndY = startY + Math.sin(angle) * drawLen;

                // Draw Line
                ctx.moveTo(startX, startY);
                ctx.lineTo(adjEndX, adjEndY);
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.stroke();

                // Draw Arrowhead
                const headLen = gridSize * 0.25;
                ctx.beginPath();
                ctx.moveTo(adjEndX, adjEndY);
                ctx.lineTo(adjEndX - headLen * Math.cos(angle - Math.PI / 6), adjEndY - headLen * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(adjEndX - headLen * Math.cos(angle + Math.PI / 6), adjEndY - headLen * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();

                ctx.restore();
            });
        }

        // 10. Player Names
        if (settings?.showPlayerNames !== false) {
            const drawVerticalText = (text: string, x: number, startY: number, size: number) => {
                const lineHeight = size * 1.1;
                for (let i = 0; i < text.length; i++) { ctx.fillText(text[i], x, startY + i * lineHeight); }
            };
            const drawPlayerName = (name: string, isTop: boolean, color: string) => {
                if (!name) return;
                ctx.save(); ctx.fillStyle = color; ctx.shadowColor = "rgba(255, 255, 255, 0.3)"; ctx.shadowBlur = 4; ctx.textBaseline = "middle";
                const isWideLayout = offsetX > gridSize * 1.2;
                if (isWideLayout) {
                    const x = width - (offsetX / 2);
                    const fontSize = gridSize * 0.55;
                    const topCenterY = offsetY + gridSize * 2.0;
                    const bottomCenterY = offsetY + gridSize * 7.0;
                    const textHeight = (name.length - 1) * (fontSize * 1.1);
                    const startYOffset = textHeight / 2;
                    const y = isTop ? topCenterY - startYOffset : bottomCenterY - startYOffset;
                    ctx.font = `bold ${fontSize}px "KaiTi", "STKaiti", serif`; ctx.textAlign = "center";
                    drawVerticalText(name, x, y, fontSize);
                } else {
                    const fontSize = gridSize * 0.5;
                    ctx.font = `bold ${fontSize}px "KaiTi", "STKaiti", serif`; ctx.textAlign = "center";
                    const x = width / 2;
                    const bottomMarginStart = offsetY + 9 * gridSize;
                    const bottomMarginHeight = height - bottomMarginStart;
                    let y = 0;
                    if (isTop) {
                        y = offsetY * 0.2;
                    } else {
                        y = height - (bottomMarginHeight * 0.2);
                    }
                    ctx.fillText(name, x, y);
                }
                ctx.restore();
            };
            const topName = isFlipped ? redName : blackName;
            const bottomName = isFlipped ? blackName : redName;
            const topColor = isFlipped ? '#a61c1c' : '#000000';
            const bottomColor = isFlipped ? '#000000' : '#a61c1c';
            if (topName) drawPlayerName(topName, true, topColor);
            if (bottomName) drawPlayerName(bottomName, false, bottomColor);
        }
        requestRef.current = requestAnimationFrame(renderFrame);
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(renderFrame);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [localState, dimensions, isFlipped, isMirrored, redName, blackName, mode, selectedCoord, settings, hintMove, markedSquares, engineBestMoves]);
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isLocked) return;
        if (e.button !== 0) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const { gridSize, offsetX, offsetY } = dimensions;
        const vc = Math.round((x - offsetX) / gridSize);
        const vr = Math.round((y - offsetY) / gridSize);
        if (vr < 0 || vr > 9 || vc < 0 || vc > 8) return;
        const { r, c } = getLogicalPos(vr, vc);

        // Triple Click Logic (Trigger Orange Marker)
        // Note: e.detail counts consecutive clicks
        if (e.detail === 3) {
            const key = `${r},${c}`;
            setMarkedSquares(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
            });
            // Return early to prevent selection/move logic on the 3rd click if desired,
            // but allows selection on 1st/2nd click.
            return;
        }

        if (mode === 'edit') {
            if (onSquareClick) onSquareClick({ r, c }, rect);
            return;
        }

        const { board, selectedPiece, turn } = localState;
        if (selectedPiece) {
            if (canMove(board, selectedPiece.r, selectedPiece.c, r, c)) {
                if (onMoveMade) {
                    const newBoard = board.map(row => [...row]);
                    const movedPiece = newBoard[selectedPiece.r][selectedPiece.c]!;
                    const targetPiece = newBoard[r][c];
                    const notation = getChineseNotation(board, { from: selectedPiece, to: { r, c }, piece: movedPiece, captured: targetPiece });
                    newBoard[r][c] = movedPiece;
                    newBoard[selectedPiece.r][selectedPiece.c] = null;
                    const accepted = onMoveMade({
                        from: selectedPiece,
                        to: { r, c },
                        piece: movedPiece,
                        captured: targetPiece,
                        notation: notation
                    }, newBoard);
                    if (accepted !== false) {
                        setLocalState(prev => ({
                            ...prev,
                            board: newBoard,
                            turn: turn === 'red' ? 'black' : 'red',
                            selectedPiece: null,
                            lastMove: { from: selectedPiece, to: { r, c } },
                        }));
                    }
                }
            } else {
                if (board[r][c] && board[r][c]?.color === turn) {
                    setLocalState(prev => ({ ...prev, selectedPiece: { r, c } }));
                } else {
                    setLocalState(prev => ({ ...prev, selectedPiece: null }));
                }
            }
        } else {
            if (board[r][c] && board[r][c]?.color === turn) {
                setLocalState(prev => ({ ...prev, selectedPiece: { r, c } }));
            }
        }
    };

    const handleContainerContextMenu = (e: React.MouseEvent) => e.preventDefault();
    const handleContainerMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 2) return; // Reverted to Right-Click Drag as per user request (Left click conflicts with moves)
        e.preventDefault();
        const rect = containerRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const start = getLogicalFromPixel(x, y);
        if (start) setDragArrow({ start, current: { x, y } });
    };
    const handleContainerMouseMove = (e: React.MouseEvent) => {
        if (dragArrow) {
            const rect = containerRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setDragArrow(prev => prev ? { ...prev, current: { x, y } } : null);
        }
    };
    const handleContainerMouseUp = (e: React.MouseEvent) => {
        if (dragArrow) {
            const rect = containerRef.current!.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const end = getLogicalFromPixel(x, y);
            if (end && (end.r !== dragArrow.start.r || end.c !== dragArrow.start.c)) {
                setManualArrows(prev => {
                    const exists = prev.findIndex(a =>
                        a.from.r === dragArrow.start.r && a.from.c === dragArrow.start.c &&
                        a.to.r === end.r && a.to.c === end.c
                    );
                    if (exists !== -1) return prev.filter((_, i) => i !== exists);
                    else return [...prev, { from: dragArrow.start, to: end }];
                });
            }
            setDragArrow(null);
        }
    };

    const RenderVariationArrows = () => {
        if (settings?.showVariationArrows === false) return null;
        if (!currentNode || !currentNode.children || currentNode.children.length <= 1) return null;

        const arrowData = currentNode.children.map((child, idx) => {
            if (!child.move) return null;
            const fromPos = getPixelPos(child.move.from.r, child.move.from.c);
            const toPos = getPixelPos(child.move.to.r, child.move.to.c);
            const originalIdx = currentNode.children!.findIndex(c => c.id === child.id);
            const label = String.fromCharCode(65 + originalIdx);
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const angle = Math.atan2(dy, dx);
            const angleDeg = angle * (180 / Math.PI);
            const dist = Math.sqrt(dx * dx + dy * dy);

            // 更細緻的箭頭樣式
            const headLength = 20; // Reduced from 40
            const headWidth = 14;  // Reduced from 28
            const shaftWidth = 5;  // Reduced from 14
            const notchDepth = 4;  // Reduced from 8
            const overlap = 0.5;

            const shaftEnd = Math.max(0, dist - headLength + notchDepth + overlap);
            const shaftPath = `M 0,${-shaftWidth / 2} L ${shaftEnd},${-shaftWidth / 2} L ${shaftEnd},${shaftWidth / 2} L 0,${shaftWidth / 2} Z`;

            const headBackX = dist - headLength;
            const headTipX = dist;
            const headStartFillX = headBackX + notchDepth - overlap;
            const headPath = `M ${headStartFillX},${-shaftWidth / 2} L ${headBackX},${-headWidth / 2} L ${headTipX},0 L ${headBackX},${headWidth / 2} L ${headStartFillX},${shaftWidth / 2} Z`;

            const outlinePath = `M 0,${-shaftWidth / 2} L ${headBackX + notchDepth},${-shaftWidth / 2} L ${headBackX},${-headWidth / 2} L ${headTipX},0 L ${headBackX},${headWidth / 2} L ${headBackX + notchDepth},${shaftWidth / 2} L 0,${shaftWidth / 2}`;

            const badgeOffsetFromTip = headLength * 0.8;
            const badgeDist = dist - badgeOffsetFromTip;
            const badgeX = fromPos.x + Math.cos(angle) * badgeDist;
            const badgeY = fromPos.y + Math.sin(angle) * badgeDist;

            return {
                id: child.id,
                child,
                fromPos,
                angleDeg,
                shaftPath,
                headPath,
                outlinePath,
                badgeX,
                badgeY,
                label,
                isHovered: hoveredVariationId === child.id
            };
        }).filter(item => item !== null) as NonNullable<ReturnType<typeof arrowData[0]>>[];

        arrowData.sort((a, b) => (a.isHovered ? 1 : 0) - (b.isHovered ? 1 : 0));

        return (
            <>
                {arrowData.map((arrow) => {
                    const { id, child, fromPos, angleDeg, shaftPath, headPath, outlinePath, badgeX, badgeY, label, isHovered } = arrow;
                    const opacity = isHovered ? 1 : 0.7; // Slightly increased opacity for visibility since they are smaller
                    const headColor = "rgba(59, 130, 246, 0.9)";
                    const strokeColor = "rgba(59, 130, 246, 1)";

                    return (
                        <g
                            key={id}
                            // Remove event handlers from parent group
                            className="transition-all duration-200 variation-arrow-group"
                            style={{ opacity }}
                        >
                            {/* Lines Group: Make non-interactive so clicks pass through */}
                            <g
                                transform={`translate(${fromPos.x}, ${fromPos.y}) rotate(${angleDeg})`}
                                pointerEvents="none"
                            >
                                <g mask={`url(#${maskId})`}>
                                    <path d={shaftPath} fill={`url(#${patternId})`} stroke="none" />
                                    <path d={outlinePath} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                                </g>
                                <path d={headPath} fill={headColor} stroke="none" />
                            </g>

                            {/* Badge Group: Make interactive */}
                            <g
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    const isPieceSelected = localState.selectedPiece !== null || (mode === 'edit' && selectedCoord != null);
                                    if (isPieceSelected) return;
                                    if (onNodeSelect) onNodeSelect(child);
                                }}
                                onMouseEnter={() => setHoveredVariationId(id)}
                                onMouseLeave={() => setHoveredVariationId(null)}
                                className="cursor-pointer"
                                pointerEvents="all"
                            >
                                <circle cx={badgeX} cy={badgeY} r={8} fill="white" stroke="#3b82f6" strokeWidth="2" />
                                <text x={badgeX} y={badgeY} dy="0.35em" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#3b82f6" style={{ pointerEvents: 'none' }}>
                                    {label}
                                </text>
                            </g>
                        </g>
                    );
                })}
            </>
        );
    };

    const RenderManualArrows = () => {
        return (
            <>
                {manualArrows.map((arrow, idx) => {
                    const fromPos = getPixelPos(arrow.from.r, arrow.from.c);
                    const toPos = getPixelPos(arrow.to.r, arrow.to.c);
                    return (
                        <line
                            key={idx}
                            x1={fromPos.x} y1={fromPos.y}
                            x2={toPos.x} y2={toPos.y}
                            stroke="#22c55e"
                            strokeWidth="8"
                            strokeOpacity="0.8"
                            strokeLinecap="round"
                            markerEnd={`url(#${markerGreenId})`}
                        />
                    );
                })}
                {dragArrow && (
                    <line
                        x1={getPixelPos(dragArrow.start.r, dragArrow.start.c).x}
                        y1={getPixelPos(dragArrow.start.r, dragArrow.start.c).y}
                        x2={dragArrow.current.x}
                        y2={dragArrow.current.y}
                        stroke="#22c55e"
                        strokeWidth="8"
                        strokeOpacity="0.5"
                        strokeLinecap="round"
                        markerEnd={`url(#${markerGreenId})`}
                    />
                )}
            </>
        );
    };

    return (
        <div
            ref={containerRef}
            className="w-full h-full flex justify-center items-center overflow-hidden bg-[#2a2a2e] rounded-lg shadow-2xl border border-zinc-700 select-none relative"
            onContextMenu={handleContainerContextMenu}
            onMouseDown={handleContainerMouseDown}
            onMouseMove={handleContainerMouseMove}
            onMouseUp={handleContainerMouseUp}
            onMouseLeave={() => setDragArrow(null)}
        >
            <canvas
                ref={canvasRef}
                width={dimensions.width * dimensions.dpr}
                height={dimensions.height * dimensions.dpr}
                style={{ width: dimensions.width, height: dimensions.height }}
                onClick={handleCanvasClick}
                className="cursor-pointer touch-none z-10"
            />

            <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-20"
                viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            >
                <defs>
                    <marker id={markerBlueId} markerWidth="4" markerHeight="4" refX="3.5" refY="2" orient="auto">
                        <polygon points="0 0, 4 2, 0 4" fill="#3b82f6" fillOpacity="0.7" />
                    </marker>
                    <marker id={markerGreenId} markerWidth="3" markerHeight="3" refX="2.5" refY="1.5" orient="auto">
                        <polygon points="0 0, 3 1.5, 0 3" fill="#22c55e" fillOpacity="0.8" />
                    </marker>

                    <linearGradient id={gradientId} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="white" stopOpacity="0" />
                        <stop offset="0.15" stopColor="white" stopOpacity="1" />
                    </linearGradient>

                    {/* CORRECT FIX: maskContentUnits="objectBoundingBox" to make rect 0..1 relative to target bbox */}
                    <mask id={maskId} maskUnits="objectBoundingBox" maskContentUnits="objectBoundingBox">
                        <rect x="0" y="0" width="1" height="1" fill={`url(#${gradientId})`} />
                    </mask>

                    <pattern id={patternId} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 10 0 L 0 10 L 10 20" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="20 0" dur="1.5s" repeatCount="indefinite" />
                        <rect width="20" height="20" fill="rgba(59, 130, 246, 0.4)" />
                    </pattern>
                </defs>

                <RenderManualArrows />
                <RenderVariationArrows />
            </svg>

            {activeFlashes.map(flash => {
                const { gridSize, offsetX, offsetY } = dimensions;
                if (dimensions.width === 0) return null;
                const v = getVisualPos(flash.r, flash.c);
                return (
                    <div
                        key={flash.id}
                        className="absolute flex items-center justify-center text-red-600 font-bold z-30 pointer-events-none animate-ping-fade"
                        style={{
                            top: offsetY + v.r * gridSize,
                            left: offsetX + v.c * gridSize,
                            width: gridSize,
                            height: gridSize,
                            transform: 'translate(-50%, -50%)',
                            fontSize: gridSize * 0.8
                        }}
                    >
                        ✖
                    </div>
                );
            })}

            <style>{`
                @keyframes ping-fade {
                    0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
                }
                .animate-ping-fade {
                    animation: ping-fade 0.8s ease-out forwards;
                }
                .variation-arrow-group:hover {
                    z-index: 100;
                }
            `}</style>
        </div>
    );
};

export default ChessBoard;
