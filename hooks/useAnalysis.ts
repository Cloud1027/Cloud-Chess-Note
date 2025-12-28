
import { useState, useRef, useEffect, useCallback } from 'react';
import { MoveNode, AnalysisResult } from '../types';
import { fetchCloudBookData, ucciToCoords, getChineseNotation } from '../lib/utils';
import { LocalEngine } from '../lib/engine';

export const useAnalysis = (
    movePath: MoveNode[],
    onJumpToStep: (index: number) => void,
    onBatchUpdateComments: (updates: { id: string, text: string }[]) => void,
    onClose: () => void
) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisMode, setAnalysisMode] = useState<'cloud' | 'local'>('cloud');
    const [localDepth, setLocalDepth] = useState(15);
    const [results, setResults] = useState<AnalysisResult[]>([]);
    const [progress, setProgress] = useState(0);
    const [currentStepInfo, setCurrentStepInfo] = useState('');
    const [currentAnalyzingNodeId, setCurrentAnalyzingNodeId] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const stopLocalRef = useRef(false);

    // Initial Progress Set
    useEffect(() => {
        if (results.length > 0 && !isAnalyzing) {
            setProgress(100);
        }
    }, [results.length]); // eslint-disable-line

    const calculateResult = (
        currentNode: MoveNode,
        nextNode: MoveNode,
        playedMove: { score: number } | null | undefined,
        bestMove: { move: string, score: number } | null | undefined,
        moveIndex: number,
        isRedTurn: boolean
    ): AnalysisResult => {
        let deviation = 0;
        let finalScore = null;
        let bestMoveNotation = "";

        // Notation for Best Move
        if (bestMove) {
            const bestCoords = ucciToCoords(bestMove.move);
            if (bestCoords) {
                const piece = currentNode.boardState[bestCoords.from.r][bestCoords.from.c];
                const target = currentNode.boardState[bestCoords.to.r][bestCoords.to.c];
                if (piece) {
                    bestMoveNotation = getChineseNotation(currentNode.boardState, { from: bestCoords.from, to: bestCoords.to, piece, captured: target });
                } else {
                    bestMoveNotation = bestMove.move;
                }
            }
        }

        const bestScoreVal = bestMove?.score || 0;

        if (playedMove) {
            const rawScore = playedMove.score;
            finalScore = rawScore;
            // Cloud usually returns side-relative Score? 
            // If so, deviation = abs(best - played)
            deviation = Math.abs(bestScoreVal - rawScore);
        } else if (bestMove) {
            deviation = 200; // Penalty
            const penalty = isRedTurn ? -200 : 200;
            finalScore = bestScoreVal + penalty;
        }

        let quality: AnalysisResult['quality'] = 'good';
        if (deviation >= 251) quality = 'blunder';      // 錯著: 251+
        else if (deviation >= 151) quality = 'mistake'; // 失著: 151-250
        else if (deviation >= 51) quality = 'inaccuracy'; // 緩著: 51-150

        return {
            nodeId: nextNode.id,
            moveIndex: moveIndex,
            moveNotation: nextNode.move?.notation || "未知",
            fen: currentNode.fen,
            score: finalScore,
            deviation,
            isRedTurn: isRedTurn,
            bestMove: bestMoveNotation,
            bestScore: bestScoreVal,
            quality
        };
    };

    const startCloudAnalysis = async () => {
        setIsAnalyzing(true);
        setAnalysisMode('cloud');
        setResults([]);
        setProgress(0);
        abortControllerRef.current = new AbortController();

        const newResults: AnalysisResult[] = [];
        const totalSteps = movePath.length - 1;

        for (let i = 0; i < totalSteps; i++) {
            if (abortControllerRef.current.signal.aborted) break;

            const currentNode = movePath[i];
            const nextNode = movePath[i + 1];
            setCurrentAnalyzingNodeId(nextNode.id);

            setCurrentStepInfo(`正在查詢第 ${i + 1} 回合...`);
            const cloudMoves = await fetchCloudBookData(currentNode.fen);

            let actualMoveUcci = '';
            if (nextNode.move) {
                const f = nextNode.move.from;
                const t = nextNode.move.to;
                // Simple file mapping
                const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
                actualMoveUcci = `${files[f.c]}${9 - f.r}${files[t.c]}${9 - t.r}`;
            }

            const playedCloudMove = cloudMoves.find(m => m.move === actualMoveUcci);
            const bestCloudMove = cloudMoves.length > 0 ? cloudMoves[0] : null;

            // [FIX Iter 8] Derive Turn from FEN (Most Reliable).
            // currentNode.turn might be unreliable if not populated correctly.
            // FEN: "rnbakabnr/9/1c5c1/... w - - 0 1" -> 'w' is Red, 'b' is Black.
            const fen = currentNode.fen;
            const fenParts = fen.split(' ');
            const activeColor = fenParts.length > 1 ? fenParts[1] : 'w';
            const isRedTurn = activeColor === 'w' || activeColor === 'r';

            let playedScore = playedCloudMove ? playedCloudMove.score : null;
            let bestScore = bestCloudMove ? bestCloudMove.score : null;

            if (!isRedTurn) {
                if (playedScore !== null) playedScore *= -1;
                if (bestScore !== null) bestScore *= -1;
            }

            // Create Shadow Objects
            const playedMoveFixed = playedCloudMove ? { ...playedCloudMove, score: playedScore } : undefined;
            const bestMoveFixed = bestCloudMove ? { ...bestCloudMove, score: bestScore } : undefined;

            const resultItem = calculateResult(
                currentNode,
                nextNode,
                playedMoveFixed as any,
                bestMoveFixed as any,
                i + 1,
                isRedTurn
            );

            newResults.push(resultItem);
            setResults([...newResults]);
            setProgress(((i + 1) / totalSteps) * 100);

            await new Promise(r => setTimeout(r, 100));
        }

        setIsAnalyzing(false);
        setCurrentStepInfo('');
    };

    const startLocalAnalysis = async (overrideDepth?: number) => {
        const engine = LocalEngine.getInstance();
        try {
            await engine.init();
        } catch (e) {
            alert("引擎載入失敗");
            return;
        }

        setIsAnalyzing(true);
        setAnalysisMode('local');
        setResults([]);
        setProgress(0);
        stopLocalRef.current = false;

        const newResults: AnalysisResult[] = [];
        const totalSteps = movePath.length - 1;

        // Cache for evaluations (Red perspective)
        const evals: number[] = [];
        const bestMoves: string[] = [];

        const currentDepth = overrideDepth || localDepth;

        try {
            setCurrentStepInfo(`正在評估初始局面...`);
            const initStats = await engine.analyzeFixedDepth(movePath[0].fen, currentDepth);
            evals[0] = (movePath[0].turn === 'red') ? initStats.score : -initStats.score;
            bestMoves[0] = initStats.bestMove || '';

            for (let i = 0; i < totalSteps; i++) {
                if (stopLocalRef.current) break;

                const currentNode = movePath[i];
                const nextNode = movePath[i + 1];

                setCurrentStepInfo(`正在分析第 ${i + 1} 手...`);
                setCurrentAnalyzingNodeId(nextNode.id);
                // Wait for Engine
                // We need to ensure sequential execution. 
                // analyzeFixedDepth is promise based.
                const stats = await engine.analyzeFixedDepth(nextNode.fen, currentDepth);

                const isRedTurnAfter = nextNode.turn === 'red';
                const redPerspectiveScore = isRedTurnAfter ? stats.score : -stats.score;
                evals[i + 1] = redPerspectiveScore;
                bestMoves[i + 1] = stats.bestMove || '';

                const prevRedScore = evals[i];
                const currentRedScore = evals[i + 1];
                const isRedSide = currentNode.turn === 'red';

                // Deviation: Loss for the side that moved
                let deviation = isRedSide ? (prevRedScore - currentRedScore) : (currentRedScore - prevRedScore);

                const ucciMove = nextNode.move ? (() => {
                    const f = nextNode.move.from;
                    const t = nextNode.move.to;
                    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
                    return `${files[f.c]}${9 - f.r}${files[t.c]}${9 - t.r}`;
                })() : "";

                // Best Move UCCI
                const bestMoveUcci = bestMoves[i]; // Logic mismatch in original code? 
                // Original used bestMoves[i] which represents best move FROM previous position (currentNode). Correct.

                if (ucciMove === bestMoveUcci.trim().toLowerCase()) {
                    deviation = 0;
                }
                deviation = Math.max(0, deviation);

                let quality: AnalysisResult['quality'] = 'good';
                if (deviation > 500) quality = 'blunder';
                else if (deviation > 200) quality = 'mistake';
                else if (deviation > 50) quality = 'inaccuracy';

                // Notation
                let bestMoveNotation = "";
                const bestCoords = ucciToCoords(bestMoveUcci);
                if (bestCoords) {
                    const piece = currentNode.boardState[bestCoords.from.r][bestCoords.from.c];
                    const target = currentNode.boardState[bestCoords.to.r][bestCoords.to.c];
                    if (piece) bestMoveNotation = getChineseNotation(currentNode.boardState, { from: bestCoords.from, to: bestCoords.to, piece, captured: target });
                }

                const resultItem: AnalysisResult = {
                    nodeId: nextNode.id,
                    moveIndex: i + 1,
                    moveNotation: nextNode.move?.notation || "未知",
                    fen: currentNode.fen,
                    score: currentRedScore,
                    deviation,
                    isRedTurn: isRedSide,
                    bestMove: bestMoveNotation || bestMoveUcci,
                    bestScore: prevRedScore,
                    quality
                };

                newResults.push(resultItem);
                setResults([...newResults]);
                setProgress(((i + 1) / totalSteps) * 100);
            }
        } catch (err) {
            console.error(err);
        }

        engine.stopAnalysis();
        setIsAnalyzing(false);
        setCurrentStepInfo('');
    };

    const stopAnalysis = () => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        stopLocalRef.current = true;
        setIsAnalyzing(false);
    };

    const writeAnnotations = () => {
        if (results.length === 0) return;
        const updates: { id: string, text: string }[] = [];
        results.forEach(res => {
            if (res.quality !== 'good') {
                const node = movePath.find(n => n.id === res.nodeId);
                if (!node) return;
                let label = '';
                if (res.quality === 'blunder') label = '錯著';
                else if (res.quality === 'mistake') label = '失著';
                else if (res.quality === 'inaccuracy') label = '緩著';
                const note = `【${label}】\n評分: ${res.score}\n偏差: ${res.deviation}\n推薦: ${res.bestMove} (${res.bestScore})`;
                let newComment = node.comment || "";
                if (!newComment.includes(`評分: ${res.score}`)) {
                    if (newComment.trim().length > 0) newComment += "\n" + note;
                    else newComment = note;
                    updates.push({ id: res.nodeId, text: newComment });
                }
            }
        });
        onBatchUpdateComments(updates);
        alert(`已將 ${updates.length} 條分析註釋寫入棋譜。`);
        onClose();
    };

    return {
        isAnalyzing,
        analysisMode,
        localDepth,
        setLocalDepth,
        results,
        setResults,
        progress,
        currentStepInfo,
        startCloudAnalysis,
        startLocalAnalysis,
        stopAnalysis,
        writeAnnotations,
        onJumpToStep,
        setAnalysisMode,
        currentAnalyzingNodeId
    };
};
