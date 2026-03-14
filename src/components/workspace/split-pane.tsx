'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { FileText, Sparkles } from 'lucide-react';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultSplit?: number; // percentage for left pane (0-100)
  minLeft?: number;
  minRight?: number;
}

export function SplitPane({ left, right, defaultSplit = 55, minLeft = 30, minRight = 25 }: SplitPaneProps) {
  const [split, setSplit] = useState(defaultSplit);
  const [dragging, setDragging] = useState(false);
  const [activePane, setActivePane] = useState<'left' | 'right'>('left');
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const calcSplit = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(minLeft, Math.min(100 - minRight, pct)));
  }, [minLeft, minRight]);

  const handleMouseDown = useCallback(() => {
    setDragging(true);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => calcSplit(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) calcSplit(e.touches[0].clientX);
    };
    const handleEnd = () => setDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [dragging, calcSplit]);

  if (isMobile) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="sticky top-0 z-10 flex shrink-0 border-b border-zinc-800 bg-zinc-900">
          <button
            onClick={() => setActivePane('left')}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activePane === 'left'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            Document
          </button>
          <button
            onClick={() => setActivePane('right')}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activePane === 'right'
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Chat
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className={`h-full flex-col ${activePane === 'left' ? 'flex' : 'hidden'}`}>
            {left}
          </div>
          <div className={`h-full flex-col ${activePane === 'right' ? 'flex' : 'hidden'}`}>
            {right}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden" style={{ cursor: dragging ? 'col-resize' : undefined }}>
      <div style={{ width: `${split}%` }} className="h-full overflow-hidden flex flex-col">
        {left}
      </div>
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className={`w-1.5 sm:w-1 shrink-0 cursor-col-resize transition-colors touch-none ${
          dragging ? 'bg-blue-500' : 'bg-zinc-800 hover:bg-zinc-600'
        }`}
      />
      <div style={{ width: `${100 - split}%` }} className="h-full overflow-hidden flex flex-col">
        {right}
      </div>
    </div>
  );
}
