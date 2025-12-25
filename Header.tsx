import React from 'react';
import { Menu, Settings, Save, Edit, BookOpen, Info } from 'lucide-react';

interface HeaderProps {
    onOpenInfo?: () => void;
    onOpenEdit?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenInfo, onOpenEdit }) => {
    const itemClass = "flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-md cursor-pointer transition-colors";

    return (
        <header className="w-full bg-zinc-900 border-b border-zinc-800 px-4 h-14 flex items-center justify-between shrink-0 z-50">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-600 to-amber-800 rounded-lg flex items-center justify-center font-bold text-white shadow-inner">
                    弈
                </div>
                <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500 hidden sm:block">
                    Cloud Chess Note
                </span>
            </div>

            {/* Desktop Menu */}
            <nav className="hidden md:flex items-center gap-1">
                <button onClick={onOpenInfo} className={itemClass}><Info size={16}/> 資訊</button>
                <button onClick={onOpenEdit} className={itemClass}><Edit size={16}/> 編輯</button>
                <button className={itemClass}><BookOpen size={16}/> 背譜</button>
                <button className={itemClass}><Save size={16}/> 檔案</button>
                <button className={itemClass}><Settings size={16}/> 設定</button>
            </nav>

            {/* Mobile Menu Icon */}
            <button className="md:hidden p-2 text-zinc-400 hover:text-white">
                <Menu size={24} />
            </button>
        </header>
    );
};

export default Header;