'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface CellData {
  v: string | number; // value (display)
  f?: string;          // formula (if any)
  t?: 's' | 'n';      // type: string or number
  fmt?: string;        // format hint
  bold?: boolean;
  bg?: string;         // background color class
}

interface ExcelViewerProps {
  cells: Record<string, CellData>;
  onCellChange: (cellRef: string, value: string, formula?: string) => void;
  rows?: number;
  cols?: number;
}

function colLabel(idx: number): string {
  let label = '';
  let n = idx;
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

function cellRef(row: number, col: number): string {
  return `${colLabel(col)}${row + 1}`;
}

export function ExcelViewer({ cells, onCellChange, rows = 50, cols = 15 }: ExcelViewerProps) {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCell]);

  const handleCellClick = useCallback((ref: string) => {
    setSelectedCell(ref);
  }, []);

  const handleCellDoubleClick = useCallback((ref: string) => {
    const cell = cells[ref];
    setEditingCell(ref);
    setEditValue(cell?.f || String(cell?.v ?? ''));
  }, [cells]);

  const handleEditComplete = useCallback(() => {
    if (!editingCell) return;
    const isFormula = editValue.startsWith('=');
    onCellChange(editingCell, editValue, isFormula ? editValue : undefined);
    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, onCellChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingCell) {
        handleEditComplete();
        // Move down
        const match = editingCell.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          const nextRef = `${match[1]}${parseInt(match[2]) + 1}`;
          setSelectedCell(nextRef);
        }
      } else if (selectedCell) {
        handleCellDoubleClick(selectedCell);
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (editingCell) handleEditComplete();
      // Move right
      if (selectedCell) {
        const match = selectedCell.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          const colIdx = match[1].split('').reduce((acc, c, i, arr) => acc + (c.charCodeAt(0) - 65) * Math.pow(26, arr.length - 1 - i), 0);
          const nextRef = `${colLabel(colIdx + 1)}${match[2]}`;
          setSelectedCell(nextRef);
        }
      }
    }
  }, [editingCell, selectedCell, handleEditComplete, handleCellDoubleClick]);

  const formatValue = (cell: CellData | undefined): string => {
    if (!cell) return '';
    const val = cell.v;
    if (val === undefined || val === null || val === '') return '';
    if (typeof val === 'number') {
      if (cell.fmt === '%') return `${(val * 100).toFixed(1)}%`;
      if (cell.fmt === '$' || cell.fmt === '€') return `${cell.fmt}${val.toLocaleString()}`;
      if (cell.fmt === '#,##0') return val.toLocaleString();
      if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val.toLocaleString();
    }
    return String(val);
  };

  const selectedCellData = selectedCell ? cells[selectedCell] : null;

  return (
    <div className="h-full flex flex-col bg-zinc-950" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Formula bar */}
      <div className="shrink-0 border-b border-zinc-800 px-2 py-1.5 flex items-center gap-2 bg-zinc-900/50">
        <div className="w-16 text-center text-xs font-mono text-zinc-400 bg-zinc-800 rounded px-2 py-1 shrink-0">
          {selectedCell || ''}
        </div>
        <div className="text-xs text-zinc-600 px-1">fx</div>
        <div className="flex-1 text-sm font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 min-h-[28px]">
          {selectedCellData?.f || (selectedCellData ? String(selectedCellData.v ?? '') : '')}
        </div>
      </div>

      {/* Grid */}
      <div ref={gridRef} className="flex-1 overflow-auto">
        <table className="border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-10 min-w-[40px] bg-zinc-900 border border-zinc-800 text-zinc-600 text-center py-1 sticky left-0 z-20" />
              {Array.from({ length: cols }, (_, ci) => (
                <th
                  key={ci}
                  className="min-w-[90px] bg-zinc-900 border border-zinc-800 text-zinc-500 text-center py-1 font-normal"
                >
                  {colLabel(ci)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, ri) => (
              <tr key={ri}>
                <td className="bg-zinc-900 border border-zinc-800 text-zinc-600 text-center py-0.5 font-normal sticky left-0 z-10 text-[10px]">
                  {ri + 1}
                </td>
                {Array.from({ length: cols }, (_, ci) => {
                  const ref = cellRef(ri, ci);
                  const cell = cells[ref];
                  const isSelected = ref === selectedCell;
                  const isEditing = ref === editingCell;

                  return (
                    <td
                      key={ci}
                      onClick={() => handleCellClick(ref)}
                      onDoubleClick={() => handleCellDoubleClick(ref)}
                      className={`border border-zinc-800/50 px-1.5 py-0.5 cursor-cell transition-colors
                        ${isSelected ? 'ring-2 ring-blue-500 ring-inset bg-zinc-800/30' : ''}
                        ${cell?.bg || ''}
                        ${cell?.bold ? 'font-semibold' : ''}
                        ${cell?.t === 'n' ? 'text-right' : 'text-left'}
                        ${cell?.f ? 'text-blue-300' : 'text-zinc-300'}
                        ${!cell ? 'text-zinc-700' : ''}
                      `}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleEditComplete}
                          className="w-full bg-transparent outline-none text-zinc-100 font-mono"
                        />
                      ) : (
                        <span className="block truncate">{formatValue(cell)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
