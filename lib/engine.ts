
import { Point, AnalysisResult, Piece } from '../types';
import { ucciToCoords, getChineseNotation } from './utils';

export interface EngineStats {
    depth: number;
    score: number;
    mate: number | null; // moves to mate
    nodes: number;
    nps: number;
    time: number;
    pv: string[]; // ucci strings
    bestMove?: string;
}

type EngineCallback = (stats: EngineStats) => void;

// Helper function to get the correct base path for engine files
function getEngineBasePath(): string {
    // For GitHub Pages deployment, we need to account for the repository name in the path
    const pathname = window.location.pathname;

    // Check if we're on GitHub Pages (path contains /Cloud-Chess-Note/)
    if (pathname.includes('/Cloud-Chess-Note/')) {
        // In Vite production build, public/ folder contents are moved to dist root
        // So the path is /Cloud-Chess-Note/engine/ not /Cloud-Chess-Note/public/engine/
        return '/Cloud-Chess-Note/engine/';
    }

    // For local development or production build
    return '/engine/';
}

export class LocalEngine {
    private static instance: LocalEngine;
    private stockfish: any = null;
    private isReady: boolean = false;
    private isAnalyzing: boolean = false;
    private onInfoCallback: EngineCallback | null = null;
    private engineBasePath: string;
    private messageListeners: Set<(line: string) => void> = new Set();

    private isSingleCore: boolean = false;

    private constructor() {
        this.engineBasePath = getEngineBasePath();
    }

    public static getInstance(): LocalEngine {
        if (!LocalEngine.instance) {
            LocalEngine.instance = new LocalEngine();
        }
        return LocalEngine.instance;
    }

    public async init(threadCount: number = 4): Promise<void> {
        if (this.isReady) return;

        // Cache Buster (Static version to allow caching but break old versions)
        const TIMESTAMP = 'v1.3_manual_threads';

        // Determine mode based on user setting
        const targetThreads = threadCount || 4;
        const isSingleCoreMode = targetThreads === 1;

        // Determine engine script based on mode
        const engineScript = isSingleCoreMode ? 'pikafish-single.js' : 'pikafish.js';

        console.log(`Engine Init: Target Threads = ${targetThreads} (Mode: ${isSingleCoreMode ? 'Single Core' : 'Multi Core'})`);
        console.log(`Engine Script: ${engineScript}`);

        // Diagnostic Checks
        if (!isSingleCoreMode) {
            // Multi-core requires strict isolation checks
            if (!window.crossOriginIsolated) {
                console.error("CRITICAL: Page is NOT crossOriginIsolated. Multi-threaded WASM will fail.");
                alert("引擎啟動失敗：環境安全性不足 (Missing Cross-Origin Isolation)。\n\n解決方案：\n請至「系統設定」將「引擎核心數」設為 1，即可在目前環境使用。");
                return Promise.reject("Missing Cross-Origin Isolation");
            }
            if (typeof SharedArrayBuffer === 'undefined') {
                console.error("CRITICAL: SharedArrayBuffer is undefined.");
                alert("引擎啟動失敗：瀏覽器不支援 SharedArrayBuffer。\n\n解決方案：\n請至「系統設定」將「引擎核心數」設為 1。");
                return Promise.reject("Missing SharedArrayBuffer");
            }
        } else {
            // Single-core mode: We warn but proceed. 
            // Note: Standard pikafish.js might still crash if it forcibly parses SAB, but user asked to Try.
            if (!window.crossOriginIsolated) {
                console.warn("Running in Single Core mode allows bypassing Cross-Origin Isolation check.");
            }
        }

        console.log("Engine Base Path:", this.engineBasePath);
        // Force fresh load of NNUE
        const nnuePath = this.engineBasePath + 'pikafish.nnue?v=' + TIMESTAMP;

        try {
            console.log("Checking NNUE availability at:", nnuePath);
            const response = await fetch(nnuePath, { method: 'HEAD' });
            if (!response.ok) {
                // If 404, maybe it's local dev or path issue?
                console.warn(`NNUE HEAD check failed (${response.status}). Attempting to load script anyway...`);
            } else {
                console.log("NNUE file found/accessible.");
            }
        } catch (e: any) {
            console.error("NNUE Fetch Error (Soft Fail):", e);
        }

        return new Promise((resolve, reject) => {
            // Pikafish.js uses Module.onReceiveStdout for output
            // and Module.sendCommand for input (set up after loading)
            // @ts-ignore
            window.Module = {
                locateFile: (path: string, prefix: string) => {
                    console.log('locateFile called:', path, 'prefix:', prefix);

                    // If single core binary asks for pikafish-single.wasm, we serve it.
                    return this.engineBasePath + path + '?v=' + TIMESTAMP;
                },
                onReceiveStdout: (line: string) => {
                    console.log('Engine:', line);
                    this.parseEngineOutput(line, targetThreads);
                },
                onReceiveStderr: (line: string) => {
                    console.warn('Engine Err:', line);
                },
                onExit: (code: number) => {
                    console.log('Engine exited with code', code);
                }
            };

            const script = document.createElement('script');
            script.src = this.engineBasePath + engineScript + '?v=' + TIMESTAMP;
            script.async = true;

            script.onload = async () => {
                try {
                    // Wait for Pikafish to be ready (it's a factory function)
                    // @ts-ignore
                    if (typeof Pikafish === 'function') {
                        // Pass config to factory function - this is where locateFile must be set
                        // @ts-ignore
                        this.stockfish = await Pikafish({
                            locateFile: (path: string) => {
                                console.log('Pikafish locateFile:', path);
                                return this.engineBasePath + path + '?v=' + TIMESTAMP;
                            },
                            onReceiveStdout: (line: string) => {
                                console.log('Engine:', line);
                                this.parseEngineOutput(line, targetThreads);
                                this.messageListeners.forEach(l => l(line));
                            },
                            onReceiveStderr: (line: string) => {
                                console.warn('Engine Err:', line);
                            }
                        });
                        console.log('Pikafish module loaded');

                        // Send UCI command to initialize
                        this.sendCommand('uci');
                        this.isReady = true;
                        resolve();
                    } else {
                        reject(new Error('Pikafish function not found'));
                    }
                } catch (e) {
                    console.error("Engine Init Failed", e);
                    const msg = isSingleCoreMode
                        ? `單核引擎啟動失敗 (使用檔案: ${engineScript})：\n${e}\n\n可能原因：檔案不支援或損壞。`
                        : `引擎啟動失敗 (使用檔案: ${engineScript})：\n${e}`;
                    alert(msg);
                    reject(e);
                }
            };
            script.onerror = (e) => {
                const msg = isSingleCoreMode
                    ? `單核心引擎載入失敗 (${engineScript})。\n\n請確保您已上傳單核心版本並命名為 '${engineScript}'。`
                    : `引擎載入失敗 (${engineScript})。` + e;
                alert(msg);
                reject(new Error('Failed to load engine script: ' + e));
            };
            document.body.appendChild(script);
        });
    }

    private sendCommand(cmd: string) {
        if (this.stockfish) {
            if (this.stockfish.sendCommand) {
                this.stockfish.sendCommand(cmd);
            } else if (this.stockfish.postMessage) {
                this.stockfish.postMessage(cmd);
            } else {
                console.warn("Engine postMessage/sendCommand not available");
            }
        }
    }

    private parseEngineOutput(line: string, targetThreads: number = 4) {
        // Example: info depth 10 seldepth 15 score cp 25 nodes 1000 nps 500000 pv h2e2 h9g7
        if (line === 'uciok') {
            console.log(`UCI ok - Configuring for ${targetThreads} threads.`);
            this.sendCommand(`setoption name Threads value ${targetThreads}`);
            // Adjust Hash based on threads/device power assumption
            const hashSize = targetThreads === 1 ? 16 : 64;
            this.sendCommand(`setoption name Hash value ${hashSize}`);
            // Explicitly point to the NNUE file loaded by the JS wrapper
            // this.sendCommand('setoption name EvalFile value pikafish.nnue');
        }

        if (line.startsWith('info') && line.includes('depth') && line.includes('score')) {
            const stats = this.parseInfo(line);
            if (this.onInfoCallback) this.onInfoCallback(stats);
        }
        if (line.startsWith('bestmove')) {
            // Analysis finished for fixed depth/time
        }
    }

    private parseInfo(line: string): EngineStats {
        const parts = line.split(' ');

        const getVal = (key: string) => {
            const idx = parts.indexOf(key);
            return idx !== -1 && idx + 1 < parts.length ? parts[idx + 1] : null;
        };

        // Parse Score
        let score = 0;
        let mate = null;
        const scoreType = getVal('score'); // cp or mate
        const scoreVal = parseInt(parts[parts.indexOf('score') + 2] || '0');

        if (scoreType === 'mate') {
            mate = scoreVal;
            score = scoreVal > 0 ? 9999 : -9999;
        } else {
            score = scoreVal;
        }

        // Parse PV
        const pvIdx = parts.indexOf('pv');
        const pv = pvIdx !== -1 ? parts.slice(pvIdx + 1) : [];

        return {
            depth: parseInt(getVal('depth') || '0'),
            score: score,
            mate: mate,
            nodes: parseInt(getVal('nodes') || '0'),
            nps: parseInt(getVal('nps') || '0'),
            time: parseInt(getVal('time') || '0'),
            pv: pv,
            bestMove: pv[0]
        };
    }

    public startAnalysis(fen: string, callback: EngineCallback) {
        if (!this.isReady) return;
        this.stopAnalysis(); // Stop previous
        this.onInfoCallback = callback;
        this.isAnalyzing = true;
        this.sendCommand(`position fen ${fen}`);
        this.sendCommand('go infinite');
    }

    public analyzeFixedDepth(fen: string, depth: number): Promise<EngineStats> {
        if (!this.isReady) return Promise.reject("Engine not ready");
        this.stopAnalysis();

        return new Promise((resolve) => {
            let lastStats: EngineStats | null = null;

            const listener = (line: string) => {
                if (line.startsWith('info') && line.includes('depth') && line.includes('score')) {
                    lastStats = this.parseInfo(line);
                }
                if (line.startsWith('bestmove')) {
                    this.messageListeners.delete(listener);
                    const parts = line.split(/\s+/);
                    const bestMove = parts[1]?.trim();
                    const result = lastStats || {
                        depth: 0, score: 0, mate: null, nodes: 0, nps: 0, time: 0, pv: bestMove ? [bestMove] : [], bestMove: bestMove
                    };
                    resolve(result);
                }
            };

            this.messageListeners.add(listener);
            this.sendCommand(`position fen ${fen}`);
            this.sendCommand(`go depth ${depth}`);
        });
    }

    public stopAnalysis() {
        if (this.isAnalyzing) {
            this.sendCommand('stop');
            this.isAnalyzing = false;
            this.onInfoCallback = null;
        }
    }
}
