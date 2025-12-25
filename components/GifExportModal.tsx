
import React, { useState, useEffect } from 'react';
import { X, Film, Download, Check, Settings2, Image } from 'lucide-react';
import { MoveNode, GameMetadata } from '../types';
import { generateGif } from '../lib/gifGenerator';

interface GifExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    activePath: MoveNode[]; 
    rootNode: MoveNode;
    metadata: GameMetadata;
}

const GifExportModal: React.FC<GifExportModalProps> = ({ isOpen, onClose, activePath, rootNode, metadata }) => {
    const totalMoves = activePath.length - 1; 
    
    const [startRound, setStartRound] = useState(0);
    const [endRound, setEndRound] = useState(totalMoves);
    const [interval, setInterval] = useState(1.0);
    const [quality, setQuality] = useState(5); 
    const [width, setWidth] = useState(480);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [resultBlob, setResultBlob] = useState<Blob | null>(null);

    useEffect(() => {
        if (isOpen) {
            setEndRound(activePath.length - 1);
            setStartRound(0);
            setResultBlob(null);
            setProgress(0);
            setIsProcessing(false);
        }
    }, [isOpen, activePath.length]);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (startRound > endRound) {
            alert("結束回合必須大於開始回合");
            return;
        }

        setIsProcessing(true);
        setResultBlob(null);
        
        try {
            const blob = await generateGif(
                rootNode,
                activePath,
                metadata,
                {
                    startRound,
                    endRound,
                    interval,
                    quality,
                    width
                },
                (pct, text) => {
                    setProgress(pct);
                    setStatusText(text);
                }
            );
            setResultBlob(blob);
        } catch (e) {
            console.error(e);
            setStatusText("生成失敗，請重試");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!resultBlob) return;
        const url = URL.createObjectURL(resultBlob);
        const a = document.createElement('a');
        a.href = url;
        const filename = (metadata.title || 'chess_game').replace(/\s+/g, '_') + '.gif';
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onClose();
    };

    const qualityOptions = [
        { label: '高畫質 (慢)', val: 1 },
        { label: '標準', val: 5 },
        { label: '低畫質 (快)', val: 10 },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md mx-4 flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Film className="text-pink-500" /> 匯出動態 GIF
                    </h2>
                    {!isProcessing && (
                        <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    {!resultBlob && !isProcessing ? (
                        <>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm font-bold text-zinc-400">
                                    <span>回合範圍</span>
                                    <span className="text-pink-400">{startRound} - {endRound}</span>
                                </div>
                                <div className="flex gap-4 items-center">
                                    <input 
                                        type="number" min="0" max={endRound} 
                                        value={startRound}
                                        onChange={(e) => setStartRound(Math.min(parseInt(e.target.value) || 0, endRound))}
                                        className="w-16 bg-zinc-950 border border-zinc-700 rounded p-1 text-center text-sm"
                                    />
                                    <div className="flex-1 relative h-2 bg-zinc-800 rounded-full">
                                        <div 
                                            className="absolute h-full bg-pink-600/50 rounded-full"
                                            style={{
                                                left: `${(startRound / totalMoves) * 100}%`,
                                                width: `${((endRound - startRound) / totalMoves) * 100}%`
                                            }}
                                        ></div>
                                    </div>
                                    <input 
                                        type="number" min={startRound} max={totalMoves} 
                                        value={endRound}
                                        onChange={(e) => setEndRound(Math.min(parseInt(e.target.value) || 0, totalMoves))}
                                        className="w-16 bg-zinc-950 border border-zinc-700 rounded p-1 text-center text-sm"
                                    />
                                </div>
                            </div>
                            <hr className="border-zinc-800" />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 flex items-center gap-1">
                                        <Settings2 size={12} /> 播放速度 (每步秒數)
                                    </label>
                                    <select 
                                        value={interval.toString()} 
                                        onChange={(e) => setInterval(parseFloat(e.target.value))}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 cursor-pointer"
                                    >
                                        <option value="0.5">0.5 秒 (極快)</option>
                                        <option value="1">1.0 秒 (標準)</option>
                                        <option value="1.5">1.5 秒 (舒適)</option>
                                        <option value="2">2.0 秒 (慢速)</option>
                                        <option value="3">3.0 秒 (教學)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-zinc-500 flex items-center gap-1">
                                        <Image size={12} /> 圖片畫質
                                    </label>
                                    <select 
                                        value={quality} 
                                        onChange={(e) => setQuality(parseInt(e.target.value))}
                                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-200 cursor-pointer"
                                    >
                                        {qualityOptions.map(q => <option key={q.val} value={q.val}>{q.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-zinc-800/50 rounded-lg text-xs text-zinc-400 border border-zinc-800">
                                <Check size={14} className="text-green-500" />
                                <span>將自動在圖片頂部疊加標題與棋手資訊</span>
                            </div>
                        </>
                    ) : isProcessing ? (
                        <div className="py-8 flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-zinc-800 border-t-pink-500 rounded-full animate-spin"></div>
                            <div className="space-y-1 text-center">
                                <div className="text-lg font-bold text-white">{Math.round(progress)}%</div>
                                <div className="text-sm text-zinc-500">{statusText}</div>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-4">
                                <div className="h-full bg-pink-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-6 flex flex-col items-center gap-4 text-center animate-in zoom-in-95">
                            <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-2">
                                <Check size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">GIF 生成完成！</h3>
                                <p className="text-sm text-zinc-500 mt-1">檔案已準備好下載</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
                    {!isProcessing && !resultBlob && (
                        <>
                            <button onClick={onClose} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-medium text-sm transition-colors">取消</button>
                            <button 
                                onClick={handleGenerate}
                                className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded font-bold text-sm shadow-lg shadow-pink-900/20 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Film size={16} /> 開始生成
                            </button>
                        </>
                    )}
                    
                    {resultBlob && (
                        <>
                            <button onClick={() => setResultBlob(null)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-medium text-sm transition-colors">重新設定</button>
                            <button 
                                onClick={handleDownload}
                                className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded font-bold text-sm shadow-lg transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Download size={16} /> 下載 GIF
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GifExportModal;
