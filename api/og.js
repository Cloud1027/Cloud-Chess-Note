
import { ImageResponse } from '@vercel/og';

export const config = {
    runtime: 'edge',
};

const FIREBASE_PROJECT_ID = "cloud-chess-note";
const FIREBASE_API_KEY = "AIzaSyArrCjf0xUCqpw4Yo2pm9fefSzNR1twgRM";

const PIECES = {
    red: { king: '帥', advisor: '仕', elephant: '相', horse: '傌', chariot: '俥', cannon: '炮', soldier: '兵' },
    black: { king: '將', advisor: '士', elephant: '象', horse: '馬', chariot: '車', cannon: '包', soldier: '卒' }
};

const charToPiece = {
    'K': { color: 'red', text: PIECES.red.king },
    'A': { color: 'red', text: PIECES.red.advisor },
    'B': { color: 'red', text: PIECES.red.elephant },
    'N': { color: 'red', text: PIECES.red.horse },
    'R': { color: 'red', text: PIECES.red.chariot },
    'C': { color: 'red', text: PIECES.red.cannon },
    'P': { color: 'red', text: PIECES.red.soldier },
    'k': { color: 'black', text: PIECES.black.king },
    'a': { color: 'black', text: PIECES.black.advisor },
    'b': { color: 'black', text: PIECES.black.elephant },
    'n': { color: 'black', text: PIECES.black.horse },
    'r': { color: 'black', text: PIECES.black.chariot },
    'c': { color: 'black', text: PIECES.black.cannon },
    'p': { color: 'black', text: PIECES.black.soldier }
};

export default async function handler(req) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    let fen = searchParams.get('fen') || 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';

    if (id && !searchParams.get('fen')) {
        try {
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/games/${id}?key=${FIREBASE_API_KEY}`;
            const fsRes = await fetch(firestoreUrl);
            if (fsRes.ok) {
                const data = await fsRes.json();
                fen = data.fields?.fen?.stringValue || fen;
            }
        } catch (e) {
            console.error("Error fetching FEN for OG image", e);
        }
    }

    const board = parseFen(fen);
    const cellSize = 60;
    const padding = 30;

    // Use ImageResponse to generate PNG
    return new ImageResponse(
        (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f3e4c4',
                    width: '100%',
                    height: '100%',
                    padding: `${padding}px`,
                }}
            >
                {/* Board Container */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        width: `${cellSize * 8}px`,
                        height: `${cellSize * 9}px`,
                        position: 'relative',
                        border: '2px solid #333',
                    }}
                >
                    {/* Horizontal Lines */}
                    {[...Array(10)].map((_, i) => (
                        <div
                            key={`h-${i}`}
                            style={{
                                position: 'absolute',
                                top: `${i * cellSize}px`,
                                left: 0,
                                width: '100%',
                                height: '1px',
                                backgroundColor: '#333',
                            }}
                        />
                    ))}
                    {/* Vertical Lines */}
                    {[...Array(9)].map((_, i) => (
                        <div
                            key={`v-${i}`}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: `${i * cellSize}px`,
                                width: '1px',
                                height: '100%',
                                backgroundColor: '#333',
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            {/* Break the line at the river */}
                            {i !== 0 && i !== 8 && (
                                <div style={{
                                    position: 'absolute',
                                    top: `${cellSize * 4}px`,
                                    left: '-5px',
                                    width: '10px',
                                    height: `${cellSize}px`,
                                    backgroundColor: '#f3e4c4',
                                    zIndex: 1
                                }} />
                            )}
                        </div>
                    ))}

                    {/* Palaces X Lines (Omitted for simplicity in CSS rendering, but can be added with absolute skewed divs if needed) */}

                    {/* River Text */}
                    <div style={{
                        position: 'absolute',
                        top: `${cellSize * 4}px`,
                        left: 0,
                        width: '100%',
                        height: `${cellSize}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-around',
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: '#333',
                        zIndex: 2
                    }}>
                        <span>楚 河</span>
                        <span>漢 界</span>
                    </div>

                    {/* Pieces */}
                    {board.map((row, r) =>
                        row.map((piece, c) => piece && (
                            <div
                                key={`${r}-${c}`}
                                style={{
                                    position: 'absolute',
                                    top: `${r * cellSize - 25}px`,
                                    left: `${c * cellSize - 25}px`,
                                    width: '50px',
                                    height: '50px',
                                    borderRadius: '50%',
                                    backgroundColor: 'white',
                                    border: `2px solid ${piece.color === 'red' ? '#cc0000' : '#000'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '28px',
                                    fontWeight: 'bold',
                                    color: piece.color === 'red' ? '#cc0000' : '#000',
                                    zIndex: 10
                                }}
                            >
                                <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    border: '1px solid currentColor',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {piece.text}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        ),
        {
            width: 600,
            height: 600,
        }
    );
}

function parseFen(fen) {
    const board = Array(10).fill(null).map(() => Array(9).fill(null));
    const parts = fen.split(' ');
    const position = parts[0];
    const rows = position.split('/');

    for (let r = 0; r < 10; r++) {
        const rowData = rows[r];
        if (!rowData) continue;
        let c = 0;
        for (let i = 0; i < rowData.length; i++) {
            const char = rowData[i];
            if (/\d/.test(char)) {
                c += parseInt(char);
            } else {
                const piece = charToPiece[char];
                if (piece) {
                    board[r][c] = piece;
                }
                c++;
            }
        }
    }
    return board;
}
