
import React, { useState, useEffect, useRef } from 'react';
import {
    SkipBack,
    ChevronLeft,
    Play,
    Pause,
    ChevronRight,
    Crosshair,
    ArrowUpDown,
    ArrowLeftRight,
    CornerUpLeft,
    CornerUpRight,
    FastForward,
    Rewind,
    X
} from 'lucide-react';

interface ControlBarProps {
    onNavigate: (dir: 'prev' | 'next' | 'start' | 'end') => void;
    onNavigateVariation: (dir: 'prev' | 'next') => void;
    onJumpToStep: (index: number) => void;
    onFlip: () => void;
    onMirror: () => void;
    currentIndex: number;
    totalSteps: number;
    disabled?: boolean;
}

const ControlBar: React.FC<ControlBarProps> = ({
    onNavigate,
    onNavigateVariation,
    onJumpToStep,
    onFlip,
    onMirror,
    currentIndex,
    totalSteps,
    disabled = false
}) => {
    const [showJumpMenu, setShowJumpMenu] = useState(false);
    const [showSeekOverlay, setShowSeekOverlay] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [seekValue, setSeekValue] = useState(currentIndex);

    // Refs for click outside
    const jumpMenuRef = useRef<HTMLDivElement>(null);

    // Sync seek value
    useEffect(() => {
        setSeekValue(currentIndex);
    }, [currentIndex]);

    // Playback Logic
    useEffect(() => {
        let interval: number;
        if (isPlaying) {
            interval = window.setInterval(() => {
                if (currentIndex < totalSteps - 1) {
                    onNavigate('next');
                } else {
                    setIsPlaying(false);
                }
            }, 1500);
        }
        return () => clearInterval(interval);
    }, [isPlaying, currentIndex, totalSteps, onNavigate]);

    // Click Outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (jumpMenuRef.current && !jumpMenuRef.current.contains(event.target as Node)) {
                setShowJumpMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const btnClass = `relative flex flex-col items-center justify-center p-0.5 md:p-2 rounded-lg bg-zinc-800 border border-zinc-700 shadow-md group transition-all 
      ${disabled ? 'opacity-30 cursor-not-allowed text-zinc-500' : 'hover:bg-zinc-700 active:scale-95 text-zinc-300 hover:text-white'}`;

    const labelClass = "text-[9px] md:text-[10px] mt-0.5 md:mt-1 font-medium opacity-70 group-hover:opacity-100 whitespace-nowrap";
    const iconSize = 18;

    const handleAction = (action: () => void) => {
        if (!disabled) action();
    };

    // Custom Slider Rendering Logic
    const maxVal = Math.max(1, totalSteps - 1);
    const progressPercent = (seekValue / maxVal) * 100;

    return (
        <div className="w-full relative z-30">

            {/* Jump Menu Popover (Upwards) */}
            {showJumpMenu && !disabled && (
                <div ref={jumpMenuRef} className="absolute bottom-full left-0 mb-3 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl p-2 w-48 flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                    <button onClick={() => { onNavigate('start'); setShowJumpMenu(false); }} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 rounded text-sm text-zinc-300">
                        <Rewind size={16} /> 初始局面 (0)
                    </button>
                    <button onClick={() => { onNavigate('end'); setShowJumpMenu(false); }} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 rounded text-sm text-zinc-300">
                        <FastForward size={16} /> 最後局面
                    </button>
                    <div className="h-px bg-zinc-800 my-1"></div>
                    <button onClick={() => { onNavigateVariation('prev'); setShowJumpMenu(false); }} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 rounded text-sm text-zinc-300">
                        <CornerUpLeft size={16} /> 上個變著
                    </button>
                    <button onClick={() => { onNavigateVariation('next'); setShowJumpMenu(false); }} className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 rounded text-sm text-zinc-300">
                        <CornerUpRight size={16} /> 下個變著
                    </button>
                </div>
            )}

            <div className="relative bg-zinc-900 border-t md:border-t-0 md:border md:rounded-xl border-zinc-700 shadow-lg overflow-hidden">

                {/* 1. Main Control Buttons Grid */}
                <div className={`grid grid-cols-7 gap-0.5 md:gap-2 px-1 py-1 md:py-3 transition-opacity duration-300 ${showSeekOverlay ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    {/* 1. Jump (Menu) */}
                    <button
                        className={`${btnClass} ${showJumpMenu ? 'bg-zinc-700 text-white border-zinc-500' : ''}`}
                        onClick={(e) => { e.stopPropagation(); if (!disabled) setShowJumpMenu(!showJumpMenu); }}
                        title="跳轉選單"
                        disabled={disabled}
                    >
                        <SkipBack size={iconSize} />
                        <span className={labelClass}>跳轉</span>
                    </button>

                    {/* 2. Prev */}
                    <button
                        className={btnClass}
                        onClick={() => handleAction(() => onNavigate('prev'))}
                        disabled={disabled || currentIndex <= 0}
                        title="上一步"
                    >
                        <ChevronLeft size={iconSize} />
                        <span className={labelClass}>上一步</span>
                    </button>

                    {/* 3. Play/Pause */}
                    <button
                        className={`${btnClass} ${isPlaying ? 'bg-indigo-900/50 border-indigo-700 text-indigo-200' : ''}`}
                        onClick={() => handleAction(() => setIsPlaying(!isPlaying))}
                        title={isPlaying ? "暫停" : "播放"}
                        disabled={disabled}
                    >
                        {isPlaying ? <Pause size={iconSize} fill="currentColor" /> : <Play size={iconSize} fill="currentColor" />}
                        <span className={labelClass}>{isPlaying ? "暫停" : "播放"}</span>
                    </button>

                    {/* 4. Next */}
                    <button
                        className={btnClass}
                        onClick={() => handleAction(() => onNavigate('next'))}
                        disabled={disabled || currentIndex >= totalSteps - 1}
                        title="下一步"
                    >
                        <ChevronRight size={iconSize} />
                        <span className={labelClass}>下一步</span>
                    </button>

                    {/* 5. Locate (Slider) - Opens Overlay */}
                    <button
                        className={btnClass}
                        onClick={(e) => { e.stopPropagation(); if (!disabled) setShowSeekOverlay(true); }}
                        title="定位回合"
                        disabled={disabled}
                    >
                        <Crosshair size={iconSize} />
                        <span className={labelClass}>定位</span>
                    </button>

                    {/* 6. Flip V */}
                    <button className={btnClass} onClick={onFlip} title="上下翻轉">
                        <ArrowUpDown size={iconSize} />
                        <span className={labelClass}>翻轉</span>
                    </button>

                    {/* 7. Flip H */}
                    <button className={btnClass} onClick={onMirror} title="左右翻轉 (鏡像)">
                        <ArrowLeftRight size={iconSize} />
                        <span className={labelClass}>鏡像</span>
                    </button>
                </div>

                {/* 2. Seek Bar Overlay (Covers Buttons) */}
                {showSeekOverlay && !disabled && (
                    <div className="absolute inset-0 z-10 bg-zinc-900/95 backdrop-blur-md flex items-center px-4 gap-4 animate-in fade-in slide-in-from-bottom-2">

                        {/* Current Step Display */}
                        <div className="flex flex-col items-center justify-center min-w-[3rem]">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Turn</span>
                            <span className="text-xl font-black text-blue-400 font-mono leading-none drop-shadow-lg">{seekValue}</span>
                        </div>

                        {/* Custom Fancy Slider */}
                        <div className="flex-1 relative h-8 flex items-center group">
                            {/* Native Input (Invisible but interactive) */}
                            <input
                                type="range"
                                min="0"
                                max={maxVal}
                                value={seekValue}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setSeekValue(val);
                                    onJumpToStep(val);
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            />

                            {/* Visual Track Background */}
                            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden relative">
                                {/* Filled Part (Left) - Gradient */}
                                <div
                                    className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                    style={{ width: `${progressPercent}%` }}
                                ></div>
                            </div>

                            {/* Visual Thumb */}
                            <div
                                className="absolute h-4 w-4 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)] border-2 border-blue-500 pointer-events-none transition-transform duration-75 ease-out z-10"
                                style={{ left: `calc(${progressPercent}% - 8px)` }}
                            >
                                <div className="absolute inset-0 bg-blue-400 rounded-full opacity-20 animate-ping"></div>
                            </div>
                        </div>

                        {/* Max Step */}
                        <div className="text-[10px] text-zinc-500 font-mono font-bold min-w-[2rem] text-right">
                            /{maxVal}
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => setShowSeekOverlay(false)}
                            className="p-2 -mr-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ControlBar;
