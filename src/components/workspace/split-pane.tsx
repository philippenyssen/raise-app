'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);

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
