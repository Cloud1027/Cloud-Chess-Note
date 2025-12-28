import React, { useMemo } from 'react';
import { fenToBoard } from '../lib/utils';
import { PieceColor } from '../types';

interface MiniBoardPreviewProps {
    fen: string;
    isRedBottom?: boolean;
}

const PIECE_CHARS: Record<string, string> = {
    'K': '帥', 'A': '仕', 'B': '相', 'N': '馬', 'R': '車', 'C': '炮', 'P': '兵',
    'k': '將', 'a': '士', 'b': '象', 'n': '馬', 'r': '車', 'c': '炮', 'p': '卒'
};

const PIECE_COLORS: Record<string, string> = {
    'red': '#ef4444',   // red-500
    'black': '#18181b'  // zinc-900 (or almost black)
};

const BG_COLOR = '#eab38c'; // amber-300-ish/wood
const GRID_COLOR = '#78350f'; // amber-900

export const MiniBoardPreview: React.FC<MiniBoardPreviewProps> = ({ fen, isRedBottom = true }) => {
    // Memoize the board structure to avoid re-parsing on every render
    const boardSetup = useMemo(() => {
        try {
            const { board } = fenToBoard(fen);
            return board;
        } catch (e) {
            return null;
        }
    }, [fen]);

    if (!boardSetup) return <div className="w-full aspect-[9/10] bg-zinc-800 rounded flex items-center justify-center text-xs text-zinc-500">No Preview</div>;

    // SVG Constants
    const CELL_SIZE = 40;
    const PADDING = 20;
    const BOARD_W = CELL_SIZE * 8; // 9 lines = 8 cells
    const BOARD_H = CELL_SIZE * 9; // 10 lines = 9 cells
    const WIDTH = BOARD_W + PADDING * 2;
    const HEIGHT = BOARD_H + PADDING * 2;

    return (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-full select-none" style={{ backgroundColor: '#f2e1c2' }}>
            {/* Board Grid */}
            <g transform={`translate(${PADDING}, ${PADDING})`}>
                {/* Horizontal Lines */}
                {Array.from({ length: 10 }).map((_, i) => (
                    <line
                        key={`h-${i}`}
                        x1={0} y1={i * CELL_SIZE}
                        x2={BOARD_W} y2={i * CELL_SIZE}
                        stroke={GRID_COLOR} strokeWidth="1"
                    />
                ))}
                {/* Vertical Lines (Top Half) */}
                {Array.from({ length: 9 }).map((_, i) => (
                    <line
                        key={`v-top-${i}`}
                        x1={i * CELL_SIZE} y1={0}
                        x2={i * CELL_SIZE} y2={4 * CELL_SIZE}
                        stroke={GRID_COLOR} strokeWidth="1"
                    />
                ))}
                {/* Vertical Lines (Bottom Half) */}
                {Array.from({ length: 9 }).map((_, i) => (
                    <line
                        key={`v-bot-${i}`}
                        x1={i * CELL_SIZE} y1={5 * CELL_SIZE}
                        x2={i * CELL_SIZE} y2={9 * CELL_SIZE}
                        stroke={GRID_COLOR} strokeWidth="1"
                    />
                ))}

                {/* River Borders (Vertical outer lines connecting river) */}
                <line x1={0} y1={4 * CELL_SIZE} x2={0} y2={5 * CELL_SIZE} stroke={GRID_COLOR} strokeWidth="1" />
                <line x1={BOARD_W} y1={4 * CELL_SIZE} x2={BOARD_W} y2={5 * CELL_SIZE} stroke={GRID_COLOR} strokeWidth="1" />

                {/* Palace Diagonals (Top) */}
                <line x1={3 * CELL_SIZE} y1={0} x2={5 * CELL_SIZE} y2={2 * CELL_SIZE} stroke={GRID_COLOR} strokeWidth="1" />
                <line x1={5 * CELL_SIZE} y1={0} x2={3 * CELL_SIZE} y2={2 * CELL_SIZE} stroke={GRID_COLOR} strokeWidth="1" />

                {/* Palace Diagonals (Bottom) */}
                <line x1={3 * CELL_SIZE} y1={7 * CELL_SIZE} x2={5 * CELL_SIZE} y2={9 * CELL_SIZE} stroke={GRID_COLOR} strokeWidth="1" />
                <line x1={5 * CELL_SIZE} y1={7 * CELL_SIZE} x2={3 * CELL_SIZE} y2={9 * CELL_SIZE} stroke={GRID_COLOR} strokeWidth="1" />

                {/* Pieces */}
                {boardSetup.map((row, r) =>
                    row.map((piece, c) => {
                        if (!piece) return null;

                        // Calculate position
                        // If isRedBottom = true (default), Red is at r=7-9 (bottom).
                        // Our board array: r=0 is top.
                        // SVG y: r * CELL_SIZE.
                        // SVG x: c * CELL_SIZE.
                        // No flipping logic needed if FEN matches view.
                        // Usually FEN r0 is Black side.

                        const cx = c * CELL_SIZE;
                        const cy = r * CELL_SIZE;

                        // Piece Background
                        const char = PIECE_CHARS[piece.text] || piece.text; // Map King/Advisor if needed, mostly already Chinese
                        // Actually our 'piece.text' is already Chinese from utils fenToBoard map.
                        // But wait, our fenToBoard mapping might store K/A/B as text?
                        // Let's check utils.ts. 
                        // Ah, utils.ts has "text: PIECES.red.king" which is Chinese char.
                        // So piece.text is reliable.

                        const isRed = piece.color === 'red';
                        const textColor = isRed ? '#cc0000' : '#000000';
                        const strokeColor = isRed ? '#cc0000' : '#000000'; // Ring color

                        return (
                            <g key={`${r}-${c}`} transform={`translate(${cx}, ${cy})`}>
                                <circle r={CELL_SIZE * 0.4} fill="#fcecce" stroke={strokeColor} strokeWidth="1.5" />
                                <text
                                    dy="0.35em"
                                    textAnchor="middle"
                                    fontSize={CELL_SIZE * 0.55}
                                    fontWeight="bold"
                                    fill={textColor}
                                    style={{ fontFamily: "KaiTi, serif" }}
                                >
                                    {piece.text}
                                </text>
                            </g>
                        );
                    })
                )}
            </g>
        </svg>
    );
};
