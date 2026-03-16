'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { SplitPane } from '@/components/workspace/split-pane';
import { type CellData, type SheetData } from '@/components/workspace/excel-viewer';

const ExcelViewer = dynamic(() => import('@/components/workspace/excel-viewer').then(m => ({ default: m.ExcelViewer })), { ssr: false });
const AIChat = dynamic(() => import('@/components/workspace/ai-chat').then(m => ({ default: m.AIChat })), { ssr: false });
import { useToast } from '@/components/toast';
import { ConfirmModal, InputModal } from '@/components/ui/confirm-modal';
import { Plus, Save, Table, Trash2 } from 'lucide-react';
import { stTextTertiary } from '@/lib/styles';
import { EmptyState } from '@/components/ui/empty-state';
import { cachedFetch } from '@/lib/cache';

interface ModelSheet {
  id: string;
  model_id: string;
  sheet_name: string;
  sheet_order: number;
  data: string;
  created_at: string;
  updated_at: string;
}

const sheetTabBase: React.CSSProperties = { borderRight: '1px solid var(--border-subtle)' };
const sheetTabActive: React.CSSProperties = { ...sheetTabBase, backgroundColor: 'var(--surface-2)', color: 'var(--text-primary)', fontWeight: 400, borderBottom: '2px solid var(--accent)' };
const sheetTabInactive: React.CSSProperties = { ...sheetTabBase, color: 'var(--text-muted)' };
const saveBtnDirty: React.CSSProperties = { backgroundColor: 'var(--accent)', color: 'var(--text-primary)' };
const saveBtnClean: React.CSSProperties = { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' };
const sheetHeaderStyle: React.CSSProperties = { borderBottom: '1px solid var(--border-default)', backgroundColor: 'var(--surface-0)' };
const loadingSkeletonTabStyle: React.CSSProperties = { height: '40px', marginBottom: 'var(--space-2)' };
const loadingSkeletonMainStyle: React.CSSProperties = { borderRadius: 'var(--radius-md)' };
const initBtnStyle: React.CSSProperties = { backgroundColor: 'var(--accent)', color: 'var(--text-primary)' };

// Default sheets for a Series C financial model
// Blue font = input assumptions, formulas flow through automatically
const DEFAULT_SHEETS = [
  {
    name: 'Assumptions',
    cells: {
      'A1': { v: 'ASSUMPTIONS', bold: true, bg: 'var(--surface-2)' },
      'B1': { v: '2025A', bold: true, bg: 'var(--surface-2)' },
      'C1': { v: '2026E', bold: true, bg: 'var(--surface-2)' },
      'D1': { v: '2027E', bold: true, bg: 'var(--surface-2)' },
      'E1': { v: '2028E', bold: true, bg: 'var(--surface-2)' },
      'F1': { v: '2029E', bold: true, bg: 'var(--surface-2)' },
      'G1': { v: '2030E', bold: true, bg: 'var(--surface-2)' },
      // Revenue inputs
      'A3': { v: 'Segment 1: Core Product', bold: true },
      'A4': { v: '  Units', t: 's' }, 'B4': { v: 10, t: 'n' }, 'C4': { v: 20, t: 'n' }, 'D4': { v: 35, t: 'n' }, 'E4': { v: 55, t: 'n' }, 'F4': { v: 80, t: 'n' }, 'G4': { v: 100, t: 'n' },
      'A5': { v: '  Price (€M)', t: 's' }, 'B5': { v: 2.0, t: 'n' }, 'C5': { v: 2.0, t: 'n' }, 'D5': { v: 2.1, t: 'n' }, 'E5': { v: 2.2, t: 'n' }, 'F5': { v: 2.3, t: 'n' }, 'G5': { v: 2.4, t: 'n' },
      'A6': { v: '  Win Rate (%)', t: 's' }, 'B6': { v: 1.0, t: 'n' }, 'C6': { v: 1.0, t: 'n' }, 'D6': { v: 0.9, t: 'n' }, 'E6': { v: 0.85, t: 'n' }, 'F6': { v: 0.8, t: 'n' }, 'G6': { v: 0.8, t: 'n' },
      'A7': { v: '  Revenue (€M)', bold: true, t: 's' },
      'B7': { v: 20, f: '=B4*B5*B6', t: 'n' }, 'C7': { v: 40, f: '=C4*C5*C6', t: 'n' }, 'D7': { v: 66, f: '=D4*D5*D6', t: 'n' }, 'E7': { v: 103, f: '=E4*E5*E6', t: 'n' }, 'F7': { v: 147, f: '=F4*F5*F6', t: 'n' }, 'G7': { v: 192, f: '=G4*G5*G6', t: 'n' },
      // Segment 2
      'A9': { v: 'Segment 2: Services', bold: true },
      'A10': { v: '  Contracts', t: 's' }, 'B10': { v: 5, t: 'n' }, 'C10': { v: 8, t: 'n' }, 'D10': { v: 12, t: 'n' }, 'E10': { v: 18, t: 'n' }, 'F10': { v: 25, t: 'n' }, 'G10': { v: 30, t: 'n' },
      'A11': { v: '  Avg Value (€M)', t: 's' }, 'B11': { v: 1.5, t: 'n' }, 'C11': { v: 1.8, t: 'n' }, 'D11': { v: 2.0, t: 'n' }, 'E11': { v: 2.2, t: 'n' }, 'F11': { v: 2.5, t: 'n' }, 'G11': { v: 2.8, t: 'n' },
      'A12': { v: '  Revenue (€M)', bold: true, t: 's' },
      'B12': { v: 7.5, f: '=B10*B11', t: 'n' }, 'C12': { v: 14, f: '=C10*C11', t: 'n' }, 'D12': { v: 24, f: '=D10*D11', t: 'n' }, 'E12': { v: 40, f: '=E10*E11', t: 'n' }, 'F12': { v: 63, f: '=F10*F11', t: 'n' }, 'G12': { v: 84, f: '=G10*G11', t: 'n' },
      // Segment 3
      'A14': { v: 'Segment 3: Other', bold: true },
      'A15': { v: '  Revenue (€M)', t: 's' }, 'B15': { v: 3, t: 'n' }, 'C15': { v: 5, t: 'n' }, 'D15': { v: 8, t: 'n' }, 'E15': { v: 12, t: 'n' }, 'F15': { v: 18, t: 'n' }, 'G15': { v: 25, t: 'n' },
      // Total Revenue
      'A17': { v: 'TOTAL REVENUE (€M)', bold: true },
      'B17': { v: 30.5, f: '=B7+B12+B15', t: 'n' }, 'C17': { v: 59, f: '=C7+C12+C15', t: 'n' }, 'D17': { v: 98, f: '=D7+D12+D15', t: 'n' }, 'E17': { v: 155, f: '=E7+E12+E15', t: 'n' }, 'F17': { v: 228, f: '=F7+F12+F15', t: 'n' }, 'G17': { v: 301, f: '=G7+G12+G15', t: 'n' },
      'A18': { v: 'YoY Growth %', t: 's' },
      'C18': { v: 0.93, f: '=C17/B17-1', t: 'n', fmt: '%' }, 'D18': { v: 0.66, f: '=D17/C17-1', t: 'n', fmt: '%' }, 'E18': { v: 0.58, f: '=E17/D17-1', t: 'n', fmt: '%' }, 'F18': { v: 0.47, f: '=F17/E17-1', t: 'n', fmt: '%' }, 'G18': { v: 0.32, f: '=G17/F17-1', t: 'n', fmt: '%' },
      // Cost assumptions
      'A20': { v: 'Cost Assumptions', bold: true },
      'A21': { v: 'COGS (% of Revenue)' }, 'B21': { v: 0.55, t: 'n', fmt: '%' }, 'C21': { v: 0.50, t: 'n', fmt: '%' }, 'D21': { v: 0.45, t: 'n', fmt: '%' }, 'E21': { v: 0.42, t: 'n', fmt: '%' }, 'F21': { v: 0.40, t: 'n', fmt: '%' }, 'G21': { v: 0.38, t: 'n', fmt: '%' },
      'A22': { v: 'R&D (% of Revenue)' }, 'B22': { v: 0.25, t: 'n', fmt: '%' }, 'C22': { v: 0.22, t: 'n', fmt: '%' }, 'D22': { v: 0.18, t: 'n', fmt: '%' }, 'E22': { v: 0.15, t: 'n', fmt: '%' }, 'F22': { v: 0.13, t: 'n', fmt: '%' }, 'G22': { v: 0.12, t: 'n', fmt: '%' },
      'A23': { v: 'SG&A (% of Revenue)' }, 'B23': { v: 0.20, t: 'n', fmt: '%' }, 'C23': { v: 0.18, t: 'n', fmt: '%' }, 'D23': { v: 0.15, t: 'n', fmt: '%' }, 'E23': { v: 0.13, t: 'n', fmt: '%' }, 'F23': { v: 0.11, t: 'n', fmt: '%' }, 'G23': { v: 0.10, t: 'n', fmt: '%' },
      // Valuation
      'A25': { v: 'Valuation', bold: true },
      'A26': { v: 'Pre-Money (€M)' }, 'B26': { v: 500, t: 'n' },
      'A27': { v: 'Equity Raise (€M)' }, 'B27': { v: 100, t: 'n' },
      'A28': { v: 'Post-Money (€M)', bold: true }, 'B28': { v: 600, f: '=B26+B27', t: 'n' },
      'A29': { v: 'Ownership %' }, 'B29': { v: 0.167, f: '=B27/B28', t: 'n', fmt: '%' },
    } as Record<string, CellData>,},
  {
    name: 'P&L',
    cells: {
      'A1': { v: 'PROFIT & LOSS (€M)', bold: true, bg: 'var(--surface-2)' },
      'B1': { v: '2025A', bold: true, bg: 'var(--surface-2)' },
      'C1': { v: '2026E', bold: true, bg: 'var(--surface-2)' },
      'D1': { v: '2027E', bold: true, bg: 'var(--surface-2)' },
      'E1': { v: '2028E', bold: true, bg: 'var(--surface-2)' },
      'F1': { v: '2029E', bold: true, bg: 'var(--surface-2)' },
      'G1': { v: '2030E', bold: true, bg: 'var(--surface-2)' },
      'A3': { v: 'Revenue', bold: true, t: 's' },
      'B3': { v: 30.5, t: 'n' }, 'C3': { v: 59, t: 'n' }, 'D3': { v: 98, t: 'n' }, 'E3': { v: 155, t: 'n' }, 'F3': { v: 228, t: 'n' }, 'G3': { v: 301, t: 'n' },
      'A4': { v: 'COGS', t: 's' },
      'B4': { v: -16.8, f: '=-B3*0.55', t: 'n' }, 'C4': { v: -29.5, f: '=-C3*0.50', t: 'n' }, 'D4': { v: -44.1, f: '=-D3*0.45', t: 'n' }, 'E4': { v: -65.1, f: '=-E3*0.42', t: 'n' }, 'F4': { v: -91.2, f: '=-F3*0.40', t: 'n' }, 'G4': { v: -114.4, f: '=-G3*0.38', t: 'n' },
      'A5': { v: 'Gross Profit', bold: true, t: 's' },
      'B5': { v: 13.7, f: '=B3+B4', t: 'n' }, 'C5': { v: 29.5, f: '=C3+C4', t: 'n' }, 'D5': { v: 53.9, f: '=D3+D4', t: 'n' }, 'E5': { v: 89.9, f: '=E3+E4', t: 'n' }, 'F5': { v: 136.8, f: '=F3+F4', t: 'n' }, 'G5': { v: 186.6, f: '=G3+G4', t: 'n' },
      'A6': { v: 'Gross Margin %', t: 's' },
      'B6': { v: 0.45, f: '=B5/B3', t: 'n', fmt: '%' }, 'C6': { v: 0.50, f: '=C5/C3', t: 'n', fmt: '%' }, 'D6': { v: 0.55, f: '=D5/D3', t: 'n', fmt: '%' }, 'E6': { v: 0.58, f: '=E5/E3', t: 'n', fmt: '%' }, 'F6': { v: 0.60, f: '=F5/F3', t: 'n', fmt: '%' }, 'G6': { v: 0.62, f: '=G5/G3', t: 'n', fmt: '%' },
      'A8': { v: 'R&D', t: 's' },
      'B8': { v: -7.6, f: '=-B3*0.25', t: 'n' }, 'C8': { v: -13.0, f: '=-C3*0.22', t: 'n' }, 'D8': { v: -17.6, f: '=-D3*0.18', t: 'n' }, 'E8': { v: -23.3, f: '=-E3*0.15', t: 'n' }, 'F8': { v: -29.6, f: '=-F3*0.13', t: 'n' }, 'G8': { v: -36.1, f: '=-G3*0.12', t: 'n' },
      'A9': { v: 'SG&A', t: 's' },
      'B9': { v: -6.1, f: '=-B3*0.20', t: 'n' }, 'C9': { v: -10.6, f: '=-C3*0.18', t: 'n' }, 'D9': { v: -14.7, f: '=-D3*0.15', t: 'n' }, 'E9': { v: -20.2, f: '=-E3*0.13', t: 'n' }, 'F9': { v: -25.1, f: '=-F3*0.11', t: 'n' }, 'G9': { v: -30.1, f: '=-G3*0.10', t: 'n' },
      'A10': { v: 'Total Opex', bold: true, t: 's' },
      'B10': { v: -13.7, f: '=B8+B9', t: 'n' }, 'C10': { v: -23.6, f: '=C8+C9', t: 'n' }, 'D10': { v: -32.3, f: '=D8+D9', t: 'n' }, 'E10': { v: -43.5, f: '=E8+E9', t: 'n' }, 'F10': { v: -54.7, f: '=F8+F9', t: 'n' }, 'G10': { v: -66.2, f: '=G8+G9', t: 'n' },
      'A12': { v: 'EBITDA', bold: true, t: 's' },
      'B12': { v: 0, f: '=B5+B10', t: 'n' }, 'C12': { v: 5.9, f: '=C5+C10', t: 'n' }, 'D12': { v: 21.6, f: '=D5+D10', t: 'n' }, 'E12': { v: 46.4, f: '=E5+E10', t: 'n' }, 'F12': { v: 82.1, f: '=F5+F10', t: 'n' }, 'G12': { v: 120.4, f: '=G5+G10', t: 'n' },
      'A13': { v: 'EBITDA Margin %', t: 's' },
      'B13': { v: 0, f: '=B12/B3', t: 'n', fmt: '%' }, 'C13': { v: 0.10, f: '=C12/C3', t: 'n', fmt: '%' }, 'D13': { v: 0.22, f: '=D12/D3', t: 'n', fmt: '%' }, 'E13': { v: 0.30, f: '=E12/E3', t: 'n', fmt: '%' }, 'F13': { v: 0.36, f: '=F12/F3', t: 'n', fmt: '%' }, 'G13': { v: 0.40, f: '=G12/G3', t: 'n', fmt: '%' },
    } as Record<string, CellData>,},
  {
    name: 'Returns',
    cells: {
      'A1': { v: 'INVESTOR RETURNS', bold: true, bg: 'var(--surface-2)' },
      'A3': { v: 'Entry', bold: true },
      'A4': { v: 'Pre-Money (€M)' }, 'B4': { v: 500, t: 'n' },
      'A5': { v: 'Investment (€M)' }, 'B5': { v: 100, t: 'n' },
      'A6': { v: 'Post-Money (€M)', bold: true }, 'B6': { v: 600, f: '=B4+B5', t: 'n' },
      'A7': { v: 'Ownership %' }, 'B7': { v: 0.167, f: '=B5/B6', t: 'n', fmt: '%' },
      'A9': { v: 'Exit Scenarios', bold: true },
      'B9': { v: 'Bear', bold: true, bg: 'var(--danger-muted)' },
      'C9': { v: 'Base', bold: true, bg: 'var(--surface-2)' },
      'D9': { v: 'Bull', bold: true, bg: 'var(--success-muted)' },
      'A10': { v: 'Exit Year' }, 'B10': { v: 2030, t: 'n' }, 'C10': { v: 2030, t: 'n' }, 'D10': { v: 2030, t: 'n' },
      'A11': { v: 'Revenue at Exit (€M)' }, 'B11': { v: 180, t: 'n' }, 'C11': { v: 301, t: 'n' }, 'D11': { v: 500, t: 'n' },
      'A12': { v: 'Exit Multiple (EV/Rev)' }, 'B12': { v: 5, t: 'n' }, 'C12': { v: 8, t: 'n' }, 'D12': { v: 12, t: 'n' },
      'A13': { v: 'Enterprise Value (€M)' },
      'B13': { v: 900, f: '=B11*B12', t: 'n' }, 'C13': { v: 2408, f: '=C11*C12', t: 'n' }, 'D13': { v: 6000, f: '=D11*D12', t: 'n' },
      'A14': { v: 'Investor Share (€M)' },
      'B14': { v: 150, f: '=B13*$B$7', t: 'n' }, 'C14': { v: 402, f: '=C13*$B$7', t: 'n' }, 'D14': { v: 1000, f: '=D13*$B$7', t: 'n' },
      'A16': { v: 'MOIC', bold: true },
      'B16': { v: 1.5, f: '=B14/$B$5', t: 'n' }, 'C16': { v: 4.0, f: '=C14/$B$5', t: 'n' }, 'D16': { v: 10.0, f: '=D14/$B$5', t: 'n' },
    } as Record<string, CellData>,},
  {
    name: 'Scenarios',
    cells: {
      'A1': { v: 'SCENARIO ANALYSIS', bold: true, bg: 'var(--surface-2)' },
      'B1': { v: 'Bear', bold: true, bg: 'var(--danger-muted)' },
      'C1': { v: 'Base', bold: true, bg: 'var(--surface-2)' },
      'D1': { v: 'Bull', bold: true, bg: 'var(--success-muted)' },
      'A3': { v: 'Revenue 2030E (€M)' }, 'B3': { v: 180, t: 'n' }, 'C3': { v: 301, t: 'n' }, 'D3': { v: 500, t: 'n' },
      'A4': { v: 'Gross Margin 2030E' }, 'B4': { v: 0.50, t: 'n', fmt: '%' }, 'C4': { v: 0.62, t: 'n', fmt: '%' }, 'D4': { v: 0.68, t: 'n', fmt: '%' },
      'A5': { v: 'EBITDA Margin 2030E' }, 'B5': { v: 0.25, t: 'n', fmt: '%' }, 'C5': { v: 0.40, t: 'n', fmt: '%' }, 'D5': { v: 0.48, t: 'n', fmt: '%' },
      'A6': { v: 'Exit Multiple' }, 'B6': { v: 5, t: 'n' }, 'C6': { v: 8, t: 'n' }, 'D6': { v: 12, t: 'n' },
      'A7': { v: 'EV 2030E (€M)', bold: true },
      'B7': { v: 900, f: '=B3*B6', t: 'n' }, 'C7': { v: 2408, f: '=C3*C6', t: 'n' }, 'D7': { v: 6000, f: '=D3*D6', t: 'n' },
      'A9': { v: 'Returns (€100M invested)', bold: true },
      'A10': { v: 'MOIC' },
      'B10': { v: 1.5, f: '=B7*0.167/100', t: 'n' }, 'C10': { v: 4.0, f: '=C7*0.167/100', t: 'n' }, 'D10': { v: 10.0, f: '=D7*0.167/100', t: 'n' },
    } as Record<string, CellData>,
  },];

export default function ModelPage() {
  const { toast } = useToast();
  const [sheets, setSheets] = useState<ModelSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [localCells, setLocalCells] = useState<Record<string, CellData>>({});
  const [confirmState, setConfirmState] = useState<{ type: 'discard' | 'delete'; target?: ModelSheet } | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);

  const fetchSheets = useCallback(async () => {
    try {
      const res = await cachedFetch('/api/model');
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setSheets(data);
      if (data.length > 0 && !activeSheetId) {
        setActiveSheetId(data[0].id);
        try { setLocalCells(JSON.parse(data[0].data)); } catch { setLocalCells({}); }
      }
    } catch (e) {
      console.warn('[MODEL_FETCH]', e instanceof Error ? e.message : e);
      toast('Couldn\'t load model — try refreshing the page', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeSheetId, toast]);

  useEffect(() => { document.title = 'Raise | Financial Model'; }, []);
  useEffect(() => { fetchSheets(); }, [fetchSheets]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowAddSheet(false); setConfirmState(null); return; }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchSheets(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fetchSheets]);

  const doSelectSheet = useCallback((sheet: ModelSheet) => {
    setActiveSheetId(sheet.id);
    try { setLocalCells(JSON.parse(sheet.data)); } catch { setLocalCells({}); }
    setDirty(false);
    setConfirmState(null);
  }, []);

  const selectSheet = useCallback((sheet: ModelSheet) => {
    if (dirty) {
      setConfirmState({ type: 'discard', target: sheet });
      return;
    }
    doSelectSheet(sheet);
  }, [dirty, doSelectSheet]);

  const handleCellChange = useCallback((cellRef: string, value: string, formula?: string) => {
    setLocalCells(prev => ({
      ...prev,
      [cellRef]: {
        v: formula ? value : (isNaN(Number(value)) ? value : Number(value)),
        f: formula,
        t: !formula && !isNaN(Number(value)) ? 'n' : 's',},
    }));
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!activeSheetId || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch('/api/model', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeSheetId, data: JSON.stringify(localCells) }),});
      if (!res.ok) throw new Error('Save failed');
      setDirty(false);
      toast('Sheet saved');
      fetchSheets();
    } catch (e) {
      console.warn('[MODEL_SAVE]', e instanceof Error ? e.message : e);
      toast('Couldn\'t save sheet — try again', 'error');
    } finally {
      setSaving(false);
    }
  }, [activeSheetId, dirty, localCells, toast, fetchSheets]);

  const initializeDefaultSheets = useCallback(async () => {
    for (let i = 0; i < DEFAULT_SHEETS.length; i++) {
      const res = await fetch('/api/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet_name: DEFAULT_SHEETS[i].name,
          sheet_order: i,
          data: DEFAULT_SHEETS[i].cells,
        }),});
      if (!res.ok) throw new Error(`Failed to create sheet ${DEFAULT_SHEETS[i].name}`);
    }
    toast('Model initialized with default sheets');
    await fetchSheets();
  }, [toast, fetchSheets]);

  const addSheet = useCallback(async (name: string) => {
    try {
      const res = await fetch('/api/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet_name: name,
          sheet_order: sheets.length,
          data: {},
        }),});
      if (!res.ok) throw new Error('Failed');
      toast(`Added sheet "${name}"`);
      setShowAddSheet(false);
      fetchSheets();
    } catch (e) { console.warn('[MODEL_ADD]', e instanceof Error ? e.message : e); toast('Couldn\'t add sheet — try again', 'error'); }
  }, [sheets.length, toast, fetchSheets]);

  const deleteSheet = useCallback(async (sheet: ModelSheet) => {
    setConfirmState({ type: 'delete', target: sheet });
  }, []);

  const doDeleteSheet = useCallback(async () => {
    if (!confirmState?.target) return;
    const { id, sheet_name } = confirmState.target;
    try {
      const res = await fetch(`/api/model?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      if (activeSheetId === id) {
        setActiveSheetId(null);
        setLocalCells({});
      }
      toast(`Deleted "${sheet_name}"`, 'warning');
      setConfirmState(null);
      fetchSheets();
    } catch (e) { console.warn('[MODEL_DELETE]', e instanceof Error ? e.message : e); toast('Couldn\'t delete sheet — try again', 'error'); }
  }, [confirmState, activeSheetId, toast, fetchSheets]);

  // Cmd/Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }};
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  const activeSheet = sheets.find(s => s.id === activeSheetId);

  // Build allSheets data for cross-sheet formula resolution in HyperFormula
  const allSheetsData: SheetData[] = useMemo(() => {
    return sheets.map(s => {
      let sheetCells: Record<string, CellData> = {};
      try { sheetCells = JSON.parse(s.data); } catch (e) { console.warn('[MODEL_PARSE]', s.sheet_name, e instanceof Error ? e.message : e); }
      return { name: s.sheet_name, cells: sheetCells };});
  }, [sheets]);

  // Build a structured representation of the active sheet for AI context
  const modelContext = activeSheet
    ? `Sheet: ${activeSheet.sheet_name}\nCells (ref: value [formula] [type]):\n${Object.entries(localCells).map(([ref, cell]) => {
        let line = `${ref}: ${cell.v}`;
        if (cell.f) line += ` [formula: ${cell.f}]`;
        if (cell.bold) line += ' [bold]';
        if (cell.fmt) line += ` [fmt: ${cell.fmt}]`;
        return line;
      }).join('\n')}\n\nWhen suggesting cell changes, wrap them in <cell_updates>[{"ref":"A1","value":"new value","formula":"=B1+C1"}]</cell_updates> tags. The formula field is optional.`
    : 'No sheet selected';

  const handleApplyModelChange = useCallback((responseText: string) => {
    const match = responseText.match(/<cell_updates>([\s\S]*?)<\/cell_updates>/);
    if (!match) return;
    try {
      const updates = JSON.parse(match[1]) as Array<{ ref: string; value: string | number; formula?: string }>;
      updates.forEach(({ ref, value, formula }) => {
        handleCellChange(ref, String(value), formula || undefined);});
      toast(`Applied ${updates.length} cell change${updates.length !== 1 ? 's' : ''}`);
    } catch (e) {
      console.warn('[MODEL_AI_CELLS]', e instanceof Error ? e.message : e);
      toast('Couldn\'t parse AI cell updates', 'error');
    }
  }, [handleCellChange, toast]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="skeleton" style={loadingSkeletonTabStyle} />
        <div className="flex-1 skeleton" style={loadingSkeletonMainStyle} />
      </div>);
  }

  return (
    <div className="page-content h-[calc(100vh-4rem)] -mx-6 -my-8 flex flex-col">
      {/* Sheet tabs + toolbar */}
      <div
        className="shrink-0 flex items-center"
        style={sheetHeaderStyle}>
        <div className="flex-1 flex items-center overflow-x-auto">
          {sheets.map(sheet => {
            const isActive = sheet.id === activeSheetId;
            return (
              <div
                key={sheet.id}
                className="group flex items-center gap-1 px-4 py-2 text-sm cursor-pointer transition-colors"
                style={isActive ? sheetTabActive : sheetTabInactive}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.color = 'var(--text-secondary)';
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--surface-1)';
                  } }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.color = 'var(--text-muted)';
                    (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent';
                  } }}
                onClick={() => selectSheet(sheet)}>
                <span className="truncate max-w-[120px]">{sheet.sheet_name}</span>
                <button
                  aria-label={`Delete sheet ${sheet}`}
                  onClick={e => { e.stopPropagation(); deleteSheet(sheet); }}
                  className="hidden group-hover:block ml-1"
                  style={stTextTertiary}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)'; }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'; }}>
                  <Trash2 className="w-3 h-3" /></button>
              </div>);
          })}
          <button
            onClick={() => setShowAddSheet(true)}
            className="px-3 py-2 transition-colors"
            title="Add sheet"
            style={stTextTertiary}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'; }}>
            <Plus className="w-4 h-4" /></button></div>
        <div className="flex items-center gap-2 px-3 shrink-0">
          {sheets.length === 0 && (
            <button
              onClick={initializeDefaultSheets}
              className="px-3 py-1.5 rounded-lg text-xs font-normal transition-colors flex items-center gap-1.5"
              style={initBtnStyle}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-muted)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent)'; }}>
              <Table className="w-3.5 h-3.5" /> Initialize Model</button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-normal transition-colors"
            style={dirty ? saveBtnDirty : saveBtnClean}
            onMouseEnter={e => {
              if (dirty) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-muted)';
              } }}
            onMouseLeave={e => {
              if (dirty) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent)';
              } }}>
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}</button></div></div>

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
                allSheets={allSheetsData}
                activeSheetName={activeSheet.sheet_name} />
            }
            right={
              <AIChat
                documentId={activeSheet.id}
                documentContent={modelContext}
                documentTitle={`Financial Model — ${activeSheet.sheet_name}`}
                onApplyChange={handleApplyModelChange} />
            }
            defaultSplit={65} />
        ) : (
          <EmptyState
            icon={Table}
            title={sheets.length === 0 ? 'Financial model not started' : 'Select a sheet'}
            description={sheets.length === 0 ? 'Click "Initialize Model" to create valuation, cap table, and scenario sheets.' : 'Select a sheet from the left panel to start editing.'} />
        )}</div>

      {/* Modals */}
      <ConfirmModal
        open={confirmState?.type === 'discard'}
        title="Unsaved changes"
        message="You have unsaved changes on this sheet. Discard them?"
        confirmLabel="Discard"
        variant="danger"
        onConfirm={() => { if (confirmState?.target) doSelectSheet(confirmState.target); }}
        onCancel={() => setConfirmState(null)} />
      <ConfirmModal
        open={confirmState?.type === 'delete'}
        title="Delete sheet"
        message={`Delete "${confirmState?.target?.sheet_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={doDeleteSheet}
        onCancel={() => setConfirmState(null)} />
      <InputModal
        open={showAddSheet}
        title="New sheet name"
        placeholder="e.g., SOTP, Cap Table, Scenarios..."
        confirmLabel="Add Sheet"
        onConfirm={addSheet}
        onCancel={() => setShowAddSheet(false)} />
    </div>);
}
