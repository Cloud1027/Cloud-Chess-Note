
import { Piece, PieceColor, Point, CloudMove } from '../types';
import { PIECES } from '../constants';

/**
 * Generates a Xiangqi FEN string from the board state.
 */
export const getFen = (board: (Piece | null)[][], turn: PieceColor): string => {
    let fen = '';

    // 1. Board Layout
    for (let r = 0; r < 10; r++) {
        let emptyCount = 0;
        for (let c = 0; c < 9; c++) {
            const piece = board[r][c];
            if (piece) {
                if (emptyCount > 0) {
                    fen += emptyCount;
                    emptyCount = 0;
                }
                fen += getPieceChar(piece);
            } else {
                emptyCount++;
            }
        }
        if (emptyCount > 0) {
            fen += emptyCount;
        }
        if (r < 9) {
            fen += '/';
        }
    }

    // 2. Turn (w = Red, b = Black)
    fen += ` ${turn === 'red' ? 'w' : 'b'}`;

    // 3. Placeholders
    fen += ' - - 0 1';

    return fen;
};

const getPieceChar = (piece: Piece): string => {
    const map: Record<string, string> = {
        king: 'K',
        advisor: 'A',
        elephant: 'B',
        horse: 'N',
        chariot: 'R',
        cannon: 'C',
        soldier: 'P'
    };
    const char = map[piece.type] || 'P';
    return piece.color === 'red' ? char : char.toLowerCase();
};

export const fenToBoard = (fen: string): { board: (Piece | null)[][], turn: PieceColor } => {
    const board: (Piece | null)[][] = Array(10).fill(null).map(() => Array(9).fill(null));
    const parts = fen.split(' ');
    const position = parts[0];
    const turnChar = parts[1] || 'w';

    const rows = position.split('/');
    let r = 0;
    let c = 0;

    const charToPieceType: Record<string, { type: string, color: PieceColor, text: string }> = {
        'K': { type: 'king', color: 'red', text: PIECES.red.king },
        'A': { type: 'advisor', color: 'red', text: PIECES.red.advisor },
        'B': { type: 'elephant', color: 'red', text: PIECES.red.elephant },
        'N': { type: 'horse', color: 'red', text: PIECES.red.horse },
        'R': { type: 'chariot', color: 'red', text: PIECES.red.chariot },
        'C': { type: 'cannon', color: 'red', text: PIECES.red.cannon },
        'P': { type: 'soldier', color: 'red', text: PIECES.red.soldier },
        'k': { type: 'king', color: 'black', text: PIECES.black.king },
        'a': { type: 'advisor', color: 'black', text: PIECES.black.advisor },
        'b': { type: 'elephant', color: 'black', text: PIECES.black.elephant },
        'n': { type: 'horse', color: 'black', text: PIECES.black.horse },
        'r': { type: 'chariot', color: 'black', text: PIECES.black.chariot },
        'c': { type: 'cannon', color: 'black', text: PIECES.black.cannon },
        'p': { type: 'soldier', color: 'black', text: PIECES.black.soldier }
    };

    for (let i = 0; i < position.length; i++) {
        const char = position[i];
        if (char === '/') {
            r++;
            c = 0;
        } else if (/\d/.test(char)) {
            c += parseInt(char);
        } else {
            const def = charToPieceType[char];
            if (def && r < 10 && c < 9) {
                board[r][c] = { type: def.type as any, color: def.color, text: def.text };
                c++;
            }
        }
    }

    return { board, turn: turnChar === 'w' ? 'red' : 'black' };
};

export const validatePiecePlacement = (pieceType: string, color: PieceColor, r: number, c: number): boolean => {
    if (pieceType === 'king' || pieceType === 'advisor') {
        if (c < 3 || c > 5) return false;
        if (color === 'red') {
            return r >= 7 && r <= 9;
        } else {
            return r >= 0 && r <= 2;
        }
    }

    if (pieceType === 'elephant') {
        if (color === 'red') {
            return r >= 5;
        } else {
            return r <= 4;
        }
    }

    return true;
};

export const toChineseNum = (n: number) => ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][n];

export const getChineseNotation = (board: (Piece | null)[][], move: { from: Point, to: Point, piece: Piece, captured: Piece | null }): string => {
    const { from, to, piece } = move;
    const isRed = piece.color === 'red';
    const fromCol = isRed ? (9 - from.c) : (from.c + 1);
    const toCol = isRed ? (9 - to.c) : (to.c + 1);
    let name = piece.text;
    let dir = '';
    let dest = '';
    const dr = to.r - from.r;

    if (from.r === to.r) {
        dir = '平';
        dest = isRed ? toChineseNum(toCol) : toCol.toString();
    } else {
        const isForward = isRed ? (dr < 0) : (dr > 0);
        dir = isForward ? '進' : '退';
        const dist = Math.abs(dr);
        if (['horse', 'elephant', 'advisor'].includes(piece.type)) {
            dest = isRed ? toChineseNum(toCol) : toCol.toString();
        } else {
            dest = isRed ? toChineseNum(dist) : dist.toString();
        }
    }
    const colStr = isRed ? toChineseNum(fromCol) : fromCol.toString();
    return `${name}${colStr}${dir}${dest}`;
};

// --- Cloudbook Helpers ---

export const ucciToCoords = (ucci: string): { from: Point, to: Point } | null => {
    if (!ucci || ucci.length < 4) return null;
    const c1 = ucci.charCodeAt(0) - 'a'.charCodeAt(0);
    const r1 = 9 - parseInt(ucci[1]);
    const c2 = ucci.charCodeAt(2) - 'a'.charCodeAt(0);
    const r2 = 9 - parseInt(ucci[3]);
    return { from: { r: r1, c: c1 }, to: { r: r2, c: c2 } };
};

export const fetchCloudBookData = async (fen: string): Promise<CloudMove[]> => {
    try {
        const url = `https://www.chessdb.cn/chessdb.php?action=queryall&board=${encodeURIComponent(fen)}&learn=1&showall=1`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');

        const text = await response.text();

        if (text.startsWith('unknown') || text.startsWith('invalid')) {
            return [];
        }

        const parsedMoves: CloudMove[] = text.split('|').map(item => {
            const parts = item.split(',');
            const obj: any = {};
            parts.forEach(p => {
                const [k, v] = p.split(':');
                if (k && v) obj[k.trim()] = v.trim();
            });

            return {
                move: obj.move,
                score: parseInt(obj.score || '0'),
                rank: parseInt(obj.rank || '0'),
                winrate: parseFloat(obj.winrate || '0'),
                note: obj.note || ''
            };
        }).filter(m => m.move);

        return parsedMoves;
    } catch (err) {
        console.error("Cloud fetch error:", err);
        return [];
    }
};

export const applyMoveToBoard = (board: (Piece | null)[][], move: { from: Point, to: Point }): (Piece | null)[][] => {
    const newBoard = board.map(row => [...row]);
    const piece = newBoard[move.from.r][move.from.c];
    if (piece) {
        newBoard[move.to.r][move.to.c] = piece;
        newBoard[move.from.r][move.from.c] = null;
    }
    return newBoard;
};

export const getChineseNotationForPV = (fen: string, pv: string[]): string[] => {
    let { board } = fenToBoard(fen);
    const notations: string[] = [];

    for (const ucci of pv) {
        const coords = ucciToCoords(ucci);
        if (!coords) {
            notations.push(ucci);
            continue;
        }

        const piece = board[coords.from.r][coords.from.c];
        if (!piece) {
            notations.push(ucci);
            continue;
        }

        const captured = board[coords.to.r][coords.to.c];
        const notation = getChineseNotation(board, { ...coords, piece, captured });
        notations.push(notation);

        // Apply move to board for next iteration
        board = applyMoveToBoard(board, coords);
    }

    return notations;
};
