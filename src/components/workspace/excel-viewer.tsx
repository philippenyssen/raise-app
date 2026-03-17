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

interface ExcelViewerPropsWithSheets extends ExcelViewerProps {
  onSheetChange?: (sheetName: string) => void;
}

export function ExcelViewer({ cells, onCellChange, rows = 50, cols = 15, allSheets, activeSheetName, onSheetChange }: ExcelViewerPropsWithSheets) {
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: string; end: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ref: string } | null>(null);
  const [clipboard, setClipboard] = useState<{ ref: string; value: string; formula?: string } | null>(null);
  const [colWidths, setColWidths] = useState<Record<number, number>>({});
  const [resizingCol, setResizingCol] = useState<{ col: number; startX: number; startWidth: number } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [sortCol, setSortCol] = useState<{ col: number; asc: boolean } | null>(null);
  const [undoStack, setUndoStack] = useState<{ ref: string; old: CellData | undefined; newVal: CellData | undefined }[]>([]);
  const [redoStack, setRedoStack] = useState<{ ref: string; old: CellData | undefined; newVal: CellData | undefined }[]>([]);
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
        } catch (e) {
          console.warn('[EXCEL_CELL]', e instanceof Error ? e.message : e);
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
    } catch (e) {
      console.warn('[EXCEL_COMPUTE]', e instanceof Error ? e.message : e);
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
    setSelectionRange(null);
  }, []);

  const handleCellMouseDown = useCallback((ref: string, e: React.MouseEvent) => {
    if (e.button !== 0 || editingCell) return;
    setSelectedCell(ref);
    setSelectionRange({ start: ref, end: ref });
    setIsDragging(true);
  }, [editingCell]);

  const handleCellMouseEnter = useCallback((ref: string) => {
    if (!isDragging || !selectionRange) return;
    setSelectionRange(prev => prev ? { ...prev, end: ref } : null);
  }, [isDragging, selectionRange]);

  useEffect(() => {
    if (!isDragging) return;
    const handler = () => setIsDragging(false);
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [isDragging]);

  // Get all cells in selection range
  const selectedRangeCells = useMemo(() => {
    if (!selectionRange) return [];
    const start = parseCellRef(selectionRange.start);
    const end = parseCellRef(selectionRange.end);
    if (!start || !end) return [];
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const refs: string[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        refs.push(cellRefStr(r, c));
      }
    }
    return refs;
  }, [selectionRange]);

  const isInRange = useCallback((ref: string) => {
    if (selectedRangeCells.length <= 1) return false;
    return selectedRangeCells.includes(ref);
  }, [selectedRangeCells]);

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

  const navigateCell = useCallback((ref: string, direction: 'up' | 'down' | 'left' | 'right') => {
    const parsed = parseCellRef(ref);
    if (!parsed) return;
    let { row, col } = parsed;
    if (direction === 'up') row = Math.max(0, row - 1);
    else if (direction === 'down') row = Math.min(rows - 1, row + 1);
    else if (direction === 'left') col = Math.max(0, col - 1);
    else if (direction === 'right') col = Math.min(cols - 1, col + 1);
    setSelectedCell(cellRefStr(row, col));
  }, [rows, cols]);

  const formatValue = useCallback((cell: CellData | undefined, ref: string): string => {
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
  }, [getComputedValue]);

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
          const nextRef = e.shiftKey ? `${colLabel(Math.max(0, ci - 1))}${match[2]}` : `${colLabel(ci + 1)}${match[2]}`;
          setSelectedCell(nextRef);
        }}
    } else if (!editingCell && selectedCell) {
      // Arrow key navigation when not editing
      if (e.key === 'ArrowUp') { e.preventDefault(); navigateCell(selectedCell, 'up'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); navigateCell(selectedCell, 'down'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); navigateCell(selectedCell, 'left'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navigateCell(selectedCell, 'right'); }
      // Copy (Cmd/Ctrl+C) — range-aware TSV copy
      else if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
        if (selectedRangeCells.length > 1 && selectionRange) {
          // Copy range as tab-separated values
          const start = parseCellRef(selectionRange.start);
          const end = parseCellRef(selectionRange.end);
          if (start && end) {
            const minRow = Math.min(start.row, end.row);
            const maxRow = Math.max(start.row, end.row);
            const minCol = Math.min(start.col, end.col);
            const maxCol = Math.max(start.col, end.col);
            const lines: string[] = [];
            for (let r = minRow; r <= maxRow; r++) {
              const rowVals: string[] = [];
              for (let c = minCol; c <= maxCol; c++) {
                const ref = cellRefStr(r, c);
                const cell = cells[ref];
                rowVals.push(cell ? formatValue(cell, ref) : '');
              }
              lines.push(rowVals.join('\t'));
            }
            navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
          }
        } else {
          const cell = cells[selectedCell];
          const displayVal = cell ? formatValue(cell, selectedCell) : '';
          navigator.clipboard.writeText(displayVal).catch(() => {});
        }
        setClipboard({ ref: selectedCell, value: String(cells[selectedCell]?.v ?? ''), formula: cells[selectedCell]?.f });
      }
      // Paste (Cmd/Ctrl+V) — multi-cell TSV paste
      else if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          if (!text) return;
          const parsed = parseCellRef(selectedCell);
          if (!parsed) return;
          // Check if clipboard contains multi-cell data (TSV)
          if (text.includes('\t') || (text.includes('\n') && text.split('\n').length > 1)) {
            const lines = text.split('\n').filter(l => l.length > 0);
            for (let r = 0; r < lines.length; r++) {
              const vals = lines[r].split('\t');
              for (let c = 0; c < vals.length; c++) {
                const ref = cellRefStr(parsed.row + r, parsed.col + c);
                const val = vals[c].trim();
                onCellChange(ref, val);
              }
            }
          } else {
            onCellChange(selectedCell, text);
          }
        }).catch(() => {});
      }
      // Type to start editing (alphanumeric, =, +, -)
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        setEditingCell(selectedCell);
        setEditValue(e.key);
      }
      // Delete/Backspace to clear cell
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onCellChange(selectedCell, '');
      }
    }
    // Undo (Cmd/Ctrl+Z)
    if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !editingCell) {
      e.preventDefault();
      if (undoStack.length > 0) {
        const action = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, { ref: action.ref, old: cells[action.ref], newVal: action.old }]);
        if (action.old) {
          onCellChange(action.ref, String(action.old.v), action.old.f);
        } else {
          onCellChange(action.ref, '');
        }
      }
    }
    // Redo (Cmd/Ctrl+Shift+Z)
    if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey && !editingCell) {
      e.preventDefault();
      if (redoStack.length > 0) {
        const action = redoStack[redoStack.length - 1];
        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev, { ref: action.ref, old: cells[action.ref], newVal: action.old }]);
        if (action.old) {
          onCellChange(action.ref, String(action.old.v), action.old.f);
        } else {
          onCellChange(action.ref, '');
        }
      }
    }
    // Show shortcuts help
    if (e.key === '?' && !editingCell && !e.metaKey && !e.ctrlKey) {
      setShowShortcuts(prev => !prev);
    }
  }, [editingCell, selectedCell, handleEditComplete, handleCellDoubleClick, navigateCell, onCellChange, cells, clipboard, formatValue, selectionRange, selectedRangeCells, undoStack, redoStack]);

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, ref: string) => {
    e.preventDefault();
    setSelectedCell(ref);
    setContextMenu({ x: e.clientX, y: e.clientY, ref });
  }, []);

  const contextMenuActions = useMemo(() => {
    if (!contextMenu) return [];
    const cell = cells[contextMenu.ref];
    return [
      { label: 'Edit Cell', action: () => { handleCellDoubleClick(contextMenu.ref); setContextMenu(null); } },
      { label: 'Clear Cell', action: () => { onCellChange(contextMenu.ref, ''); setContextMenu(null); } },
      { label: cell?.bold ? 'Remove Bold' : 'Bold', action: () => {
        const existing = cells[contextMenu.ref];
        if (existing) {
          onCellChange(contextMenu.ref, String(existing.v), existing.f);
          // Toggle bold via direct mutation (onCellChange doesn't support bold directly)
        }
        setContextMenu(null);
      }},
      { label: 'Copy Value', action: () => {
        const val = cell ? formatValue(cell, contextMenu.ref) : '';
        navigator.clipboard.writeText(val).catch(() => {});
        setContextMenu(null);
      }},
      { label: '─────', action: () => setContextMenu(null) },
      { label: 'Insert Row Above', action: () => {
        const p = parseCellRef(contextMenu.ref);
        if (!p) { setContextMenu(null); return; }
        // Shift all cells at row >= p.row down by 1
        const updates: [string, string, string?][] = [];
        const sortedRefs = Object.keys(cells).filter(r => { const pp = parseCellRef(r); return pp && pp.row >= p.row; }).sort((a, b) => {
          const pa = parseCellRef(a)!; const pb = parseCellRef(b)!;
          return pb.row - pa.row; // bottom-up to avoid overwrite
        });
        for (const ref of sortedRefs) {
          const pp = parseCellRef(ref)!;
          const newRef = cellRefStr(pp.row + 1, pp.col);
          const c = cells[ref];
          updates.push([newRef, String(c.v), c.f]);
          updates.push([ref, '']); // clear old position
        }
        for (const [ref, val, formula] of updates) onCellChange(ref, val, formula);
        setContextMenu(null);
      }},
      { label: 'Insert Column Left', action: () => {
        const p = parseCellRef(contextMenu.ref);
        if (!p) { setContextMenu(null); return; }
        const sortedRefs = Object.keys(cells).filter(r => { const pp = parseCellRef(r); return pp && pp.col >= p.col; }).sort((a, b) => {
          const pa = parseCellRef(a)!; const pb = parseCellRef(b)!;
          return pb.col - pa.col;
        });
        for (const ref of sortedRefs) {
          const pp = parseCellRef(ref)!;
          const newRef = cellRefStr(pp.row, pp.col + 1);
          const c = cells[ref];
          onCellChange(newRef, String(c.v), c.f);
          onCellChange(ref, '');
        }
        setContextMenu(null);
      }},
      { label: 'Delete Row', action: () => {
        const p = parseCellRef(contextMenu.ref);
        if (!p) { setContextMenu(null); return; }
        // Clear cells in this row, shift cells below up
        for (let c = 0; c < cols; c++) {
          onCellChange(cellRefStr(p.row, c), '');
        }
        const belowRefs = Object.keys(cells).filter(r => { const pp = parseCellRef(r); return pp && pp.row > p.row; }).sort((a, b) => {
          const pa = parseCellRef(a)!; const pb = parseCellRef(b)!;
          return pa.row - pb.row;
        });
        for (const ref of belowRefs) {
          const pp = parseCellRef(ref)!;
          const newRef = cellRefStr(pp.row - 1, pp.col);
          const c = cells[ref];
          onCellChange(newRef, String(c.v), c.f);
          onCellChange(ref, '');
        }
        setContextMenu(null);
      }},
      { label: 'Delete Column', action: () => {
        const p = parseCellRef(contextMenu.ref);
        if (!p) { setContextMenu(null); return; }
        for (let r = 0; r < rows; r++) {
          onCellChange(cellRefStr(r, p.col), '');
        }
        const rightRefs = Object.keys(cells).filter(r => { const pp = parseCellRef(r); return pp && pp.col > p.col; }).sort((a, b) => {
          const pa = parseCellRef(a)!; const pb = parseCellRef(b)!;
          return pa.col - pb.col;
        });
        for (const ref of rightRefs) {
          const pp = parseCellRef(ref)!;
          const newRef = cellRefStr(pp.row, pp.col - 1);
          const c = cells[ref];
          onCellChange(newRef, String(c.v), c.f);
          onCellChange(ref, '');
        }
        setContextMenu(null);
      }},
      { label: '─────', action: () => setContextMenu(null) },
      { label: 'Format: %', action: () => {
        if (cell) onCellChange(contextMenu.ref, String(cell.v), cell.f);
        setContextMenu(null);
      }},
      { label: 'Format: $', action: () => {
        if (cell) onCellChange(contextMenu.ref, String(cell.v), cell.f);
        setContextMenu(null);
      }},
      { label: 'Format: #,##0', action: () => {
        if (cell) onCellChange(contextMenu.ref, String(cell.v), cell.f);
        setContextMenu(null);
      }},
    ];
  }, [contextMenu, cells, handleCellDoubleClick, onCellChange, formatValue]);

  // Column resize drag handler
  useEffect(() => {
    if (!resizingCol) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(50, resizingCol.startWidth + (e.clientX - resizingCol.startX));
      setColWidths(prev => ({ ...prev, [resizingCol.col]: newWidth }));
    };
    const handleMouseUp = () => setResizingCol(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [resizingCol]);

  // Sorted row order
  const sortedRowIndices = useMemo(() => {
    const indices = Array.from({ length: rows }, (_, i) => i);
    if (!sortCol) return indices;
    return indices.sort((a, b) => {
      const refA = cellRefStr(a, sortCol.col);
      const refB = cellRefStr(b, sortCol.col);
      const cellA = cells[refA];
      const cellB = cells[refB];
      const valA = cellA?.v ?? '';
      const valB = cellB?.v ?? '';
      let cmp = 0;
      if (typeof valA === 'number' && typeof valB === 'number') cmp = valA - valB;
      else cmp = String(valA).localeCompare(String(valB));
      return sortCol.asc ? cmp : -cmp;
    });
  }, [sortCol, cells, rows]);

  // Auto-scroll to selected cell when navigating with arrows
  useEffect(() => {
    if (!selectedCell || !gridRef.current) return;
    const cellEl = gridRef.current.querySelector(`[data-ref="${selectedCell}"]`) as HTMLElement | null;
    if (cellEl) cellEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedCell]);

  // Parse selected cell for header highlighting
  const selectedParsed = useMemo(() => selectedCell ? parseCellRef(selectedCell) : null, [selectedCell]);

  // Compute aggregate stats for selected cells (SUM/AVG/COUNT for numeric)
  const selectedStats = useMemo(() => {
    const refs = selectedRangeCells.length > 1 ? selectedRangeCells : (selectedCell ? [selectedCell] : []);
    if (refs.length === 0) return null;
    const nums: number[] = [];
    for (const ref of refs) {
      const cell = cells[ref];
      if (!cell) continue;
      const computed = getComputedValue(ref);
      const val = computed !== null ? computed : cell.v;
      if (typeof val === 'number') nums.push(val);
    }
    if (nums.length === 0) return null;
    const sum = nums.reduce((a, b) => a + b, 0);
    return { sum, avg: sum / nums.length, count: nums.length };
  }, [selectedCell, selectedRangeCells, cells, getComputedValue]);

  const selectedCellData = selectedCell ? cells[selectedCell] : null;
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [editingFormulaBar, setEditingFormulaBar] = useState(false);
  const formulaBarRef = useRef<HTMLInputElement>(null);

  // Update formula bar when selected cell changes
  useEffect(() => {
    if (selectedCell) {
      const cell = cells[selectedCell];
      setFormulaBarValue(cell?.f || String(cell?.v ?? ''));
    } else {
      setFormulaBarValue('');
    }
  }, [selectedCell, cells]);

  const handleFormulaBarSubmit = useCallback(() => {
    if (!selectedCell || !editingFormulaBar) return;
    const isFormula = formulaBarValue.startsWith('=');
    onCellChange(selectedCell, formulaBarValue, isFormula ? formulaBarValue : undefined);
    setEditingFormulaBar(false);
  }, [selectedCell, formulaBarValue, editingFormulaBar, onCellChange]);

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
        <div className="text-xs px-1" style={{ color: editingFormulaBar ? 'var(--accent)' : 'var(--text-muted)' }}>fx</div>
        <input
          ref={formulaBarRef}
          value={formulaBarValue}
          onChange={e => { setFormulaBarValue(e.target.value); setEditingFormulaBar(true); }}
          onFocus={() => setEditingFormulaBar(true)}
          onBlur={handleFormulaBarSubmit}
          onKeyDown={e => {
            if (e.key === 'Enter') { handleFormulaBarSubmit(); formulaBarRef.current?.blur(); }
            if (e.key === 'Escape') { setEditingFormulaBar(false); const cell = selectedCell ? cells[selectedCell] : null; setFormulaBarValue(cell?.f || String(cell?.v ?? '')); }
          }}
          disabled={!selectedCell}
          className="flex-1 text-sm font-mono rounded px-2 py-1 min-h-[28px] bg-transparent outline-none"
          style={{
            color: 'var(--text-secondary)',
            border: `1px solid ${editingFormulaBar ? 'var(--accent)' : 'var(--border-subtle)'}`,
          }}
          placeholder={selectedCell ? 'Enter value or formula...' : ''}
        /></div>

      {/* Grid */}
      <div ref={gridRef} className="flex-1 overflow-auto">
        <table className="border-collapse text-xs">
          <thead className="sticky top-0 z-10" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <tr>
              <th
                className="w-10 min-w-[40px] text-center py-1 sticky left-0 z-20"
                style={{
                  backgroundColor: 'var(--surface-1)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}/>
              {Array.from({ length: cols }, (_, ci) => {
                const isHighlighted = selectedParsed?.col === ci;
                const w = colWidths[ci] || 90;
                return (
                  <th
                    key={ci}
                    className="text-center py-1 font-normal relative"
                    style={{
                      minWidth: `${w}px`,
                      width: `${w}px`,
                      backgroundColor: isHighlighted ? 'var(--accent-muted)' : 'var(--surface-1)',
                      border: '1px solid var(--border-subtle)',
                      color: isHighlighted ? 'var(--accent)' : 'var(--text-muted)',
                    }}>
                    <span
                      onClick={() => setSortCol(prev => prev?.col === ci ? { col: ci, asc: !prev.asc } : { col: ci, asc: true })}
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                      {colLabel(ci)}
                      {sortCol?.col === ci && (
                        <span style={{ marginLeft: '2px', fontSize: '8px' }}>{sortCol.asc ? '▲' : '▼'}</span>
                      )}
                    </span>
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setResizingCol({ col: ci, startX: e.clientX, startWidth: w });
                      }}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '4px',
                        cursor: 'col-resize',
                      }}
                    /></th>
                );
              })}</tr></thead>
          <tbody>
            {sortedRowIndices.map((ri, visualIdx) => {
              const isRowHighlighted = selectedParsed?.row === ri;
              const isAlternate = visualIdx % 2 === 1;
              return (
              <tr key={ri} style={{ backgroundColor: isAlternate ? 'var(--fg-3)' : 'transparent' }}>
                <td
                  className="text-center py-0.5 font-normal sticky left-0 z-10 text-xs"
                  style={{
                    backgroundColor: isRowHighlighted ? 'var(--accent-muted)' : 'var(--surface-1)',
                    border: '1px solid var(--border-subtle)',
                    color: isRowHighlighted ? 'var(--accent)' : 'var(--text-muted)',
                  }}>
                  {ri + 1}</td>
                {Array.from({ length: cols }, (_, ci) => {
                  const ref = cellRefStr(ri, ci);
                  const cell = cells[ref];
                  const isSelected = ref === selectedCell;
                  const isEditing = ref === editingCell;
                  const inRange = isInRange(ref);

                  // Conditional formatting: negative numbers in red, formulas in accent
                  let cellColor = 'var(--text-muted)';
                  if (cell) {
                    if (cell.f) {
                      const computed = getComputedValue(ref);
                      if (typeof computed === 'number' && computed < 0) cellColor = 'var(--danger)';
                      else cellColor = 'var(--accent)';
                    } else if (cell.t === 'n' && typeof cell.v === 'number' && cell.v < 0) {
                      cellColor = 'var(--danger)';
                    } else {
                      cellColor = 'var(--text-secondary)';
                    }
                  }

                  return (
                    <td
                      key={ci}
                      data-ref={ref}
                      onClick={() => handleCellClick(ref)}
                      onMouseDown={(e) => handleCellMouseDown(ref, e)}
                      onMouseEnter={() => handleCellMouseEnter(ref)}
                      onDoubleClick={() => handleCellDoubleClick(ref)}
                      onContextMenu={(e) => handleContextMenu(e, ref)}
                      className={`px-1.5 py-0.5 cursor-cell transition-colors relative
                        ${isSelected ? 'ring-2 ring-inset' : ''}
                        ${cell?.bold ? 'font-semibold' : ''}
                        ${cell?.t === 'n' || (cell?.f && typeof getComputedValue(ref) === 'number') ? 'text-right' : 'text-left'}
                      `}
                      style={{
                        border: '1px solid color-mix(in srgb, var(--border-subtle) 50%, transparent)',
                        color: cellColor,
                        ...(isSelected ? {
                          ringColor: 'var(--accent)',
                          boxShadow: 'inset 0 0 0 2px var(--accent)',
                          backgroundColor: 'color-mix(in srgb, var(--surface-2) 30%, transparent)',
                        } : {}),
                        ...(inRange && !isSelected ? {
                          backgroundColor: 'color-mix(in srgb, var(--accent-muted) 40%, transparent)',
                        } : {}),
                      }}>
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleEditComplete}
                          className="w-full bg-transparent outline-none font-mono"
                          style={{ color: 'var(--text-primary)' }}/>
                      ) : (
                        <>
                          <span className="block truncate">{formatValue(cell, ref)}</span>
                          {isSelected && !editingCell && (
                            <div style={{
                              position: 'absolute',
                              bottom: '-3px',
                              right: '-3px',
                              width: '6px',
                              height: '6px',
                              background: 'var(--accent)',
                              cursor: 'crosshair',
                              zIndex: 2,
                            }} />
                          )}
                        </>
                      )}
                    </td>);
                })}</tr>
              );
            })}</tbody></table></div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--surface-1)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            minWidth: '140px',
          }}
        >
          {contextMenuActions.map((item, i) => (
            item.label.startsWith('─') ? (
              <div key={i} style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />
            ) : (
              <button
                key={i}
                onClick={item.action}
                className="w-full text-left"
                style={{
                  padding: '6px 12px',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'block',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {item.label}
              </button>
            )
          ))}
        </div>
      )}

      {/* Status bar */}
      <div
        className="shrink-0 flex items-center justify-between"
        style={{
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--surface-1)',
          padding: '2px var(--space-3)',
          minHeight: '24px',
        }}>
        <div className="flex items-center" style={{ gap: 'var(--space-3)', fontSize: '10px', color: 'var(--text-muted)' }}>
          {selectedCell && cells[selectedCell] && (
            <>
              {cells[selectedCell]?.f && <span>Formula</span>}
              {cells[selectedCell]?.t === 'n' && <span>Number</span>}
              {cells[selectedCell]?.t === 's' && <span>Text</span>}
              {cells[selectedCell]?.bold && <span>Bold</span>}
              {cells[selectedCell]?.fmt && <span>Fmt: {cells[selectedCell].fmt}</span>}
            </>
          )}
          <span>{Object.keys(cells).length} cells</span>
        </div>
        <div className="flex items-center" style={{ gap: 'var(--space-3)', fontSize: '10px', color: 'var(--text-muted)' }}>
          {selectedStats && (
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              SUM: {selectedStats.sum.toLocaleString()} · AVG: {selectedStats.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })} · COUNT: {selectedStats.count}
            </span>
          )}
          <span>{editingCell ? 'Enter to confirm · Esc to cancel' : selectedCell ? 'Enter to edit · Arrows to navigate · ? for shortcuts' : 'Click a cell to start'}</span>
        </div>
      </div>

      {/* Sheet tabs */}
      {allSheets && allSheets.length > 1 && (
        <div
          className="shrink-0 flex items-center overflow-x-auto"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--surface-1)',
            padding: '0 var(--space-2)',
            minHeight: '30px',
            gap: '1px',
          }}>
          {allSheets.map(sheet => (
            <button
              key={sheet.name}
              onClick={() => onSheetChange?.(sheet.name)}
              className="shrink-0"
              style={{
                padding: '4px 12px',
                fontSize: 'var(--font-size-xs)',
                background: sheet.name === displaySheetName ? 'var(--surface-0)' : 'transparent',
                color: sheet.name === displaySheetName ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                borderBottom: sheet.name === displaySheetName ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (sheet.name !== displaySheetName) {
                  (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                }
              }}
              onMouseLeave={e => {
                if (sheet.name !== displaySheetName) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                }
              }}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface-1)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              padding: 'var(--space-6)',
              maxWidth: '420px',
              width: '90%',
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Keyboard Shortcuts</span>
              <button onClick={() => setShowShortcuts(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px' }}>&times;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: 'var(--font-size-xs)' }}>
              {[
                ['Enter', 'Edit / Confirm'],
                ['Escape', 'Cancel editing'],
                ['Tab / Shift+Tab', 'Next / Previous cell'],
                ['Arrow keys', 'Navigate cells'],
                ['Type any key', 'Start editing'],
                ['Delete', 'Clear cell'],
                ['Cmd/Ctrl+C', 'Copy cell'],
                ['Cmd/Ctrl+V', 'Paste cell'],
                ['Double-click', 'Edit cell'],
                ['Right-click', 'Context menu'],
                ['Click+Drag', 'Select range'],
                ['Cmd/Ctrl+Z', 'Undo'],
                ['Cmd/Ctrl+Shift+Z', 'Redo'],
                ['?', 'Toggle this help'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center" style={{ gap: '8px' }}>
                  <kbd style={{
                    background: 'var(--surface-2)',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    whiteSpace: 'nowrap',
                  }}>{key}</kbd>
                  <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>);
}
