
import { MoveNode, GameMetadata } from '../types';

const toPgnCoord = (r: number, c: number): string => {
    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const rank = 9 - r;
    return `${files[c]}${rank}`;
};

const toDhtmlXQCoord = (r: number, c: number): string => {
    return `${c}${9 - r}`;
};

export const Exporter = {

    generateDhtmlXQ(root: MoveNode, meta: GameMetadata): string {
        let out = '[DhtmlXQ]\n';
        out += `[DhtmlXQ_ver]www_dpxq_com[/DhtmlXQ_ver]\n`;
        out += `[DhtmlXQ_init]500,350[/DhtmlXQ_init]\n`;
        out += `[DhtmlXQ_pver]1300700002[/DhtmlXQ_pver]\n`;

        if (meta.title) out += `[DhtmlXQ_title]${meta.title}[/DhtmlXQ_title]\n`;
        if (meta.event) out += `[DhtmlXQ_event]${meta.event}[/DhtmlXQ_event]\n`;
        if (meta.date) out += `[DhtmlXQ_date]${meta.date}[/DhtmlXQ_date]\n`;
        if (meta.redName) out += `[DhtmlXQ_red]${meta.redName}[/DhtmlXQ_red]\n`;
        if (meta.blackName) out += `[DhtmlXQ_black]${meta.blackName}[/DhtmlXQ_black]\n`;
        if (meta.result !== 'unknown') {
            const resMap = { red: '紅勝', black: '黑勝', draw: '和局' };
            out += `[DhtmlXQ_result]${resMap[meta.result] || ''}[/DhtmlXQ_result]\n`;
        }

        if (root.boardState) {
            const binit = this.generateBinit(root.boardState);
            out += `[DhtmlXQ_binit]${binit}[/DhtmlXQ_binit]\n`;
        }

        if (root.fen) {
            out += `[DhtmlXQ_fen]${root.fen}[/DhtmlXQ_fen]\n`;
        }

        const firstNum = root.turn === 'black' ? 1 : 0;
        out += `[DhtmlXQ_firstnum]${firstNum}[/DhtmlXQ_firstnum]\n`;

        const resultList: string[] = [];
        const commentResult: string[] = [];
        let branchCounter = 0; 

        if (root.comment) {
            commentResult.push(`[DhtmlXQ_comment0]${root.comment.replace(/\n/g, '||')}[/DhtmlXQ_comment0]`);
        }

        const variationQueue: { node: MoveNode, parentIdx: number, parentSteps: number, branchIdx: number }[] = [];

        const processBranch = (startNode: MoveNode, parentIdx: number, parentSteps: number, branchIdx: number) => {
            let movesStr = '';
            let current: MoveNode | null = startNode;
            let step = 0;

            while (current) {
                if (current.move) {
                    const f = current.move.from;
                    const t = current.move.to;
                    movesStr += `${toDhtmlXQCoord(f.r, f.c)}${toDhtmlXQCoord(t.r, t.c)}`;
                }

                if (current.comment) {
                    const currentTotalStep = parentSteps + step;
                    const tag = branchIdx === 0 ? `[DhtmlXQ_comment${currentTotalStep}]` : `[DhtmlXQ_comment${branchIdx}_${currentTotalStep}]`;
                    commentResult.push(`${tag}${current.comment.replace(/\n/g, '||')}${tag.replace('[', '[/')}`);
                }

                if (current.children.length > 1) {
                    for (let i = 1; i < current.children.length; i++) {
                        const child = current.children[i];
                        branchCounter++;
                        variationQueue.push({
                            node: child,
                            parentIdx: branchIdx,
                            parentSteps: parentSteps + step + 1,
                            branchIdx: branchCounter
                        });
                    }
                }

                current = (current.children && current.children.length > 0) ? current.children[0] : null;
                if (current) step++;
            }

            if (branchIdx === 0) {
                resultList.push(`[DhtmlXQ_movelist]${movesStr}[/DhtmlXQ_movelist]`);
            } else {
                resultList.push(`[DhtmlXQ_move_${parentIdx}_${parentSteps}_${branchIdx}]${movesStr}[/DhtmlXQ_move_${parentIdx}_${parentSteps}_${branchIdx}]`);
            }
        };

        if (root.children && root.children.length > 0) {
            processBranch(root.children[0], 0, 1, 0);
            for (let i = 1; i < root.children.length; i++) {
                branchCounter++;
                variationQueue.push({
                    node: root.children[i],
                    parentIdx: 0,
                    parentSteps: 1,
                    branchIdx: branchCounter
                });
            }
        } else {
            resultList.push(`[DhtmlXQ_movelist][/DhtmlXQ_movelist]`);
        }

        while (variationQueue.length > 0) {
            const varData = variationQueue.shift()!;
            processBranch(varData.node, varData.parentIdx, varData.parentSteps, varData.branchIdx);
        }

        out += resultList.join('\n') + '\n';
        out += commentResult.join('\n') + '\n';
        out += `[DhtmlXQ_generator]AI_Studio_CloudNote[/DhtmlXQ_generator]\n`;
        out += '[/DhtmlXQ]';

        return out;
    },

    generateBinit(board: any[][]): string {
        const slots: string[] = Array(32).fill("99");
        const findPieces = (color: 'red' | 'black', type: string): { r: number, c: number }[] => {
            const points: { r: number, c: number }[] = [];
            for (let r = 0; r < 10; r++) {
                for (let c = 0; c < 9; c++) {
                    const p = board[r][c];
                    if (p && p.color === color && p.type === type) { points.push({ r, c }); }
                }
            }
            return points.sort((a, b) => (a.r - b.r) || (a.c - b.c));
        };
        const fillSlots = (color: 'red' | 'black', offset: number) => {
            const assign = (type: string, indices: number[]) => {
                const pieces = findPieces(color, type);
                indices.forEach((slotIdx, i) => {
                    if (pieces[i]) { slots[offset + slotIdx] = `${pieces[i].c}${9 - pieces[i].r}`; }
                });
            };
            assign('chariot', [0, 8]); assign('horse', [1, 7]); assign('elephant', [2, 6]); assign('advisor', [3, 5]); assign('king', [4]); assign('cannon', [9, 10]); assign('soldier', [11, 12, 13, 14, 15]);
        };
        fillSlots('black', 0); fillSlots('red', 16);
        return slots.join("");
    },

    generatePGN(root: MoveNode, meta: GameMetadata): string {
        let resLabel = '對局';
        if (meta.result === 'red') resLabel = '先勝';
        else if (meta.result === 'black') resLabel = '後勝';
        else if (meta.result === 'draw') resLabel = '和局';
        const dynamicTitle = `${meta.redName || '紅方'} ${resLabel} ${meta.blackName || '黑方'}`;

        let out = '';
        out += `[Game "Chinese Chess"]\n`;
        out += `[Title "${meta.title || dynamicTitle}"]\n`;
        out += `[Event "${meta.event || ''}"]\n`;
        out += `[Red "${meta.redName || 'Unknown'}"]\n`;
        out += `[RedTeam ""]\n`;
        out += `[Black "${meta.blackName || 'Unknown'}"]\n`;
        out += `[BlackName ""]\n`;
        out += `[Opening "${meta.title || ''}"]\n`;
        out += `[Date "${meta.date?.replace(/-/g, '.') || ''}"]\n`;
        out += `[Site ""]\n`;
        out += `[Round ""]\n`;
        out += `[Format "ICCS"]\n`;

        let resStr = '*';
        if (meta.result === 'red') resStr = '1-0';
        else if (meta.result === 'black') resStr = '0-1';
        else if (meta.result === 'draw') resStr = '1/2-1/2';
        out += `[Result "${resStr}"]\n`;

        const standardFen = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";
        if (root.fen && root.fen.split(' ')[0] !== standardFen.split(' ')[0]) {
            out += `[FEN "${root.fen}"]\n`;
        }

        out += '\n';

        const mainLineMoves: string[] = [];
        let curr: MoveNode | null = root;
        if (root.children.length > 0) {
            curr = root.selectedChildId ? root.children.find(c => c.id === root.selectedChildId)! : root.children[0];
            while (curr) {
                if (curr.move) {
                    mainLineMoves.push(this.getPgnMoveString(curr));
                }
                if (curr.children.length > 0) {
                    curr = curr.selectedChildId ? curr.children.find(c => c.id === curr.selectedChildId)! : curr.children[0];
                } else {
                    curr = null;
                }
            }
        }

        for (let i = 0; i < mainLineMoves.length; i += 2) {
            const roundNum = Math.floor(i / 2) + 1;
            const redMove = mainLineMoves[i];
            const blackMove = mainLineMoves[i + 1] || "";
            
            out += `${roundNum}. ${redMove} ${blackMove}`;
            if (i + 2 >= mainLineMoves.length) {
                out += ` ${resStr}\n`;
            } else {
                out += `\n`;
            }
        }

        if (mainLineMoves.length === 0) {
            out += resStr + "\n";
        }

        return out;
    },

    getPgnMoveString(node: MoveNode): string {
        if (!node.move) return '00-00';
        const { from, to } = node.move;
        return `${toPgnCoord(from.r, from.c)}-${toPgnCoord(to.r, to.c)}`;
    },

    generateText(root: MoveNode, meta: GameMetadata): string {
        let out = '';
        if (meta.title) out += `標題：${meta.title}\n`;
        if (meta.redName) out += `紅方：${meta.redName}\n`;
        if (meta.blackName) out += `黑方：${meta.blackName}\n`;
        if (meta.result !== 'unknown') out += `結果：${meta.result === 'red' ? '紅勝' : meta.result === 'black' ? '黑勝' : '和局'}\n`;
        out += '\n';

        let curr = root;
        const moves: string[] = [];

        while (curr.children.length > 0) {
            const next = curr.selectedChildId ? curr.children.find(c => c.id === curr.selectedChildId) : curr.children[0];
            if (!next || !next.move) break;
            moves.push(next.move.notation);
            curr = next;
        }

        for (let i = 0; i < moves.length; i += 2) {
            const redM = moves[i];
            const blackM = moves[i + 1] || '';
            out += `${Math.floor(i / 2) + 1}. ${redM}  ${blackM}\n`;
        }

        return out;
    },

    generateFenMove(root: MoveNode): string {
        let fen = root.fen;
        let out = `${fen} moves`;
        let curr = root;
        while (curr.children.length > 0) {
            const next = curr.selectedChildId ? curr.children.find(c => c.id === curr.selectedChildId) : curr.children[0];
            if (!next || !next.move) break;
            const f = next.move.from;
            const t = next.move.to;
            const iccsSimple = `${toPgnCoord(f.r, f.c).toLowerCase()}${toPgnCoord(t.r, t.c).toLowerCase()}`;
            out += ` ${iccsSimple}`;
            curr = next;
        }
        return out;
    }
};
