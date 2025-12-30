
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

export default async function handler(req, res) {
    const { id, fen: queryFen } = req.query;
    let fen = queryFen || 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';

    if (id && !queryFen) {
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

    const svg = generateSVG(fen);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.status(200).send(svg);
}

function generateSVG(fen) {
    const board = parseFen(fen);
    const cellSize = 60;
    const margin = 30;
    const width = cellSize * 8 + margin * 2;
    const height = cellSize * 9 + margin * 2;

    let svgLines = [];
    // Background
    svgLines.push(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`);
    svgLines.push(`<rect width="100%" height="100%" fill="#f3e4c4" />`);

    // Board Lines
    // Horizontals
    for (let i = 0; i < 10; i++) {
        const y = margin + i * cellSize;
        svgLines.push(`<line x1="${margin}" y1="${y}" x2="${width - margin}" y2="${y}" stroke="#333" stroke-width="1" />`);
    }
    // Verticals
    for (let i = 0; i < 9; i++) {
        const x = margin + i * cellSize;
        // Upper part
        svgLines.push(`<line x1="${x}" y1="${margin}" x2="${x}" y2="${margin + 4 * cellSize}" stroke="#333" stroke-width="1" />`);
        // Lower part
        svgLines.push(`<line x1="${x}" y1="${margin + 5 * cellSize}" x2="${x}" y2="${margin + 9 * cellSize}" stroke="#333" stroke-width="1" />`);
    }
    // Vertical edges (full line)
    svgLines.push(`<line x1="${margin}" y1="${margin}" x2="${margin}" y2="${height - margin}" stroke="#333" stroke-width="1" />`);
    svgLines.push(`<line x1="${width - margin}" y1="${margin}" x2="${width - margin}" y2="${height - margin}" stroke="#333" stroke-width="1" />`);

    // Palaces (X lines)
    // Black Palace
    svgLines.push(`<line x1="${margin + 3 * cellSize}" y1="${margin}" x2="${margin + 5 * cellSize}" y2="${margin + 2 * cellSize}" stroke="#333" stroke-width="1" />`);
    svgLines.push(`<line x1="${margin + 5 * cellSize}" y1="${margin}" x2="${margin + 3 * cellSize}" y2="${margin + 2 * cellSize}" stroke="#333" stroke-width="1" />`);
    // Red Palace
    svgLines.push(`<line x1="${margin + 3 * cellSize}" y1="${height - margin}" x2="${margin + 5 * cellSize}" y2="${height - margin - 2 * cellSize}" stroke="#333" stroke-width="1" />`);
    svgLines.push(`<line x1="${margin + 5 * cellSize}" y1="${height - margin}" x2="${margin + 3 * cellSize}" y2="${height - margin - 2 * cellSize}" stroke="#333" stroke-width="1" />`);

    // River Text
    const riverY = margin + 4.5 * cellSize;
    svgLines.push(`<text x="${margin + 1.5 * cellSize}" y="${riverY}" font-family="serif" font-size="24" fill="#333" text-anchor="middle" dominant-baseline="middle" transform="rotate(0)">楚河</text>`);
    svgLines.push(`<text x="${width - margin - 1.5 * cellSize}" y="${riverY}" font-family="serif" font-size="24" fill="#333" text-anchor="middle" dominant-baseline="middle" transform="rotate(0)">漢界</text>`);

    // Pieces
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const piece = board[r][c];
            if (piece) {
                const x = margin + c * cellSize;
                const y = margin + r * cellSize;
                const color = piece.color === 'red' ? '#cc0000' : '#000000';

                // Shadow/Border
                svgLines.push(`<circle cx="${x}" cy="${y}" r="26" fill="white" stroke="${color}" stroke-width="2" />`);
                svgLines.push(`<circle cx="${x}" cy="${y}" r="22" fill="white" stroke="${color}" stroke-width="1" />`);

                // Text
                svgLines.push(`<text x="${x}" y="${y}" font-family="serif" font-size="28" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="central">${piece.text}</text>`);
            }
        }
    }

    svgLines.push(`</svg>`);
    return svgLines.join('\n');
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
