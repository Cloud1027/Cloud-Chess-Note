
import React, { useState, useRef, DragEvent } from 'react';
import { X, Upload, FileText, AlertTriangle } from 'lucide-react';
import { Importer } from '../lib/importer';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (data: any) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const [dragActive, setDragActive] = useState(false);
    const [inputText, setInputText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleDrag = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (text) {
                try {
                    const parsed = Importer.parseInput(text);
                    if (parsed.moves.length === 0 && !parsed.fen) throw new Error("無效的棋譜內容");
                    onImport(parsed);
                    onClose();
                } catch (err) {
                    setError("解析失敗：格式不支援或檔案損毀");
                }
            }
        };
        reader.readAsText(file);
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const handleTextImport = () => {
        if (!inputText.trim()) return;
        try {
            const parsed = Importer.parseInput(inputText);
            if (parsed.moves.length === 0 && !parsed.fen) throw new Error("無效的棋譜內容");
            onImport(parsed);
            onClose();
        } catch (err) {
            setError("解析失敗：請檢查文字格式");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">導入棋譜</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="text-sm text-zinc-400 mb-2">
                        支援格式：PGN (中文/ICCS/WXF), 東萍 DhtmlXQ (含變招)
                    </div>

                    <div 
                        className={`
                            relative h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all
                            ${dragActive ? 'border-amber-500 bg-amber-900/10' : 'border-zinc-700 bg-zinc-950/50 hover:bg-zinc-900 hover:border-zinc-500'}
                        `}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <Upload size={32} className={dragActive ? 'text-amber-500' : 'text-zinc-500'} />
                        <div className="text-center">
                            <p className="text-sm font-medium text-zinc-300">拖曳檔案到此處，或</p>
                            <button 
                                onClick={() => inputRef.current?.click()}
                                className="mt-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow-lg transition-colors"
                            >
                                選擇檔案
                            </button>
                        </div>
                        <p className="text-[10px] text-zinc-500">支援 .pgn, .txt, .dhtmlxq 檔案</p>
                        <input 
                            ref={inputRef} 
                            type="file" 
                            className="hidden" 
                            accept=".pgn,.txt,.dhtmlxq" 
                            onChange={handleFileSelect} 
                        />
                    </div>

                    <div className="relative flex items-center py-2">
                        <div className="grow border-t border-zinc-800"></div>
                        <span className="shrink-0 mx-4 text-xs text-zinc-500">或 貼上文字</span>
                        <div className="grow border-t border-zinc-800"></div>
                    </div>

                    <div className="space-y-2">
                        <textarea 
                            value={inputText}
                            onChange={(e) => { setInputText(e.target.value); setError(null); }}
                            className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:border-amber-500 focus:outline-none resize-none placeholder-zinc-600"
                            placeholder="在此貼上 PGN 或 DhtmlXQ 代碼..."
                        />
                        {error && (
                            <div className="text-red-400 text-xs flex items-center gap-1">
                                <AlertTriangle size={12} /> {error}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded font-medium text-sm">取消</button>
                    <button 
                        onClick={handleTextImport}
                        disabled={!inputText.trim()}
                        className="px-6 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-bold text-sm shadow-lg"
                    >
                        確定
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportModal;
