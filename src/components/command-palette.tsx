'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Sun, LayoutDashboard, Columns3, Users, Calendar,
  SendHorizonal, Target, Flame, BarChart3, MessageCircleWarning,
  Globe, BookOpen, FolderOpen, FileText, Settings,
  PlusCircle, Pencil, Mic, ClipboardList, Search,
  Command, Activity, Shield, TrendingUp, Network,
  Gauge, Award, Zap, Layers, GitCompare, FileBarChart,
  Wrench, Rocket,
} from 'lucide-react';

interface PageItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section: 'pages';
}

interface InvestorItem {
  label: string;
  href: string;
  id: string;
  section: 'investors';
}

interface ActionItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  note?: string;
  section: 'actions';
}

interface InvestorActionItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  section: 'investor_actions';
}

type PaletteItem = PageItem | InvestorItem | ActionItem | InvestorActionItem;

const PAGES: PageItem[] = [
  { label: 'Today', href: '/today', icon: Sun, section: 'pages' },
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, section: 'pages' },
  { label: 'Pipeline', href: '/pipeline', icon: Columns3, section: 'pages' },
  { label: 'Investors', href: '/investors', icon: Users, section: 'pages' },
  { label: 'Meetings', href: '/meetings', icon: Calendar, section: 'pages' },
  { label: 'Follow-ups', href: '/followups', icon: SendHorizonal, section: 'pages' },
  { label: 'Focus', href: '/focus', icon: Target, section: 'pages' },
  { label: 'Dealflow', href: '/dealflow', icon: Flame, section: 'pages' },
  { label: 'Forecast', href: '/forecast', icon: BarChart3, section: 'pages' },
  { label: 'Objections', href: '/objections', icon: MessageCircleWarning, section: 'pages' },
  { label: 'Intelligence', href: '/intelligence', icon: Globe, section: 'pages' },
  { label: 'Documents', href: '/documents', icon: BookOpen, section: 'pages' },
  { label: 'Data Room', href: '/data-room', icon: FolderOpen, section: 'pages' },
  { label: 'Terms', href: '/terms', icon: FileText, section: 'pages' },
  { label: 'Settings', href: '/settings', icon: Settings, section: 'pages' },
  { label: 'Velocity', href: '/velocity', icon: Gauge, section: 'pages' },
  { label: 'Strategic', href: '/strategic', icon: Shield, section: 'pages' },
  { label: 'Momentum', href: '/momentum', icon: TrendingUp, section: 'pages' },
  { label: 'Network', href: '/network', icon: Network, section: 'pages' },
  { label: 'Stress Test', href: '/stress-test', icon: Zap, section: 'pages' },
  { label: 'Reports', href: '/reports', icon: FileBarChart, section: 'pages' },
  { label: 'Timeline', href: '/timeline', icon: Activity, section: 'pages' },
  { label: 'Win/Loss', href: '/win-loss', icon: Award, section: 'pages' },
  { label: 'Term Compare', href: '/term-compare', icon: GitCompare, section: 'pages' },
  { label: 'Model', href: '/model', icon: Layers, section: 'pages' },
  { label: 'Deal Heat', href: '/deal-heat', icon: Flame, section: 'pages' },
  { label: 'Acceleration', href: '/acceleration', icon: Rocket, section: 'pages' },
  { label: 'Enrichment', href: '/enrichment', icon: Wrench, section: 'pages' },
  { label: 'Workspace', href: '/workspace', icon: Pencil, section: 'pages' },
  { label: 'Competitive', href: '/competitive', icon: Award, section: 'pages' },
  { label: 'Analytics', href: '/analytics', icon: Activity, section: 'pages' },
];

const ACTIONS: ActionItem[] = [
  { label: 'Log a meeting', href: '/meetings/new', icon: Pencil, section: 'actions' },
  { label: 'Quick capture', href: '/meetings/capture', icon: Mic, section: 'actions' },
  { label: 'New investor', href: '/investors', icon: PlusCircle, note: 'Add from investors page', section: 'actions' },
  { label: 'New document', href: '/documents/new', icon: FileText, section: 'actions' },
  { label: 'Meeting prep', href: '/meetings/prep', icon: ClipboardList, section: 'actions' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [investors, setInvestors] = useState<{ id: string; name: string }[]>([]);
  const [investorsFetched, setInvestorsFetched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Toggle on Cmd+K / Ctrl+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Fetch investors once when palette opens
  useEffect(() => {
    if (open && !investorsFetched) {
      fetch('/api/investors')
        .then(r => r.json())
        .then((data: { id: string; name: string }[]) => {
          if (Array.isArray(data)) {
            setInvestors(data.map(inv => ({ id: inv.id, name: inv.name })));
          }
          setInvestorsFetched(true);
        })
        .catch(() => setInvestorsFetched(true));
    }
  }, [open, investorsFetched]);

  // Reset state on open/close
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    } else {
      setInvestorsFetched(false);
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const lowerQuery = query.toLowerCase().trim();

  const filteredPages = useMemo(
    () => PAGES.filter(p => p.label.toLowerCase().includes(lowerQuery)),
    [lowerQuery]
  );

  const filteredInvestors = useMemo(() => {
    if (lowerQuery.length < 2) return [];
    return investors
      .filter(inv => inv.name.toLowerCase().includes(lowerQuery))
      .slice(0, 5)
      .map((inv): InvestorItem => ({
        label: inv.name,
        href: `/investors/${inv.id}`,
        id: inv.id,
        section: 'investors',
      }));
  }, [lowerQuery, investors]);

  const filteredActions = useMemo(
    () => ACTIONS.filter(a => a.label.toLowerCase().includes(lowerQuery)),
    [lowerQuery]
  );

  const investorActions = useMemo((): InvestorActionItem[] => {
    if (filteredInvestors.length === 0) return [];
    const top = filteredInvestors[0];
    return [
      { label: `Log meeting with ${top.label}`, href: `/meetings/new?investor=${top.id}`, icon: Pencil, section: 'investor_actions' },
      { label: `Follow up with ${top.label}`, href: `/followups?investor=${top.id}`, icon: SendHorizonal, section: 'investor_actions' },
      { label: `Prep for ${top.label}`, href: `/meetings/prep?investor=${top.id}`, icon: ClipboardList, section: 'investor_actions' },
    ];
  }, [filteredInvestors]);

  const allItems: PaletteItem[] = useMemo(
    () => [...filteredPages, ...investorActions, ...filteredInvestors, ...filteredActions],
    [filteredPages, investorActions, filteredInvestors, filteredActions]
  );

  // Clamp active index
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const navigate = useCallback((item: PaletteItem) => {
    router.push(item.href);
    close();
  }, [router, close]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % Math.max(allItems.length, 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + Math.max(allItems.length, 1)) % Math.max(allItems.length, 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (allItems[activeIndex]) {
          navigate(allItems[activeIndex]);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, allItems, activeIndex, navigate, close]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  let globalIdx = -1;

  function renderSectionHeader(title: string) {
    return (
      <div
        style={{
          fontSize: '10px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          padding: '8px 16px 4px',
        }}
      >
        {title}
      </div>
    );
  }

  function renderPageItem(item: PageItem) {
    globalIdx++;
    const idx = globalIdx;
    const Icon = item.icon;
    const isActive = idx === activeIndex;
    return (
      <div
        key={item.href}
        data-index={idx}
        onClick={() => navigate(item)}
        className="flex items-center gap-3 cursor-pointer"
        style={{
          padding: '8px 16px',
          background: isActive ? 'var(--surface-3)' : 'transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          borderRadius: 'var(--radius-md)',
          margin: '0 8px',
          transition: 'background 100ms',
        }}
        onMouseEnter={() => setActiveIndex(idx)}
      >
        <span className="shrink-0 flex items-center justify-center" style={{ width: '16px', height: '16px', color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>
          <Icon className="w-4 h-4" />
        </span>
        <span style={{ fontSize: '13px' }}>{item.label}</span>
      </div>
    );
  }

  function renderInvestorItem(item: InvestorItem) {
    globalIdx++;
    const idx = globalIdx;
    const isActive = idx === activeIndex;
    return (
      <div
        key={item.id}
        data-index={idx}
        onClick={() => navigate(item)}
        className="flex items-center gap-3 cursor-pointer"
        style={{
          padding: '8px 16px',
          background: isActive ? 'var(--surface-3)' : 'transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          borderRadius: 'var(--radius-md)',
          margin: '0 8px',
          transition: 'background 100ms',
        }}
        onMouseEnter={() => setActiveIndex(idx)}
      >
        <span className="shrink-0 flex items-center justify-center" style={{ width: '16px', height: '16px', color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>
          <Users className="w-4 h-4" />
        </span>
        <span style={{ fontSize: '13px' }}>{item.label}</span>
      </div>
    );
  }

  function renderInvestorActionItem(item: InvestorActionItem) {
    globalIdx++;
    const idx = globalIdx;
    const Icon = item.icon;
    const isActive = idx === activeIndex;
    return (
      <div
        key={item.href}
        data-index={idx}
        onClick={() => navigate(item)}
        className="flex items-center gap-3 cursor-pointer"
        style={{
          padding: '8px 16px',
          background: isActive ? 'var(--surface-3)' : 'transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          borderRadius: 'var(--radius-md)',
          margin: '0 8px',
          transition: 'background 100ms',
        }}
        onMouseEnter={() => setActiveIndex(idx)}
      >
        <span className="shrink-0 flex items-center justify-center" style={{ width: '16px', height: '16px', color: isActive ? 'var(--success)' : 'var(--text-muted)' }}>
          <Icon className="w-4 h-4" />
        </span>
        <span style={{ fontSize: '13px' }}>{item.label}</span>
      </div>
    );
  }

  function renderActionItem(item: ActionItem) {
    globalIdx++;
    const idx = globalIdx;
    const Icon = item.icon;
    const isActive = idx === activeIndex;
    return (
      <div
        key={item.href}
        data-index={idx}
        onClick={() => navigate(item)}
        className="flex items-center gap-3 cursor-pointer"
        style={{
          padding: '8px 16px',
          background: isActive ? 'var(--surface-3)' : 'transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          borderRadius: 'var(--radius-md)',
          margin: '0 8px',
          transition: 'background 100ms',
        }}
        onMouseEnter={() => setActiveIndex(idx)}
      >
        <span className="shrink-0 flex items-center justify-center" style={{ width: '16px', height: '16px', color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>
          <Icon className="w-4 h-4" />
        </span>
        <span style={{ fontSize: '13px' }}>{item.label}</span>
        {item.note && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{item.note}</span>
        )}
      </div>
    );
  }

  const portal = createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', paddingTop: '15vh' }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: '560px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          maxHeight: '420px',
        }}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 shrink-0"
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            <Search className="w-4 h-4" />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search investors, pages, actions..."
            className="flex-1 outline-none"
            style={{
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '14px',
              border: 'none',
            }}
          />
          <kbd
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '2px 6px',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto" style={{ padding: '4px 0' }}>
          {allItems.length === 0 ? (
            <div
              className="flex items-center justify-center"
              style={{ padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}
            >
              No results
            </div>
          ) : (
            <>
              {filteredPages.length > 0 && (
                <div>
                  {renderSectionHeader('Pages')}
                  {filteredPages.map(item => renderPageItem(item))}
                </div>
              )}
              {investorActions.length > 0 && (
                <div>
                  {renderSectionHeader('Quick Actions')}
                  {investorActions.map(item => renderInvestorActionItem(item))}
                </div>
              )}
              {filteredInvestors.length > 0 && (
                <div>
                  {renderSectionHeader('Investors')}
                  {filteredInvestors.map(item => renderInvestorItem(item))}
                </div>
              )}
              {filteredActions.length > 0 && (
                <div>
                  {renderSectionHeader('Actions')}
                  {filteredActions.map(item => renderActionItem(item))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="flex items-center gap-4 shrink-0"
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '10px',
            color: 'var(--text-muted)',
          }}
        >
          <span className="flex items-center gap-1">
            <kbd style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '3px', padding: '1px 4px' }}>&uarr;&darr;</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '3px', padding: '1px 4px' }}>&crarr;</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: '3px', padding: '1px 4px' }}>esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );

  return portal;
}
