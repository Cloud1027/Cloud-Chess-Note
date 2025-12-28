import React, { useState } from 'react';
import { X, Edit2, Calendar, Trophy, User } from 'lucide-react';
import { GameMetadata } from '../types';

interface InfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    metadata: GameMetadata;
    onSave: (data: GameMetadata) => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, metadata, onSave }) => {
    const [formData, setFormData] = useState<GameMetadata>(metadata);

    // [Fix] Sync internal state with prop when modal opens or metadata updates
    React.useEffect(() => {
        setFormData(metadata);
    }, [metadata, isOpen]);

    if (!isOpen) return null;

    const handleChange = (field: keyof GameMetadata, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        onSave(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Edit2 className="text-amber-500" size={20} />
                        編輯棋譜資訊
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">

                    {/* Title */}
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-zinc-400 block">標題 :</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            placeholder="棋局標題"
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                    </div>

                    {/* Event */}
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-zinc-400 block">賽事 :</label>
                        <div className="relative">
                            <Trophy size={16} className="absolute left-3 top-3 text-zinc-500" />
                            <input
                                type="text"
                                value={formData.event}
                                onChange={(e) => handleChange('event', e.target.value)}
                                placeholder="比賽名稱"
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Date */}
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-zinc-400 block">日期 :</label>
                        <div className="relative">
                            <Calendar size={16} className="absolute left-3 top-3 text-zinc-500" />
                            <input
                                type="text"
                                value={formData.date}
                                onChange={(e) => handleChange('date', e.target.value)}
                                placeholder="YYYY-MM-DD"
                                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Result */}
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-zinc-400 block">結果 :</label>
                        <select
                            value={formData.result}
                            onChange={(e) => handleChange('result', e.target.value as any)}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors appearance-none cursor-pointer"
                        >
                            <option value="unknown">未知</option>
                            <option value="red">紅勝</option>
                            <option value="black">黑勝</option>
                            <option value="draw">和棋</option>
                        </select>
                    </div>

                    {/* Players */}
                    <div className="grid grid-cols-1 gap-4 pt-2 border-t border-zinc-800">
                        <div className="space-y-1">
                            <label className="text-sm font-bold text-red-400 block">紅方 :</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-3 text-red-900" />
                                <input
                                    type="text"
                                    value={formData.redName}
                                    onChange={(e) => handleChange('redName', e.target.value)}
                                    placeholder="紅方棋手"
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-zinc-200 focus:outline-none focus:border-red-500 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-sm font-bold text-zinc-400 block">黑方 :</label>
                            <div className="relative">
                                <User size={16} className="absolute left-3 top-3 text-zinc-600" />
                                <input
                                    type="text"
                                    value={formData.blackName}
                                    onChange={(e) => handleChange('blackName', e.target.value)}
                                    placeholder="黑方棋手"
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold shadow-lg shadow-green-900/20 transition-colors"
                    >
                        確定
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InfoModal;