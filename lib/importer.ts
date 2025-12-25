
import { MoveNode, Piece, PieceColor, Point } from '../types';
import { getFen, fenToBoard, getChineseNotation } from './utils';
import { PIECES } from '../constants';

const CN_NUMS: Record<string, number> = {
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
    "１": 1, "２": 2, "３": 3, "４": 4, "５": 5, "６": 6, "７": 7, "８": 8, "９": 9,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "０": 0, "0": 0
};

interface ParsedGame {
    fen: string;
    moves: { moveStr: string; notation: string; comment?: string }[];
    header: Record<string, string>;
    root?: MoveNode;
}

interface SkeletonNode {
    id: string;
    moveStr: string;
    stepIndex: number;
    ownerId: number;
    comment: string;
    children: SkeletonNode[];
    parentId: string | null;
}

export const Importer = {
    parseInput(text: string): ParsedGame {
        if (text.includes('[DhtmlXQ')) {
            return this.parseDhtmlXQ(text);
        } else {
            return this.parseTextNotation(text);
        }
    },

    normalizeText(text: string): string {
        let out = text.replace(/[０-９１-９]/g, (m) => {
            const code = m.charCodeAt(0);
            if (code >= 65296 && code <= 65305) return String.fromCharCode(code - 65248);
            if (code >= 65313 && code <= 65321) return String.fromCharCode(code - 65248);
            return m;
        });

        out = out.replace(/[－—–]/g, '-');
        out = out.replace(/[，；：　]/g, ' ');
        out = out.replace(/↔/g, '-');
        out = out.replace(/进/g, '進');
        out = out.replace(/后/g, '後');
        out = out.replace(/马/g, '馬');
        out = out.replace(/车/g, '車');
        out = out.replace(/炮/g, '炮');
        out = out.replace(/\d+\.\s*/g, ' ');
        out = out.replace(/第[一二三四五六七八九十\d]+步[：:]/g, ' ');
        out = out.replace(/[，,。.、；;：:]/g, ' ');

        return out;
    },

    extractTextMetadata(text: string): Record<string, string> {
        const header: Record<string, string> = { Title: "", Event: "", Date: "", Red: "", Black: "", Result: "" };

        const extract = (patterns: RegExp[]) => {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match && match[1]) return match[1].trim();
            }
            return "";
        };

        header.Title = extract([/[棋局标標題题]+[：:]\s*(.+?)(?:\r?\n|$)/, /对局名称[：:]\s*(.+?)(?:\r?\n|$)/, /\[Game\s+"(.+?)"\]/i]);
        header.Event = extract([/赛事[名称稱]*[：:]\s*(.+?)(?:\r?\n|$)/, /賽事[名称稱]*[：:]\s*(.+?)(?:\r?\n|$)/, /\[Event\s+"(.+?)"\]/i]);
        header.Date = extract([/日期[：:]\s*(.+?)(?:\r?\n|$)/, /\[Date\s+"(.+?)"\]/i, /(\d{4}[.\-\/年]\d{1,2}[.\-\/月]\d{1,2})/]);
        header.Red = extract([/红方[名称稱]*[：:]\s*(.+?)(?:\r?\n|$)/, /紅方[名称稱]*[：:]\s*(.+?)(?:\r?\n|$)/, /\[Red\s+"(.+?)"\]/i]);
        header.Black = extract([/黑方[名称稱]*[：:]\s*(.+?)(?:\r?\n|$)/, /\[Black\s+"(.+?)"\]/i]);
        const resultRaw = extract([/[对對]局[结結]果[：:]\s*(.+?)(?:\r?\n|$)/, /結果[：:]\s*(.+?)(?:\r?\n|$)/, /\[Result\s+"(.+?)"\]/i]);

        if (resultRaw) {
            if (/红胜|紅勝|先[胜勝]|1-0/.test(resultRaw)) header.Result = "紅勝";
            else if (/黑胜|黑勝|先[负負]|后[胜勝]|0-1/.test(resultRaw)) header.Result = "黑勝";
            else if (/和|平|1\/2/.test(resultRaw)) header.Result = "和局";
            else header.Result = resultRaw;
        }

        return header;
    },

    parseTextNotation(text: string): ParsedGame {
        let fen = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";

        const header = this.extractTextMetadata(text);

        const fenMatch = text.match(/\[FEN\s+"([^"]+)"\]/i) || text.match(/[Ff][Ee][Nn][串：:\s]+([rnbakabnrcpRNBAKABNRCP1-9\/]+ [wb])/);
        if (fenMatch) {
            if (text.includes('[')) fen = fenMatch[1];
            else fen = fenMatch[1] + " - - 0 1";
        }

        let body = text.replace(/\[[^\]]+\]/g, " ");
        const comments: string[] = [];
        body = body.replace(/\{([\s\S]*?)\}/g, (m, p1) => {
            if (m.startsWith('{#')) return m;
            comments.push(p1.trim());
            return ` __COMMENT_${comments.length - 1}__ `;
        });
        body = body.replace(/\{#([\s\S]*?)#\}/g, (m, p1) => {
            comments.push(p1.trim());
            return ` __COMMENT_${comments.length - 1}__ `;
        });

        const normalizedBody = this.normalizeText(body);
        // Updated Regex: Supports "前马退4" (Pos+Piece), "兵前进1" (Piece+Pos), "炮二平五" (Piece+Col)
        const moveRegex = /([a-i][0-9]-?[a-i][0-9]|[RCNHPKAB][1-9][+.-][1-9]|(?:[\u4e00-\u9fa5]{2}|[\u4e00-\u9fa5][0-9])[進进退平][0-9一二三四五六七八九]|__COMMENT_\d+__)/gi;
        const rawTokens = normalizedBody.match(moveRegex) || [];

        const moves: { moveStr: string; notation: string; comment?: string }[] = [];
        let { board: currentBoard, turn: currentTurn } = fenToBoard(fen);
        let currentMoveObj: any = null;

        for (let token of rawTokens) {
            if (token.startsWith("__COMMENT_")) {
                if (currentMoveObj) {
                    const idx = parseInt(token.match(/\d+/)![0]);
                    currentMoveObj.comment = (currentMoveObj.comment || "") + (currentMoveObj.comment ? " " : "") + comments[idx];
                }
                continue;
            }

            let moveStr: string | null = null;
            const tokenLower = token.toLowerCase();
            if (/^[a-i][0-9]/.test(tokenLower)) {
                moveStr = this.iccsToMoveStr(token);
            } else if (/^[RCNHPKAB]/i.test(token)) {
                moveStr = this.parseWXFMove(token, currentBoard, currentTurn);
            } else if (/[\u4e00-\u9fa5]/.test(token)) {
                moveStr = this.parseChineseMove(token, currentBoard, currentTurn);
            }

            if (moveStr) {
                const [src, dst] = moveStr.split('-').map(Number);
                const r1 = Math.floor(src / 9), c1 = src % 9;
                const r2 = Math.floor(dst / 9), c2 = dst % 9;

                const piece = currentBoard[r1][c1];
                if (piece) {
                    let finalNotation = token;
                    if (!/[\u4e00-\u9fa5]/.test(token)) {
                        finalNotation = getChineseNotation(currentBoard, {
                            from: { r: r1, c: c1 },
                            to: { r: r2, c: c2 },
                            piece,
                            captured: currentBoard[r2][c2]
                        });
                    }

                    currentMoveObj = { moveStr, notation: finalNotation };
                    moves.push(currentMoveObj);

                    const newBoard = currentBoard.map(row => [...row]);
                    newBoard[r2][c2] = piece;
                    newBoard[r1][c1] = null;
                    currentBoard = newBoard;
                    currentTurn = currentTurn === 'red' ? 'black' : 'red';
                }
            }
        }

        return { fen, moves, header };
    },

    parseChineseMove(text: string, board: (Piece | null)[][], turn: PieceColor): string | null {
        if (text.length < 3) return null;
        const isRed = turn === 'red';
        
        let name = text[0];
        let srcColChar = text[1];
        let dir = text[2];
        let destChar = text[3];

        // Handle "前马...", "中炮...", "后车..." (Position indicator at start)
        // Check text[0] for Position markers
        if (["前", "后", "後", "中"].includes(text[0])) {
            const pos = text[0];
            name = text[1]; // The piece name is the second char
            srcColChar = pos; // Use the position marker as the "Source Column" logic identifier
            dir = text[2];
            destChar = text[3];
        }

        let candidates: { r: number, c: number }[] = [];
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p && p.color === turn && this.matchPieceName(p.text, name)) {
                    candidates.push({ r, c });
                }
            }
        }

        if (["前", "后", "後", "中"].includes(srcColChar)) {
            const colGroups: Record<number, { r: number, c: number }[]> = {};
            candidates.forEach(cand => {
                if (!colGroups[cand.c]) colGroups[cand.c] = [];
                colGroups[cand.c].push(cand);
            });

            let bestCol = -1;
            for (const c in colGroups) {
                if (colGroups[c].length > 1) {
                    colGroups[c].sort((a, b) => a.r - b.r);
                    let picked = null;
                    if (isRed) {
                        if (srcColChar === "前") picked = colGroups[c][0];
                        if (srcColChar === "后" || srcColChar === "後") picked = colGroups[c][colGroups[c].length - 1];
                        if (srcColChar === "中") picked = colGroups[c][1];
                    } else {
                        if (srcColChar === "前") picked = colGroups[c][colGroups[c].length - 1];
                        if (srcColChar === "后" || srcColChar === "後") picked = colGroups[c][0];
                        if (srcColChar === "中") picked = colGroups[c][1];
                    }
                    if (picked) {
                        candidates = [picked];
                        bestCol = parseInt(c);
                        break;
                    }
                }
            }
            if (bestCol === -1) return null;
        } else {
            const colNum = CN_NUMS[srcColChar];
            if (colNum !== undefined) {
                const targetX1 = isRed ? (9 - colNum) : (colNum - 1);
                candidates = candidates.filter(cand => cand.c === targetX1);
            } else {
                return null;
            }
        }

        if (candidates.length === 0) return null;
        candidates.sort((a, b) => isRed ? (a.r - b.r) : (b.r - a.r));
        const from = candidates[0];

        const destNum = CN_NUMS[destChar];
        if (destNum === undefined) return null;

        let toR = from.r;
        let toC = from.c;
        const pName = board[from.r][from.c]?.text || '';
        const isLinear = ['車', '俥', '炮', '砲', '兵', '卒', '將', '帥', '帥', '将'].some(x => this.matchPieceName(x, pName));

        if (dir === "平") {
            toC = isRed ? (9 - destNum) : (destNum - 1);
        } else {
            const isForward = (dir === "進" || dir === "进");
            const moveSign = isRed ? (isForward ? -1 : 1) : (isForward ? 1 : -1);
            if (isLinear) {
                toR = from.r + (destNum * moveSign);
            } else {
                toC = isRed ? (9 - destNum) : (destNum - 1);
                const dc = Math.abs(toC - from.c);
                let dr = 0;
                if (this.matchPieceName('馬', pName)) dr = (dc === 2) ? 1 : 2;
                else if (this.matchPieceName('相', pName)) dr = 2;
                else dr = 1;
                toR = from.r + (dr * moveSign);
            }
        }

        if (toR < 0 || toR > 9 || toC < 0 || toC > 8) return null;
        return `${from.r * 9 + from.c}-${toR * 9 + toC}`;
    },

    parseWXFMove(wxf: string, board: (Piece | null)[][], turn: PieceColor): string | null {
        const pieceChar = wxf[0].toUpperCase();
        const col = parseInt(wxf[1]);
        const dir = wxf[2];
        const dest = parseInt(wxf[3]);
        const map: Record<string, string> = { 'R': '車', 'C': '炮', 'N': '馬', 'H': '馬', 'P': '兵', 'K': '將', 'A': '士', 'B': '相', 'E': '相', 'S': '兵' };
        const cnPiece = map[pieceChar];
        if (!cnPiece) return null;
        const cnDir = dir === '+' ? '進' : (dir === '-' ? '退' : '平');
        const cnCol = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][col];
        const cnDest = dir === '.' ? ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][dest] : dest.toString();
        return this.parseChineseMove(`${cnPiece}${cnCol}${cnDir}${cnDest}`, board, turn);
    },

    matchPieceName(actualName: string, queryName: string): boolean {
        const map: Record<string, string[]> = {
            '車': ['車', '俥', '车', 'R', 'r', '連'],
            '馬': ['馬', '傌', '马', 'N', 'n', 'H', 'h', '偶'],
            '炮': ['炮', '砲', '包', 'C', 'c'],
            '兵': ['兵', '卒', 'P', 'p'],
            '卒': ['兵', '卒', 'P', 'p'],
            '相': ['相', '象', 'B', 'b', 'E', 'e'],
            '象': ['相', '象', 'B', 'b', 'E', 'e'],
            '士': ['仕', '士', 'A', 'a'],
            '仕': ['仕', '士', 'A', 'a'],
            '將': ['將', '帥', '将', '帅', 'K', 'k'],
            '帥': ['將', '帥', '将', '帅', 'K', 'k']
        };
        let standardKey = '';
        for (const k in map) {
            if (map[k].includes(actualName) || k === actualName) {
                standardKey = k;
                break;
            }
        }
        if (!standardKey) return actualName === queryName;
        return map[standardKey].includes(queryName) || standardKey === queryName;
    },

    iccsToMoveStr(iccs: string): string {
        const matches = iccs.match(/([a-i])([0-9]).*([a-i])([0-9])/i);
        if (!matches) return "";
        const c1 = matches[1].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
        const r1 = 9 - parseInt(matches[2]);
        const c2 = matches[3].toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
        const r2 = 9 - parseInt(matches[4]);
        return `${r1 * 9 + c1}-${r2 * 9 + c2}`;
    },

    parseDhtmlXQ(text: string): ParsedGame {
        const getTag = (tag: string) => {
            const regex = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'i');
            const m = text.match(regex);
            return m ? m[1].trim() : "";
        };

        const header: Record<string, string> = {
            Title: getTag('DhtmlXQ_title'),
            Event: getTag('DhtmlXQ_event'),
            Date: getTag('DhtmlXQ_date'),
            Red: getTag('DhtmlXQ_red'),
            Black: getTag('DhtmlXQ_black'),
            Result: getTag('DhtmlXQ_result')
        };

        const moveListTag = /\[DhtmlXQ_movelist\]([\d\s]+)\[\/DhtmlXQ_movelist\]/.exec(text);
        const firstMoveStr = moveListTag ? moveListTag[1].replace(/\s/g, "").substring(0, 4) : null;
        let isRedTop = false;
        if (firstMoveStr && firstMoveStr.length === 4) {
            if (parseInt(firstMoveStr[1]) > 4) isRedTop = true;
        }

        let fen = getTag('DhtmlXQ_fen');
        if (!fen) {
            const binit = getTag('DhtmlXQ_binit');
            fen = binit ? this.convertBinitToFen(binit, isRedTop) : "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";
        }

        const rootSkeleton: SkeletonNode = { id: 'root', moveStr: "", stepIndex: 0, ownerId: 0, children: [], comment: "", parentId: null };
        const multiNodeMap = new Map<number, SkeletonNode[]>();
        multiNodeMap.set(0, [rootSkeleton]);

        const parseLine = (str: string, parentNode: SkeletonNode, startStep: number, ownerId: number) => {
            str = str.replace(/[^\d]/g, "").split("||")[0];
            let curr = parentNode;
            let s = startStep;
            for (let i = 0; i < str.length; i += 4) {
                s++;
                const move = str.substring(i, i + 4);
                if (move.length < 4) break;
                const node: SkeletonNode = {
                    id: Math.random().toString(36).substring(2, 9),
                    moveStr: move, stepIndex: s, ownerId: ownerId, children: [], comment: "", parentId: curr.id
                };
                curr.children.push(node);
                curr = node;
                if (!multiNodeMap.has(s)) multiNodeMap.set(s, []);
                multiNodeMap.get(s)!.push(node);
            }
        };

        if (moveListTag) parseLine(moveListTag[1], rootSkeleton, 0, 0);

        const varRegex = /\[DhtmlXQ_move_(\d+)_(\d+)_(\d+)\]([\s\S]*?)\[\/DhtmlXQ_move_\1_\2_\3\]/g;
        let m;
        while ((m = varRegex.exec(text)) !== null) {
            // Correct mapping: sourceId (parent branch) _ step _ targetId (new branch)
            const sourceId = parseInt(m[1]);
            const pId = parseInt(m[2]);
            const targetId = parseInt(m[3]);
            
            const pIdx = pId - 1;
            const content = m[4];
            const candidates = multiNodeMap.get(pIdx);
            
            if (candidates && candidates.length > 0) {
                // Find parent node that matches the sourceId
                let parent = candidates.find(n => n.ownerId === sourceId);
                // Fallback to last node if specific ID not found (though structure implies it should exist)
                if (!parent) parent = candidates[candidates.length - 1];
                
                if (parent) {
                    parseLine(content, parent, pIdx, targetId);
                }
            }
        }

        const commentRegex = /\[DhtmlXQ_comment(\d+)(?:_(\d+))?\]([\s\S]*?)\[\/DhtmlXQ_comment\1(?:_\2)?\]/g;
        while ((m = commentRegex.exec(text)) !== null) {
            const step = parseInt(m[2] || m[1]);
            const id = m[2] ? parseInt(m[1]) : 0;
            const nodes = multiNodeMap.get(step);
            if (nodes) {
                let target = nodes.find(n => n.ownerId === id);
                if (!target) target = nodes[0];
                if (target) target.comment = m[3].trim();
            }
        }

        const { board: startBoard, turn: startTurn } = fenToBoard(fen);
        const hydrate = (skel: SkeletonNode, pBoard: (Piece | null)[][], pTurn: PieceColor): MoveNode => {
            let moveObj = null;
            let newBoard = pBoard;
            let nextTurn = pTurn;
            let newFen = getFen(newBoard, nextTurn);
            if (skel.moveStr) {
                const c1 = parseInt(skel.moveStr[0]);
                const r1 = parseInt(skel.moveStr[1]);
                const c2 = parseInt(skel.moveStr[2]);
                const r2 = parseInt(skel.moveStr[3]);
                const from = { r: r1, c: c1 };
                const to = { r: r2, c: c2 };
                const piece = pBoard[r1][c1];
                const captured = pBoard[r2][c2];
                if (piece) {
                    const notation = getChineseNotation(pBoard, { from, to, piece, captured });
                    moveObj = { from, to, piece, captured, notation };
                    newBoard = pBoard.map(row => [...row]);
                    newBoard[r2][c2] = piece;
                    newBoard[r1][c1] = null;
                    nextTurn = pTurn === 'red' ? 'black' : 'red';
                    newFen = getFen(newBoard, nextTurn);
                }
            }
            const node: MoveNode = {
                id: skel.id, parentId: skel.parentId, move: moveObj,
                boardState: newBoard, children: [], comment: skel.comment,
                turn: nextTurn, fen: newFen, stepIndex: skel.stepIndex, ownerId: skel.ownerId
            };
            if (skel.children.length > 0) {
                node.children = skel.children.map(c => hydrate(c, newBoard, nextTurn));
                node.selectedChildId = node.children[0].id;
            }
            return node;
        };

        return { fen, moves: [], header, root: hydrate(rootSkeleton, startBoard, startTurn) };
    },

    convertBinitToFen(binitStr: string, isRedTop: boolean): string {
        if (!binitStr || binitStr.length !== 64) return "";
        const boardChars = new Array(90).fill(null);
        const redGroup = "RNBAKABNRCCPPPPP".split("");
        const blackGroup = "rnbakabnrccppppp".split("");
        const topGroup = isRedTop ? redGroup : blackGroup;
        const bottomGroup = isRedTop ? blackGroup : redGroup;

        for (let i = 0; i < 32; i++) {
            const x = parseInt(binitStr[i * 2]);
            const y = parseInt(binitStr[i * 2 + 1]);
            const idx = y * 9 + x;
            if (i < 16) boardChars[idx] = topGroup[i];
            else boardChars[idx] = bottomGroup[i - 16];
        }

        let out = "";
        for (let r = 0; r < 10; r++) {
            let empty = 0;
            for (let c = 0; c < 9; c++) {
                const char = boardChars[r * 9 + c];
                if (char) {
                    if (empty > 0) { out += empty; empty = 0; }
                    out += char;
                } else { empty++; }
            }
            if (empty > 0) out += empty;
            if (r < 9) out += "/";
        }
        return out + " w - - 0 1";
    }
};
