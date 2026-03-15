'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { HyperFormula } from 'hyperformula';

export interface CellData {
  v: string | number; // value (display)
  f?: string;          // formula (if any)
  t?: 's' | 'n';      // type: string or number
  fmt?: string;        // format hint
  bold?: boolean;
  bg?: string;         // background color class
}

export interface SheetData { name: string; cells: Record<string, CellData>; }

interface ExcelViewerProps {
  cells: Record<string, CellData>;
  onCellChange: (cellRef: string, value: string, formula?: string) => void;
  rows?: number;
  cols?: number;
  allSheets?: SheetData[];       // All sheets for cross-sheet formula resolution
  activeSheetName?: string;      // Current sheet name (used to identify which sheet to display)
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

function colIndex(label: string): number {
  let idx = 0;
  for (let i = 0; i < label.length; i++) {
    idx = idx * 26 + (label.charCodeAt(i) - 65 + 1);
  }
  return idx - 1;
}

function cellRefStr(row: number, col: number): string {
  return `${colLabel(col)}${row + 1}`;
}

function parseCellRef(ref: string): { row: number; col: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  return { col: colIndex(match[1]), row: parseInt(match[2]) - 1 };
}

export function ExcelViewer({ cells, onCellChange, rows = 50, cols = 15, allSheets, activeSheetName }: ExcelViewerProps) {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const displaySheetName = activeSheetName || 'Sheet1';

  const hf = useMemo(() => {
    const engine = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3' });

    const populateSheet = (sheetName: string, sheetCells: Record<string, CellData>) => {
      const sheetId = engine.getSheetId(sheetName);
      if (sheetId === undefined) return;

      Object.entries(sheetCells).forEach(([ref, cell]) => {
        const parsed = parseCellRef(ref);
        if (!parsed) return;
        const { row, col } = parsed;

        const currentRows = engine.getSheetDimensions(sheetId).height;
        const currentCols = engine.getSheetDimensions(sheetId).width;
        if (row >= currentRows) {
          engine.addRows(sheetId, [currentRows, row - currentRows + 1]);
        }
        if (col >= currentCols) {
          engine.addColumns(sheetId, [currentCols, col - currentCols + 1]);
        }

        try {
          if (cell.f) {
            engine.setCellContents({ sheet: sheetId, row, col }, cell.f);
          } else if (cell.v !== undefined && cell.v !== '') {
            engine.setCellContents({ sheet: sheetId, row, col }, cell.v);
          }
        } catch {
          // Skip cells that cause errors
        }});
    };

    if (allSheets && allSheets.length > 0) {
      allSheets.forEach(sheet => {
        engine.addSheet(sheet.name);});
      allSheets.forEach(sheet => {
        const sheetCells = sheet.name === displaySheetName ? cells : sheet.cells;
        populateSheet(sheet.name, sheetCells);});
    } else {
      engine.addSheet(displaySheetName);
      populateSheet(displaySheetName, cells);
    }

    return engine;
  }, [cells, allSheets, displaySheetName]);

  const getComputedValue = useCallback((ref: string): string | number | null => {
    const parsed = parseCellRef(ref);
    if (!parsed) return null;
    try {
      const sheetId = hf.getSheetId(displaySheetName);
      if (sheetId === undefined) return null;
      const val = hf.getCellValue({ sheet: sheetId, row: parsed.row, col: parsed.col });
      if (val === null || val === undefined) return null;
      if (typeof val === 'object' && 'type' in val) return '#ERROR'; // CellError
      return val as string | number;
    } catch {
      return null;
    }
  }, [hf, displaySheetName]);

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
      if (selectedCell) {
        const match = selectedCell.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          const ci = colIndex(match[1]);
          const nextRef = `${colLabel(ci + 1)}${match[2]}`;
          setSelectedCell(nextRef);
        }}
    }
  }, [editingCell, selectedCell, handleEditComplete, handleCellDoubleClick]);

  const formatValue = (cell: CellData | undefined, ref: string): string => {
    if (cell?.f) {
      const computed = getComputedValue(ref);
      if (computed !== null) {
        if (typeof computed === 'number') {
          if (cell.fmt === '%') return `${(computed * 100).toFixed(1)}%`;
          if (cell.fmt === '$' || cell.fmt === '€') return `${cell.fmt}${computed.toLocaleString()}`;
          if (cell.fmt === '#,##0') return computed.toLocaleString();
          if (Math.abs(computed) >= 1000000) return `${(computed / 1000000).toFixed(1)}M`;
          if (Math.abs(computed) >= 1000) return `${(computed / 1000).toFixed(1)}K`;
          return computed.toLocaleString();
        }
        return String(computed);
      }}

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
    <div
      className="h-full flex flex-col"
      style={{ backgroundColor: 'var(--surface-0)' }}
      onKeyDown={handleKeyDown}
      tabIndex={0}>
      {/* Formula bar */}
      <div
        className="shrink-0 px-2 py-1.5 flex items-center gap-2"
        style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-1)' }}>
        <div
          className="w-16 text-center text-xs font-mono rounded px-2 py-1 shrink-0"
          style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--surface-2)' }}>
          {selectedCell || ''}</div>
        <div className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>fx</div>
        <div
          className="flex-1 text-sm font-mono rounded px-2 py-1 min-h-[28px]"
          style={{
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',}}>
          {selectedCellData?.f || (selectedCellData ? String(selectedCellData.v ?? '') : '')}</div></div>

      {/* Grid */}
      <div ref={gridRef} className="flex-1 overflow-auto">
        <table className="border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                className="w-10 min-w-[40px] text-center py-1 sticky left-0 z-20"
                style={{
                  backgroundColor: 'var(--surface-1)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}/>
              {Array.from({ length: cols }, (_, ci) => (
                <th
                  key={ci}
                  className="min-w-[90px] text-center py-1 font-normal"
                  style={{
                    backgroundColor: 'var(--surface-1)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',}}>
                  {colLabel(ci)}</th>
              ))}</tr></thead>
          <tbody>
            {Array.from({ length: rows }, (_, ri) => (
              <tr key={ri}>
                <td
                  className="text-center py-0.5 font-normal sticky left-0 z-10 text-xs"
                  style={{
                    backgroundColor: 'var(--surface-1)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',}}>
                  {ri + 1}</td>
                {Array.from({ length: cols }, (_, ci) => {
                  const ref = cellRefStr(ri, ci);
                  const cell = cells[ref];
                  const isSelected = ref === selectedCell;
                  const isEditing = ref === editingCell;

                  const cellColor = !cell
                    ? 'var(--text-muted)'
                    : cell.f
                      ? 'var(--accent)'
                      : 'var(--text-secondary)';

                  return (
                    <td
                      key={ci}
                      onClick={() => handleCellClick(ref)}
                      onDoubleClick={() => handleCellDoubleClick(ref)}
                      className={`px-1.5 py-0.5 cursor-cell transition-colors
                        ${isSelected ? 'ring-2 ring-inset' : ''}
                        ${cell?.bold ? 'font-normal' : ''}
                        ${cell?.t === 'n' || (cell?.f && typeof getComputedValue(ref) === 'number') ? 'text-right' : 'text-left'}
                      `}
                      style={{
                        border: '1px solid color-mix(in srgb, var(--border-subtle) 50%, transparent)',
                        color: cellColor,
                        ...(isSelected ? {
                          ringColor: 'var(--accent)',
                          boxShadow: 'inset 0 0 0 2px var(--accent)',
                          backgroundColor: 'color-mix(in srgb, var(--surface-2) 30%, transparent)',
                        } : {}),}}>
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleEditComplete}
                          className="w-full bg-transparent outline-none font-mono"
                          style={{ color: 'var(--text-primary)' }}/>
                      ) : (
                        <span className="block truncate">{formatValue(cell, ref)}</span>
                      )}
                    </td>);
                })}</tr>
            ))}</tbody></table></div>
    </div>);
}
