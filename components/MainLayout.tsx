
import React from 'react';

interface MainLayoutProps {
  header: React.ReactNode;
  leftSidebar: React.ReactNode;
  rightSidebar: React.ReactNode;
  board: React.ReactNode;
  controls: React.ReactNode;
  mobileTabs: React.ReactNode;
  mobileOverlay: React.ReactNode;
  isMobilePortrait?: boolean; // New Prop for Dimension-based RWD
}

/**
 * 獨立的佈局組件，確保 RWD 體驗穩定
 * 使用 Flexbox 確保底部指令列在任何螢幕尺寸下都不會消失
 */
const MainLayout: React.FC<MainLayoutProps> = ({
  header,
  leftSidebar,
  rightSidebar,
  board,
  controls,
  mobileTabs,
  mobileOverlay,
  isMobilePortrait = false
}) => {
  return (
    <div
      className="flex flex-col w-full bg-zinc-950 text-zinc-100 overflow-hidden"
      style={{ height: 'var(--app-height, 100vh)' }}
    >
      {/* 頂部導航欄 (固定高度) */}
      <div className="shrink-0 z-50">
        {header}
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* 左側雲庫 (非 MobilePortrait 模式顯示) */}
        {!isMobilePortrait && (
          <aside className="hidden xl:flex w-80 2xl:w-96 flex-col border-r border-zinc-800 bg-zinc-900/50">
            {leftSidebar}
          </aside>
        )}

        {/* 中央主區域 */}
        <main className="flex-1 flex flex-col bg-zinc-950 min-w-0 relative w-full">
          <div className="flex-1 flex flex-col p-1 md:p-4 overflow-hidden w-full">
            <div className="flex-1 flex flex-col max-w-[800px] mx-auto w-full min-h-0">

              {/* 棋盤區域 - flex-1 與 min-h-0 是防止擠壓的關鍵 */}
              {/* 加入 w-full 確保 iOS WebKit 正確計算寬度 */}
              <div className="flex-1 flex items-center justify-center relative min-h-0 overflow-hidden w-full">
                {board}
              </div>

              {/* 下方指令區域 - shrink-0 確保寬度不足時也不會消失 */}
              <div className="flex flex-col shrink-0 mt-1 gap-1">
                <div className="w-full">
                  {controls}
                </div>

                {/* 移動端專屬分頁切換按鈕 (增加 padding 確保在部分 Android 設備上不被遮擋) */}
                {isMobilePortrait && (
                  <div className="shrink-0 h-12 pb-1">
                    {mobileTabs}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* 右側招法 (非 MobilePortrait 模式顯示) */}
        {!isMobilePortrait && (
          <aside className="hidden xl:flex w-80 2xl:w-96 flex-col border-l border-zinc-800 bg-zinc-900/50">
            {rightSidebar}
          </aside>
        )}

        {/* 移動端全屏覆蓋層 (招法/雲庫) */}
        {mobileOverlay}
      </div>
    </div>
  );
};

export default MainLayout;
