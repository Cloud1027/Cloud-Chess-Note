
import React, { useState, useEffect } from 'react';
import { X, Copy, Download, Check } from 'lucide-react';
import { MoveNode, GameMetadata } from '../types';
import { Exporter } from '../lib/exporter';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    rootNode: MoveNode;
    metadata: GameMetadata;
}

type ExportFormat = 'DhtmlXQ' | 'Text' | 'FenMove' | 'PGN';

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, rootNode, metadata }) => {
    const [format, setFormat] = useState<ExportFormat>('DhtmlXQ');
    const [content, setContent] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        let generated = '';
        try {
            switch (format) {
                case 'DhtmlXQ': generated = Exporter.generateDhtmlXQ(rootNode, metadata); break;
                case 'Text': generated = Exporter.generateText(rootNode, metadata); break;
                case 'FenMove': generated = Exporter.generateFenMove(rootNode); break;
                case 'PGN': generated = Exporter.generatePGN(rootNode, metadata); break;
            }
        } catch (e) {
            console.error("Export generation failed:", e);
            generated = "Error generating export.";
        }
        setContent(generated);
        setCopied(false);
    }, [isOpen, format, rootNode, metadata]);

    if (!isOpen) return null;

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = (metadata.title || 'chess_game').replace(/\s+/g, '_');
        a.download = `${filename}.pgn`; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <UploadIcon className="text-blue-500" /> 分享棋譜
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-zinc-400">當前局面 FEN</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                readOnly 
                                value={rootNode.fen} 
                                className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-300 focus:outline-none"
                            />
                            <button 
                                onClick={() => handleCopy(rootNode.fen)}
                                className="px-3 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center justify-center"
                            >
                                <Copy size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-zinc-800 my-2"></div>

                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-zinc-400">導出格式</label>
                        <div className="relative">
                            <select 
                                value={format}
                                onChange={(e) => setFormat(e.target.value as ExportFormat)}
                                className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-40 p-2 appearance-none cursor-pointer"
                            >
                                <option value="DhtmlXQ">東萍UBB</option>
                                <option value="Text">文本TXT</option>
                                <option value="FenMove">Fen&Move</option>
                                <option value="PGN">PGN</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative group">
                        <textarea 
                            readOnly
                            value={content}
                            className="w-full h-48 bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:outline-none resize-none custom-scrollbar"
                        />
                        <button 
                            onClick={() => handleCopy(content)}
                            className="absolute top-2 right-2 p-2 bg-zinc-800 hover:bg-blue-600 text-zinc-400 hover:text-white rounded border border-zinc-700 transition-colors shadow-lg"
                            title="複製內容"
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                    </div>

                    {format === 'PGN' && (
                        <div className="flex justify-center">
                            <button 
                                onClick={handleDownload}
                                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <Download size={18} /> 下載 PGN 檔案
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const UploadIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path>
        <path d="M12 12v9"></path>
        <path d="m16 16-4-4-4 4"></path>
    </svg>
);

export default ExportModal;
