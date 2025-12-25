
import { MoveNode, Piece, GameMetadata } from '../types';
import { GIF_WORKER_SOURCE } from './gifWorkerSource';

interface GifConfig {
    startRound: number;
    endRound: number;
    interval: number;
    quality: number;
    width: number;
}

export const generateGif = async (
    rootNode: MoveNode,
    activePath: MoveNode[],
    metadata: GameMetadata,
    config: GifConfig,
    onProgress: (progress: number, status: string) => void
): Promise<Blob> => {

    // @ts-ignore
    if (!window.GIF) {
        throw new Error("GIF Library not loaded. Please refresh the page.");
    }

    // --- 嚴格尺寸鎖定 (8 的倍數) ---
    const MARGIN = 40;
    const RAW_WIDTH = config.width;
    const GRID_SIZE = Math.floor((RAW_WIDTH - MARGIN * 2) / 8);

    // 固定寬度為 8 的倍數
    const ACTUAL_WIDTH = Math.floor((GRID_SIZE * 8 + MARGIN * 2) / 8) * 8;
    const ACTUAL_BOARD_HEIGHT = GRID_SIZE * 9 + MARGIN * 2;

    // 計算標題高度
    const paddingY = 24;
    // 使用較大的行高，因為字體變大了
    const lineHeight = Math.floor(GRID_SIZE * 0.9); 
    const titleLines = metadata.title ? 1 : 0;
    const playerLines = (metadata.redName || metadata.blackName) ? 1 : 0;

    let headerHeight = 0;
    if (titleLines + playerLines > 0) {
        headerHeight = paddingY + (titleLines * Math.floor(lineHeight * 1.3)) + (playerLines * lineHeight) + paddingY;
    }

    // 固定總高度為 8 的倍數
    const TOTAL_HEIGHT = Math.ceil((headerHeight + ACTUAL_BOARD_HEIGHT) / 8) * 8;

    // --- Create Worker Blob URL to bypass CORS ---
    const workerBlob = new Blob([GIF_WORKER_SOURCE], { type: 'application/javascript' });
    const workerScriptUrl = URL.createObjectURL(workerBlob);

    // --- 使用 CDN 的官方 Worker 腳本 ---
    // @ts-ignore
    const gif = new window.GIF({
        workers: 2,
        quality: 10,
        // 使用 Blob URL
        workerScript: workerScriptUrl,
        width: ACTUAL_WIDTH,
        height: TOTAL_HEIGHT,
        transparent: null
    });

    // --- 繪圖邏輯 ---
    const canvas = document.createElement('canvas');
    canvas.width = ACTUAL_WIDTH;
    canvas.height = TOTAL_HEIGHT;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create canvas");

    const drawBoard = (board: (Piece | null)[][]) => {
        ctx.save();

        // A. 背景
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, ACTUAL_WIDTH, headerHeight);

        const boardY = headerHeight;
        const grad = ctx.createLinearGradient(0, boardY, 0, TOTAL_HEIGHT);
        grad.addColorStop(0, '#cbbfa0');
        grad.addColorStop(1, '#bba98b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, boardY, ACTUAL_WIDTH, ACTUAL_BOARD_HEIGHT);

        // B. 文字
        let textY = paddingY;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // 字體大小設定：與楚河漢界 (GRID_SIZE * 0.55) 一致或稍大
        const nameFontSize = Math.floor(GRID_SIZE * 0.55);
        const nameFontStyle = `bold ${nameFontSize}px "KaiTi", "STKaiti", "Microsoft JhengHei", sans-serif`;

        if (metadata.title) {
            ctx.font = `bold ${Math.floor(GRID_SIZE * 0.65)}px "KaiTi", "STKaiti", "Microsoft JhengHei", sans-serif`;
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(metadata.title, ACTUAL_WIDTH / 2, textY);
            textY += Math.floor(lineHeight * 1.3);
        }

        if (playerLines > 0) {
            ctx.font = nameFontStyle;
            const cx = ACTUAL_WIDTH / 2;
            const gap = Math.floor(GRID_SIZE * 0.8); // 名字與中間文字的間距

            const redName = metadata.redName || '';
            const blackName = metadata.blackName || '';
            const result = metadata.result;

            // 1. 紅方姓名 (靠右對齊)
            if (redName) {
                ctx.textAlign = 'right';
                ctx.fillStyle = '#f87171'; // 紅色
                ctx.fillText(redName, cx - gap/2, textY);
            }

            // 2. 中間文字邏輯 (VS / 勝 / 負 / 和)
            let centerText = '';
            let centerColor = '#71717a'; // 默認灰色
            let rightSuffix = ''; // 特殊情況：僅黑方有名字時，"負"或"和"顯示在黑方右邊

            if (result === 'red') {
                // 紅勝
                if (redName) { 
                    centerText = '勝'; 
                    centerColor = '#ef4444'; // 鮮紅
                }
            } else if (result === 'black') {
                // 黑勝 (紅負)
                if (redName) { 
                    centerText = '負'; 
                    centerColor = '#22c55e'; // 綠色
                } else if (blackName) {
                    rightSuffix = ' 負'; // 只填黑方，顯示 "黑方 負"
                }
            } else if (result === 'draw') {
                // 和棋
                if (redName || blackName) {
                    if (!redName && blackName) {
                        rightSuffix = ' 和';
                    } else {
                        centerText = '和';
                        centerColor = '#3b82f6'; // 藍色
                    }
                }
            } else {
                // 未知
                if (redName && blackName) {
                    centerText = 'VS';
                }
            }

            // 繪製中間文字
            if (centerText) {
                ctx.textAlign = 'center';
                ctx.fillStyle = centerColor;
                ctx.fillText(centerText, cx, textY);
            }

            // 3. 黑方姓名 (靠左對齊)
            if (blackName) {
                ctx.textAlign = 'left';
                ctx.fillStyle = '#a1a1aa'; // 淺灰
                const displayText = blackName + rightSuffix;
                ctx.fillText(displayText, cx + gap/2, textY);
            }
        }

        // C. 棋盤線
        ctx.translate(MARGIN, boardY + MARGIN);
        ctx.strokeStyle = '#3d2b1f';
        ctx.lineWidth = 1.6;

        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            ctx.moveTo(0, Math.floor(i * GRID_SIZE));
            ctx.lineTo(Math.floor(8 * GRID_SIZE), Math.floor(i * GRID_SIZE));
            ctx.stroke();
        }
        for (let j = 0; j < 9; j++) {
            const x = Math.floor(j * GRID_SIZE);
            if (j === 0 || j === 8) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, Math.floor(9 * GRID_SIZE)); ctx.stroke();
            } else {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, Math.floor(4 * GRID_SIZE)); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x, Math.floor(5 * GRID_SIZE)); ctx.lineTo(x, Math.floor(9 * GRID_SIZE)); ctx.stroke();
            }
        }
        const drawX = (baseR: number) => {
            const y1 = Math.floor(baseR * GRID_SIZE);
            const y2 = Math.floor((baseR + 2) * GRID_SIZE);
            const x1 = Math.floor(3 * GRID_SIZE);
            const x2 = Math.floor(5 * GRID_SIZE);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x2, y1); ctx.lineTo(x1, y2); ctx.stroke();
        };
        drawX(0); drawX(7);

        // 砲台/兵營裝飾符號
        const drawCorner = (cx: number, cy: number, skipLeft: boolean, skipRight: boolean) => {
            const len = Math.floor(GRID_SIZE * 0.18);
            const gap = Math.floor(GRID_SIZE * 0.08);
            ctx.lineWidth = 1.2;
            if (!skipLeft) {
                // 左上
                ctx.beginPath(); ctx.moveTo(cx - gap - len, cy - gap); ctx.lineTo(cx - gap, cy - gap); ctx.lineTo(cx - gap, cy - gap - len); ctx.stroke();
                // 左下
                ctx.beginPath(); ctx.moveTo(cx - gap - len, cy + gap); ctx.lineTo(cx - gap, cy + gap); ctx.lineTo(cx - gap, cy + gap + len); ctx.stroke();
            }
            if (!skipRight) {
                // 右上
                ctx.beginPath(); ctx.moveTo(cx + gap + len, cy - gap); ctx.lineTo(cx + gap, cy - gap); ctx.lineTo(cx + gap, cy - gap - len); ctx.stroke();
                // 右下
                ctx.beginPath(); ctx.moveTo(cx + gap + len, cy + gap); ctx.lineTo(cx + gap, cy + gap); ctx.lineTo(cx + gap, cy + gap + len); ctx.stroke();
            }
        };
        // 砲台位置
        [[1, 2], [7, 2], [1, 7], [7, 7]].forEach(([col, row]) => {
            drawCorner(Math.floor(col * GRID_SIZE), Math.floor(row * GRID_SIZE), col === 0, col === 8);
        });
        // 兵/卒位置
        [[0, 3], [2, 3], [4, 3], [6, 3], [8, 3], [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]].forEach(([col, row]) => {
            drawCorner(Math.floor(col * GRID_SIZE), Math.floor(row * GRID_SIZE), col === 0, col === 8);
        });

        ctx.font = `bold ${Math.floor(GRID_SIZE * 0.55)}px "KaiTi", serif`;
        ctx.fillStyle = '#3d2b1f';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const riverY = Math.floor(4.5 * GRID_SIZE);
        ctx.fillText("楚 河", Math.floor(2 * GRID_SIZE), riverY);
        ctx.fillText("漢 界", Math.floor(6 * GRID_SIZE), riverY);

        // D. 棋子
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = board[r][c];
                if (p) {
                    const x = Math.floor(c * GRID_SIZE);
                    const y = Math.floor(r * GRID_SIZE);
                    const radius = Math.floor(GRID_SIZE * 0.45);

                    ctx.save();
                    ctx.shadowColor = "rgba(0,0,0,0.3)";
                    ctx.shadowBlur = 4;
                    ctx.shadowOffsetY = 2;
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);

                    if (p.color === 'red') {
                        ctx.fillStyle = '#fdfdfd';
                        ctx.strokeStyle = '#a61c1c';
                    } else {
                        const gradP = ctx.createRadialGradient(x - 3, y - 3, 2, x, y, radius);
                        gradP.addColorStop(0, '#2563eb');
                        gradP.addColorStop(1, '#1e3a8a');
                        ctx.fillStyle = gradP;
                        ctx.strokeStyle = '#000000';
                    }
                    ctx.fill();
                    ctx.shadowColor = "transparent";
                    ctx.lineWidth = 2.5;
                    ctx.stroke();

                    if (p.color === 'red') {
                        ctx.beginPath();
                        ctx.arc(x, y, radius - 4, 0, Math.PI * 2);
                        ctx.lineWidth = 1;
                        ctx.strokeStyle = '#e5e5e5';
                        ctx.stroke();
                        ctx.fillStyle = '#a61c1c';
                    } else {
                        ctx.fillStyle = '#ffffff';
                    }

                    const fontSize = Math.floor(GRID_SIZE * 0.65);
                    ctx.font = `bold ${fontSize}px "KaiTi", serif`;
                    ctx.textBaseline = 'middle';
                    // 修正：稍微增加偏移量 (0.01 -> 0.05) 以確保文字視覺置中
                    ctx.fillText(p.text, x, y + Math.floor(GRID_SIZE * 0.05));
                    ctx.restore();
                }
            }
        }
        ctx.restore();
    };

    const startIdx = Math.max(0, config.startRound);
    const endIdx = Math.min(activePath.length - 1, config.endRound);
    const totalFrames = endIdx - startIdx + 1;

    for (let i = startIdx; i <= endIdx; i++) {
        const node = activePath[i];
        const pct = Math.round(((i - startIdx) / totalFrames) * 90);
        onProgress(pct, `正在處理第 ${i} 回合影格...`);

        // 每次渲染前清空畫布
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, ACTUAL_WIDTH, TOTAL_HEIGHT);
        drawBoard(node.boardState);

        const delay = (i === endIdx) ? 3000 : config.interval * 1000;

        // 使用傳遞畫布對象並開啟複製模式
        gif.addFrame(canvas, { copy: true, delay });

        await new Promise(r => setTimeout(r, 0));
    }

    onProgress(95, "正在進行最後編碼 (請稍候)...");

    return new Promise((resolve, reject) => {
        gif.on('finished', (blob: Blob) => {
            // Clean up the object URL
            URL.revokeObjectURL(workerScriptUrl);
            onProgress(100, "匯出完成！");
            resolve(blob);
        });
        gif.on('abort', () => {
            URL.revokeObjectURL(workerScriptUrl);
            reject("匯出被中止");
        });
        gif.render();
    });
};
