
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

export class LocalEngine {
    private static instance: LocalEngine;
    private stockfish: any = null;
    private isReady: boolean = false;
    private isAnalyzing: boolean = false;
    private onInfoCallback: EngineCallback | null = null;
    private nnueLoaded: boolean = false;

    private constructor() {}

    public static getInstance(): LocalEngine {
        if (!LocalEngine.instance) {
            LocalEngine.instance = new LocalEngine();
        }
        return LocalEngine.instance;
    }

    public async init(): Promise<void> {
        if (this.isReady) return;

        return new Promise((resolve, reject) => {
            // Dynamically load the script
            const script = document.createElement('script');
            script.src = '/engine/stockfish.js';
            script.async = true;
            
            script.onload = async () => {
                try {
                    // @ts-ignore
                    const SF = window.Stockfish;
                    if (!SF) throw new Error("Stockfish failed to load");

                    this.stockfish = await SF();
                    
                    // Hook into output
                    this.stockfish.addMessageListener((line: string) => {
                        this.parseLine(line);
                    });

                    // Load NNUE
                    await this.loadNNUE();

                    this.postMessage('uci');
                    this.isReady = true;
                    resolve();
                } catch (e) {
                    console.error("Engine Init Failed", e);
                    reject(e);
                }
            };
            script.onerror = (e) => reject(e);
            document.body.appendChild(script);
        });
    }

    private async loadNNUE() {
        if (this.nnueLoaded) return;
        try {
            const response = await fetch('/engine/pikafish.nnue');
            if (!response.ok) throw new Error("NNUE file not found");
            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            
            // Write to virtual filesystem provided by Emscripten
            const fileName = 'pikafish.nnue';
            this.stockfish.FS.writeFile('/' + fileName, data);
            
            this.postMessage(`setoption name EvalFile value /${fileName}`);
            // Enable NNUE usage usually implies turning it on if not default, 
            // but Pikafish usually defaults to it if EvalFile is set.
            // Also enable multi-threading if possible (safely use 1 or 2 for web)
            this.postMessage('setoption name Threads value 4'); 
            this.postMessage('setoption name Hash value 64');
            
            this.nnueLoaded = true;
            console.log("NNUE Loaded Successfully");
        } catch (e) {
            console.warn("Failed to load NNUE, engine might be weak", e);
        }
    }

    private postMessage(cmd: string) {
        if (this.stockfish) {
            this.stockfish.postMessage(cmd);
        }
    }

    private parseLine(line: string) {
        // Example: info depth 10 seldepth 15 score cp 25 nodes 1000 nps 500000 pv h2e2 h9g7
        if (line.startsWith('info') && line.includes('depth') && line.includes('score')) {
            const stats = this.parseInfo(line);
            if (this.onInfoCallback) this.onInfoCallback(stats);
        }
        if (line.startsWith('bestmove')) {
            // Analysis finished for fixed depth/time
            // Format: bestmove h2e2 ponder h9g7
            const parts = line.split(' ');
            const best = parts[1];
            if (this.onInfoCallback) {
                // We don't get stats in bestmove line, but we signal completion implicitly?
                // For now, we rely on the last info line for stats.
            }
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
        this.postMessage(`position fen ${fen}`);
        this.postMessage('go infinite');
    }

    public analyzeFixedDepth(fen: string, depth: number): Promise<EngineStats> {
        if (!this.isReady) return Promise.reject("Engine not ready");
        this.stopAnalysis();
        
        return new Promise((resolve) => {
            let lastStats: EngineStats | null = null;
            
            // Temporary listener for this specific task
            const listener = (line: string) => {
                if (line.startsWith('info') && line.includes('depth') && line.includes('score')) {
                    const stats = this.parseInfo(line);
                    // Check if lowerbound/upperbound to avoid noise, but for simplicity keep latest
                    lastStats = stats;
                }
                if (line.startsWith('bestmove')) {
                    this.stockfish.removeMessageListener(listener);
                    // Return the last collected stats, or a minimal object if fast move
                    const result = lastStats || {
                        depth: 0, score: 0, mate: null, nodes: 0, nps: 0, time: 0, pv: [line.split(' ')[1]]
                    };
                    resolve(result);
                }
            };

            this.stockfish.addMessageListener(listener);
            this.postMessage(`position fen ${fen}`);
            this.postMessage(`go depth ${depth}`);
        });
    }

    public stopAnalysis() {
        if (this.isAnalyzing) {
            this.postMessage('stop');
            this.isAnalyzing = false;
            this.onInfoCallback = null;
        }
    }
}
