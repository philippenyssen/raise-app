'use client';

import { useState, useEffect, useCallback } from 'react';
import { SplitPane } from '@/components/workspace/split-pane';
import { ExcelViewer, type CellData } from '@/components/workspace/excel-viewer';
import { AIChat } from '@/components/workspace/ai-chat';
import { useToast } from '@/components/toast';
import { Plus, Save, Table, Trash2 } from 'lucide-react';

interface ModelSheet {
  id: string;
  model_id: string;
  sheet_name: string;
  sheet_order: number;
  data: string;
  created_at: string;
  updated_at: string;
}

// Default sheets for a Series C financial model
const DEFAULT_SHEETS = [
  {
    name: 'Assumptions',
    cells: {
      'A1': { v: 'ASSUMPTIONS', bold: true, bg: 'bg-zinc-800' },
      'A3': { v: 'Revenue Assumptions', bold: true },
      'A4': { v: 'Revenue Growth Rate (YoY)' },
      'B3': { v: '2025A', bold: true, bg: 'bg-zinc-800' },
      'C3': { v: '2026E', bold: true, bg: 'bg-zinc-800' },
      'D3': { v: '2027E', bold: true, bg: 'bg-zinc-800' },
      'E3': { v: '2028E', bold: true, bg: 'bg-zinc-800' },
      'F3': { v: '2029E', bold: true, bg: 'bg-zinc-800' },
      'G3': { v: '2030E', bold: true, bg: 'bg-zinc-800' },
      'A5': { v: 'Units Sold' },
      'A6': { v: 'Avg Price per Unit (€M)' },
      'A7': { v: 'Win Rate (%)' },
      'A9': { v: 'Cost Assumptions', bold: true },
      'A10': { v: 'COGS (% of Revenue)' },
      'A11': { v: 'R&D (% of Revenue)' },
      'A12': { v: 'SG&A (% of Revenue)' },
      'A14': { v: 'Valuation Assumptions', bold: true },
      'A15': { v: 'Pre-Money (€M)' },
      'A16': { v: 'Equity Raise (€M)' },
      'A17': { v: 'Post-Money (€M)' },
      'A18': { v: 'Exit Multiple (EV/Revenue)' },
    } as Record<string, CellData>,
  },
  {
    name: 'P&L',
    cells: {
      'A1': { v: 'PROFIT & LOSS', bold: true, bg: 'bg-zinc-800' },
      'B1': { v: '2025A', bold: true, bg: 'bg-zinc-800' },
      'C1': { v: '2026E', bold: true, bg: 'bg-zinc-800' },
      'D1': { v: '2027E', bold: true, bg: 'bg-zinc-800' },
      'E1': { v: '2028E', bold: true, bg: 'bg-zinc-800' },
      'F1': { v: '2029E', bold: true, bg: 'bg-zinc-800' },
      'G1': { v: '2030E', bold: true, bg: 'bg-zinc-800' },
      'A3': { v: 'Revenue', bold: true },
      'A4': { v: 'COGS' },
      'A5': { v: 'Gross Profit', bold: true },
      'A6': { v: 'Gross Margin %' },
      'A8': { v: 'R&D' },
      'A9': { v: 'SG&A' },
      'A10': { v: 'Other Opex' },
      'A11': { v: 'Total Opex' },
      'A13': { v: 'EBITDA', bold: true },
      'A14': { v: 'EBITDA Margin %' },
      'A16': { v: 'D&A' },
      'A17': { v: 'EBIT', bold: true },
      'A19': { v: 'Interest' },
      'A20': { v: 'Tax' },
      'A21': { v: 'Net Income', bold: true },
    } as Record<string, CellData>,
  },
  {
    name: 'Revenue Bridge',
    cells: {
      'A1': { v: 'REVENUE BRIDGE', bold: true, bg: 'bg-zinc-800' },
      'B1': { v: '2025A', bold: true, bg: 'bg-zinc-800' },
      'C1': { v: '2026E', bold: true, bg: 'bg-zinc-800' },
      'D1': { v: '2027E', bold: true, bg: 'bg-zinc-800' },
      'E1': { v: '2028E', bold: true, bg: 'bg-zinc-800' },
      'F1': { v: '2029E', bold: true, bg: 'bg-zinc-800' },
      'G1': { v: '2030E', bold: true, bg: 'bg-zinc-800' },
      'A3': { v: 'Segment 1: Core Product' },
      'A4': { v: '  Units' },
      'A5': { v: '  Price (€M)' },
      'A6': { v: '  Revenue (€M)' },
      'A8': { v: 'Segment 2: Services' },
      'A9': { v: '  Contracts' },
      'A10': { v: '  Avg Value (€M)' },
      'A11': { v: '  Revenue (€M)' },
      'A13': { v: 'Segment 3: Other' },
      'A14': { v: '  Revenue (€M)' },
      'A16': { v: 'Total Revenue (€M)', bold: true },
      'A17': { v: 'YoY Growth %' },
    } as Record<string, CellData>,
  },
  {
    name: 'Cash Flow',
    cells: {
      'A1': { v: 'CASH FLOW', bold: true, bg: 'bg-zinc-800' },
      'B1': { v: '2025A', bold: true, bg: 'bg-zinc-800' },
      'C1': { v: '2026E', bold: true, bg: 'bg-zinc-800' },
      'D1': { v: '2027E', bold: true, bg: 'bg-zinc-800' },
      'E1': { v: '2028E', bold: true, bg: 'bg-zinc-800' },
      'A3': { v: 'EBITDA' },
      'A4': { v: 'Change in WC' },
      'A5': { v: 'Tax Paid' },
      'A6': { v: 'Operating Cash Flow', bold: true },
      'A8': { v: 'Capex' },
      'A9': { v: 'Acquisitions' },
      'A10': { v: 'Investing Cash Flow', bold: true },
      'A12': { v: 'Equity Raise' },
      'A13': { v: 'Debt Drawn / (Repaid)' },
      'A14': { v: 'Financing Cash Flow', bold: true },
      'A16': { v: 'Net Cash Flow', bold: true },
      'A17': { v: 'Opening Cash' },
      'A18': { v: 'Closing Cash', bold: true },
    } as Record<string, CellData>,
  },
  {
    name: 'Returns',
    cells: {
      'A1': { v: 'INVESTOR RETURNS', bold: true, bg: 'bg-zinc-800' },
      'A3': { v: 'Entry', bold: true },
      'A4': { v: 'Pre-Money (€M)' },
      'A5': { v: 'Investment (€M)' },
      'A6': { v: 'Post-Money (€M)' },
      'A7': { v: 'Ownership %' },
      'A9': { v: 'Exit Scenarios', bold: true },
      'B9': { v: 'Bear', bold: true, bg: 'bg-zinc-800' },
      'C9': { v: 'Base', bold: true, bg: 'bg-zinc-800' },
      'D9': { v: 'Bull', bold: true, bg: 'bg-zinc-800' },
      'A10': { v: 'Exit Year' },
      'A11': { v: 'Revenue at Exit (€M)' },
      'A12': { v: 'Exit Multiple (EV/Rev)' },
      'A13': { v: 'Enterprise Value (€M)' },
      'A14': { v: 'Equity Value (€M)' },
      'A15': { v: 'Investor Share (€M)' },
      'A17': { v: 'MOIC', bold: true },
      'A18': { v: 'IRR', bold: true },
    } as Record<string, CellData>,
  },
  {
    name: 'Scenarios',
    cells: {
      'A1': { v: 'SCENARIO ANALYSIS', bold: true, bg: 'bg-zinc-800' },
      'B1': { v: 'Bear', bold: true, bg: 'bg-red-900/30' },
      'C1': { v: 'Base', bold: true, bg: 'bg-zinc-800' },
      'D1': { v: 'Bull', bold: true, bg: 'bg-green-900/30' },
      'A3': { v: 'Revenue Assumptions' },
      'A4': { v: 'Growth Rate 2026E' },
      'A5': { v: 'Growth Rate 2027E' },
      'A6': { v: 'Growth Rate 2028E' },
      'A7': { v: 'Revenue 2030E (€M)' },
      'A9': { v: 'Margin Assumptions' },
      'A10': { v: 'Gross Margin 2030E' },
      'A11': { v: 'EBITDA Margin 2030E' },
      'A13': { v: 'Valuation' },
      'A14': { v: 'Exit Multiple' },
      'A15': { v: 'EV 2030E (€M)' },
      'A17': { v: 'Returns', bold: true },
      'A18': { v: 'MOIC' },
      'A19': { v: 'IRR' },
    } as Record<string, CellData>,
  },
];

export default function ModelPage() {
  const { toast } = useToast();
  const [sheets, setSheets] = useState<ModelSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [localCells, setLocalCells] = useState<Record<string, CellData>>({});

  const fetchSheets = useCallback(async () => {
    const res = await fetch('/api/model');
    const data = await res.json();
    setSheets(data);
    if (data.length > 0 && !activeSheetId) {
      setActiveSheetId(data[0].id);
      try { setLocalCells(JSON.parse(data[0].data)); } catch { setLocalCells({}); }
    }
    setLoading(false);
  }, [activeSheetId]);

  useEffect(() => { fetchSheets(); }, [fetchSheets]);

  const selectSheet = useCallback((sheet: ModelSheet) => {
    if (dirty) {
      if (!confirm('Unsaved changes. Discard?')) return;
    }
    setActiveSheetId(sheet.id);
    try { setLocalCells(JSON.parse(sheet.data)); } catch { setLocalCells({}); }
    setDirty(false);
  }, [dirty]);

  const handleCellChange = useCallback((cellRef: string, value: string, formula?: string) => {
    setLocalCells(prev => ({
      ...prev,
      [cellRef]: {
        v: formula ? value : (isNaN(Number(value)) ? value : Number(value)),
        f: formula,
        t: !formula && !isNaN(Number(value)) ? 'n' : 's',
      },
    }));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeSheetId || !dirty) return;
    setSaving(true);
    await fetch('/api/model', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeSheetId, data: JSON.stringify(localCells) }),
    });
    setDirty(false);
    setSaving(false);
    toast('Sheet saved');
    fetchSheets();
  }, [activeSheetId, dirty, localCells, toast, fetchSheets]);

  const initializeDefaultSheets = useCallback(async () => {
    for (let i = 0; i < DEFAULT_SHEETS.length; i++) {
      await fetch('/api/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet_name: DEFAULT_SHEETS[i].name,
          sheet_order: i,
          data: DEFAULT_SHEETS[i].cells,
        }),
      });
    }
    toast('Model initialized with default sheets');
    await fetchSheets();
  }, [toast, fetchSheets]);

  const addSheet = useCallback(async () => {
    const name = prompt('Sheet name:');
    if (!name) return;
    await fetch('/api/model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet_name: name,
        sheet_order: sheets.length,
        data: {},
      }),
    });
    toast(`Added sheet "${name}"`);
    fetchSheets();
  }, [sheets.length, toast, fetchSheets]);

  const deleteSheet = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete sheet "${name}"?`)) return;
    await fetch(`/api/model?id=${id}`, { method: 'DELETE' });
    if (activeSheetId === id) {
      setActiveSheetId(null);
      setLocalCells({});
    }
    toast(`Deleted "${name}"`, 'warning');
    fetchSheets();
  }, [activeSheetId, toast, fetchSheets]);

  // Cmd/Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const activeSheet = sheets.find(s => s.id === activeSheetId);

  // Build a string representation of the active sheet for AI context
  const modelContext = activeSheet
    ? `Sheet: ${activeSheet.sheet_name}\nCells:\n${Object.entries(localCells).map(([ref, cell]) => `${ref}: ${cell.f || cell.v}`).join('\n')}`
    : 'No sheet selected';

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-zinc-600 text-sm">Loading model...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] -mx-6 -my-8 flex flex-col">
      {/* Sheet tabs + toolbar */}
      <div className="shrink-0 border-b border-zinc-800 flex items-center bg-zinc-950">
        <div className="flex-1 flex items-center overflow-x-auto">
          {sheets.map(sheet => (
            <div
              key={sheet.id}
              className={`group flex items-center gap-1 px-4 py-2 text-sm cursor-pointer border-r border-zinc-800 transition-colors ${
                sheet.id === activeSheetId
                  ? 'bg-zinc-800/50 text-white font-medium border-b-2 border-b-blue-500'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
              }`}
              onClick={() => selectSheet(sheet)}
            >
              <span className="truncate max-w-[120px]">{sheet.sheet_name}</span>
              <button
                onClick={e => { e.stopPropagation(); deleteSheet(sheet.id, sheet.sheet_name); }}
                className="hidden group-hover:block text-zinc-600 hover:text-red-400 ml-1"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={addSheet}
            className="px-3 py-2 text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Add sheet"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 px-3 shrink-0">
          {sheets.length === 0 && (
            <button
              onClick={initializeDefaultSheets}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Table className="w-3.5 h-3.5" /> Initialize Model
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              dirty ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-600'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Split pane: Excel viewer + AI chat */}
      <div className="flex-1">
        {activeSheet ? (
          <SplitPane
            left={
              <ExcelViewer
                cells={localCells}
                onCellChange={handleCellChange}
                rows={40}
                cols={12}
              />
            }
            right={
              <AIChat
                documentId={activeSheet.id}
                documentContent={modelContext}
                documentTitle={`Financial Model — ${activeSheet.sheet_name}`}
              />
            }
            defaultSplit={65}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-600">
            <div className="text-center space-y-4">
              <Table className="w-12 h-12 mx-auto" />
              <p className="text-sm">{sheets.length === 0 ? 'No model yet. Click "Initialize Model" to create default sheets.' : 'Select a sheet to start editing.'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
