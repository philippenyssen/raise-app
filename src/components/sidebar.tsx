'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';


import {
  Users, CalendarDays, FileText,
  Settings, Columns3,
  Menu, X, LogOut,
  ChevronLeft, ChevronRight, Sun, Flame,
  Compass, Swords, MessageCircleWarning,
  FolderOpen, FileBarChart,
  CircleDot, TrendingUp, Newspaper,
  Calculator, ClipboardList, Database, Sparkles,
  PenTool, BookOpen,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
  badge?: 'hot' | 'new';
}

const nav: NavItem[] = [
  // Daily
  { href: '/today', label: 'Today', icon: Sun, section: 'DAILY' },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, section: 'DAILY' },
  { href: '/digest', label: 'Digest', icon: Newspaper, section: 'DAILY' },
  // Pipeline
  { href: '/pipeline', label: 'Pipeline', icon: Columns3, section: 'PIPELINE' },
  { href: '/investors', label: 'Investors', icon: Users, section: 'PIPELINE' },
  { href: '/dealflow', label: 'Dealflow', icon: Flame, section: 'PIPELINE' },
  { href: '/decide', label: 'Decide', icon: CircleDot, section: 'PIPELINE' },
  { href: '/forecast', label: 'Forecast', icon: TrendingUp, section: 'PIPELINE' },
  // Intelligence
  { href: '/strategic', label: 'Strategic', icon: Compass, section: 'INTEL' },
  { href: '/competitive', label: 'Competitive', icon: Swords, section: 'INTEL' },
  { href: '/objections', label: 'Objections', icon: MessageCircleWarning, section: 'INTEL' },
  // Materials — context in, documents out
  { href: '/context', label: 'Context', icon: BookOpen, section: 'MATERIALS' },
  { href: '/workspace', label: 'Workspace', icon: PenTool, section: 'MATERIALS' },
  { href: '/data-room', label: 'Data Room', icon: FolderOpen, section: 'MATERIALS' },
  // Tools
  { href: '/terms', label: 'Terms', icon: FileText, section: 'TOOLS' },
  { href: '/deal-mechanics', label: 'Modeling', icon: Calculator, section: 'TOOLS' },
  { href: '/model', label: 'Model', icon: Database, section: 'TOOLS' },
  { href: '/reports', label: 'Reports', icon: FileBarChart, section: 'TOOLS' },
  { href: '/backlog', label: 'Backlog', icon: ClipboardList, section: 'TOOLS' },
  { href: '/enrichment', label: 'Enrichment', icon: Sparkles, section: 'TOOLS' },
  { href: '/settings', label: 'Settings', icon: Settings, section: 'TOOLS' },];

/* ── Sidebar-specific palette (dark navy panel on light page) ── */
const SB = {
  bg: 'var(--foreground)',
  bgHover: 'var(--white-6)',
  bgActive: 'var(--white-10)',
  border: 'var(--white-8)',
  text: 'var(--white-50)',
  textHover: 'var(--white-75)',
  textActive: 'var(--surface-0)',
  accent: 'var(--surface-0)',
  muted: 'var(--white-25)',
  sectionLabel: 'var(--white-30)',};




export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);



  const sections = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section || 'OTHER';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  const sectionLabels: Record<string, string> = {
    DAILY: '',
    PIPELINE: 'Pipeline',
    INTEL: 'Intelligence',
    MATERIALS: 'Materials',
    TOOLS: 'Tools',};

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg"
        style={{ background: SB.bg, border: `1px solid ${SB.border}` }}
        aria-label="Open navigation menu"
        title="Open menu">
        <Menu className="w-4 h-4" style={{ color: SB.textActive }} /></button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          role="button"
          tabIndex={0}
          aria-label="Close navigation menu"
          style={{ background: 'var(--overlay)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setMobileOpen(false); }}/>
      )}

      {/* Sidebar — dark navy panel */}
      <aside
        aria-label="Main navigation"
        className={`
          fixed md:static inset-y-0 left-0 z-50
          flex flex-col shrink-0
          transform transition-all duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ width: collapsed ? '60px' : '220px', background: SB.bg, borderRight: `1px solid ${SB.border}` }}>
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: collapsed ? 'var(--space-4) var(--space-3)' : 'var(--space-5) var(--space-4)',
            borderBottom: `1px solid ${SB.border}`,}}>
          {!collapsed && (
            <div className="min-w-0">
              <h1 style={{
                color: SB.accent,
                letterSpacing: '0.22em',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 300,
                fontFamily: 'var(--font-cormorant), Georgia, serif',}}>
                RAISE</h1>
              <p style={{ fontSize: 'var(--font-size-xs)', color: SB.muted, marginTop: '2px', letterSpacing: '0.08em', fontWeight: 300 }}>
                Series C</p></div>
          )}
          {collapsed && (
            <div className="w-full flex justify-center">
              <span style={{
                color: SB.accent,
                letterSpacing: '0.12em',
                fontWeight: 300,
                fontFamily: 'var(--font-cormorant), Georgia, serif',
                fontSize: 'var(--font-size-sm)',
              }}>R</span></div>
          )}
          <button
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => mobileOpen ? setMobileOpen(false) : setCollapsed(!collapsed)}
            className="hidden md:flex items-center justify-center shrink-0 rounded-md transition-colors"
            style={{ width: '24px', height: '24px', color: SB.muted }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = SB.textHover; (e.target as HTMLElement).style.background = SB.bgHover; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = SB.muted; (e.target as HTMLElement).style.background = 'transparent'; }}>
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}</button>
          <button
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1"
            style={{ color: SB.textHover }}>
            <X className="w-4 h-4" /></button></div>

        {/* Navigation */}
        <nav
          aria-label="Main navigation"
          className="flex-1 overflow-y-auto"
          style={{ padding: collapsed ? 'var(--space-2)' : 'var(--space-3)' }}>
          {Object.entries(sections).map(([section, items], sIdx) => (
            <div key={section} style={{ marginTop: sIdx > 0 ? 'var(--space-4)' : '0' }}>
              {/* Section label */}
              {!collapsed && sectionLabels[section] && (
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 400,
                    color: SB.sectionLabel,
                    letterSpacing: '0.04em',
                    padding: '0 var(--space-3)',
                    marginBottom: 'var(--space-1)',}}>
                  {sectionLabels[section]}</div>
              )}
              {collapsed && sIdx > 0 && (
                <div style={{ height: '1px', background: SB.border, margin: '0 var(--space-2) var(--space-2)' }} />
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {items.map((item) => {
                  const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.label : undefined}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                      className="group relative flex items-center rounded-md transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
                      style={{
                        gap: collapsed ? '0' : 'var(--space-3)',
                        padding: collapsed ? 'var(--space-2)' : 'var(--space-2) var(--space-3)',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        background: active ? SB.bgActive : 'transparent',
                        color: active ? SB.textActive : SB.text,
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: active ? 400 : 300,
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = SB.bgHover;
                          (e.currentTarget as HTMLElement).style.color = SB.textHover;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                          (e.currentTarget as HTMLElement).style.color = SB.text;
                        }}}>
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r" style={{ width: '2px', height: '16px', background: SB.accent }} />
                      )}

                      <span className="shrink-0 flex items-center justify-center relative" style={{ width: '16px', height: '16px', color: active ? SB.accent : 'inherit' }} aria-hidden="true">
                        <Icon className="w-4 h-4" /></span>

                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.badge === 'hot' && (
                            <span className="ml-auto shrink-0" style={{ width: '5px', height: '5px', borderRadius: '50%', background: SB.accent }} />
                          )}


                        </>
                      )}

                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity duration-100"
                          style={{ background: 'var(--foreground)', border: `1px solid ${SB.border}`, fontSize: 'var(--font-size-xs)', color: SB.textActive, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                          {item.label}</div>
                      )}
                    </Link>);
                })}</div></div>
          ))}</nav>

        {/* Footer */}
        <div
          style={{
            padding: collapsed ? 'var(--space-3) var(--space-2)' : 'var(--space-3) var(--space-4)',
            borderTop: `1px solid ${SB.border}`,}}>
          {!collapsed && (
            <div className="flex items-center justify-center" style={{ fontSize: 'var(--font-size-xs)', color: SB.muted, padding: '0 var(--space-2) var(--space-2)' }}>
              <kbd style={{ background: SB.bgHover, border: `1px solid ${SB.border}`, borderRadius: 'var(--radius-xs)', padding: '1px 5px', fontSize: 'var(--font-size-xs)', marginRight: '4px', color: SB.text }}>⌘K</kbd>
              to search</div>
          )}
          <button
            onClick={async (e) => {
              const btn = e.currentTarget;
              if (btn.dataset.busy) return;
              btn.dataset.busy = '1';
              await fetch('/api/auth', { method: 'DELETE' });
              window.location.href = '/login';
            }}
            className="flex items-center rounded-md transition-colors w-full"
            style={{
              gap: collapsed ? '0' : 'var(--space-2)',
              padding: 'var(--space-2)',
              justifyContent: collapsed ? 'center' : 'flex-start',
              fontSize: 'var(--font-size-xs)',
              color: SB.muted,
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = SB.textHover; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = SB.muted; }}>
            <span aria-hidden="true"><LogOut className="w-3.5 h-3.5 shrink-0" /></span>
            {!collapsed && <span>Sign Out</span>}</button></div></aside>
    </>);
}
