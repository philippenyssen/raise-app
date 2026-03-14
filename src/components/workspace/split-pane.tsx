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

  const handleMouseDown = useCallback(() => {
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.max(minLeft, Math.min(100 - minRight, pct)));
    };

    const handleMouseUp = () => setDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, minLeft, minRight]);

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden" style={{ cursor: dragging ? 'col-resize' : undefined }}>
      <div style={{ width: `${split}%` }} className="h-full overflow-hidden flex flex-col">
        {left}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className={`w-1 shrink-0 cursor-col-resize transition-colors ${
          dragging ? 'bg-blue-500' : 'bg-zinc-800 hover:bg-zinc-600'
        }`}
      />
      <div style={{ width: `${100 - split}%` }} className="h-full overflow-hidden flex flex-col">
        {right}
      </div>
    </div>
  );
}
