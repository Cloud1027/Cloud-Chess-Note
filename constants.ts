import { Piece } from './types';

export const PIECES: { red: Record<string, string>; black: Record<string, string> } = {
  red: { king: '帥', advisor: '仕', elephant: '相', horse: '傌', chariot: '俥', cannon: '炮', soldier: '兵' },
  black: { king: '將', advisor: '士', elephant: '象', horse: '馬', chariot: '車', cannon: '包', soldier: '卒' }
};

export const INITIAL_BOARD_SETUP = (): (Piece | null)[][] => {
    const board: (Piece | null)[][] = Array(10).fill(null).map(() => Array(9).fill(null));

    const setupSide = (row: number, color: 'red' | 'black', pieces: Record<string, string>) => {
        board[row][0] = { type: 'chariot', color, text: pieces.chariot };
        board[row][1] = { type: 'horse', color, text: pieces.horse };
        board[row][2] = { type: 'elephant', color, text: pieces.elephant };
        board[row][3] = { type: 'advisor', color, text: pieces.advisor };
        board[row][4] = { type: 'king', color, text: pieces.king };
        board[row][5] = { type: 'advisor', color, text: pieces.advisor };
        board[row][6] = { type: 'elephant', color, text: pieces.elephant };
        board[row][7] = { type: 'horse', color, text: pieces.horse };
        board[row][8] = { type: 'chariot', color, text: pieces.chariot };
    };

    // Black
    setupSide(0, 'black', PIECES.black);
    board[2][1] = { type: 'cannon', color: 'black', text: PIECES.black.cannon };
    board[2][7] = { type: 'cannon', color: 'black', text: PIECES.black.cannon };
    for(let i=0; i<9; i+=2) board[3][i] = { type: 'soldier', color: 'black', text: PIECES.black.soldier };

    // Red
    setupSide(9, 'red', PIECES.red);
    board[7][1] = { type: 'cannon', color: 'red', text: PIECES.red.cannon };
    board[7][7] = { type: 'cannon', color: 'red', text: PIECES.red.cannon };
    for(let i=0; i<9; i+=2) board[6][i] = { type: 'soldier', color: 'red', text: PIECES.red.soldier };

    return board;
};