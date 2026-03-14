'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Calendar, FileText,
  FolderOpen, BookOpen, Globe, Settings,
  Columns3, BarChart3, MessageCircleWarning, Target,
  SendHorizonal, Menu, X, LogOut,
  ChevronLeft, ChevronRight, Sun, Activity, Flame,
  Gauge, Compass,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
  badge?: 'hot' | 'new';
}

const nav: NavItem[] = [
  // Daily — what you use every day
  { href: '/today', label: 'Today', icon: Sun, section: 'DAILY', badge: 'hot' },
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, section: 'DAILY' },
  { href: '/pipeline', label: 'Pipeline', icon: Columns3, section: 'DAILY' },
  { href: '/investors', label: 'Investors', icon: Users, section: 'DAILY' },
  // Execution — running the fundraise
  { href: '/meetings', label: 'Meetings', icon: Calendar, section: 'EXECUTE' },
  { href: '/followups', label: 'Follow-ups', icon: SendHorizonal, section: 'EXECUTE' },
  { href: '/focus', label: 'Focus', icon: Target, section: 'EXECUTE' },
  { href: '/velocity', label: 'Velocity', icon: Gauge, section: 'EXECUTE' },
  // Analysis — understanding what's happening
  { href: '/strategic', label: 'Strategic', icon: Compass, section: 'ANALYZE' },
  { href: '/dealflow', label: 'Dealflow', icon: Flame, section: 'ANALYZE' },
  { href: '/forecast', label: 'Forecast', icon: BarChart3, section: 'ANALYZE' },
  { href: '/objections', label: 'Objections', icon: MessageCircleWarning, section: 'ANALYZE' },
  { href: '/intelligence', label: 'Intelligence', icon: Globe, section: 'ANALYZE' },
  // Tools — materials and configuration
  { href: '/documents', label: 'Documents', icon: BookOpen, section: 'TOOLS' },
  { href: '/data-room', label: 'Data Room', icon: FolderOpen, section: 'TOOLS' },
  { href: '/terms', label: 'Terms', icon: FileText, section: 'TOOLS' },
  { href: '/settings', label: 'Settings', icon: Settings, section: 'TOOLS' },
];

/* ── Sidebar-specific palette (dark navy panel on light page) ── */
const SB = {
  bg: '#1a1a2e',
  bgHover: 'rgba(255,255,255,0.06)',
  bgActive: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.08)',
  text: 'rgba(255,255,255,0.50)',
  textHover: 'rgba(255,255,255,0.75)',
  textActive: '#fafaf8',
  accent: '#fafaf8',
  muted: 'rgba(255,255,255,0.25)',
  sectionLabel: 'rgba(255,255,255,0.30)',
};

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const [todayMeetingCount, setTodayMeetingCount] = useState(0);

  useEffect(() => {
    function fetchBadges() {
      fetch('/api/followups?status=pending')
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (!Array.isArray(data)) return;
          const today = new Date().toISOString().split('T')[0];
          const overdue = data.filter((f: { due_at: string; status: string }) =>
            f.status === 'pending' && f.due_at?.split('T')[0] < today
          );
          setOverdueCount(overdue.length);
        })
        .catch(() => {});
      fetch('/api/meetings')
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          if (!Array.isArray(data)) return;
          const today = new Date().toISOString().split('T')[0];
          const todayMeetings = data.filter((m: { date: string }) =>
            m.date?.split('T')[0] === today
          );
          setTodayMeetingCount(todayMeetings.length);
        })
        .catch(() => {});
    }
    fetchBadges();
    const interval = setInterval(fetchBadges, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const sections = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section || 'OTHER';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  const sectionLabels: Record<string, string> = {
    DAILY: '',
    EXECUTE: 'Execution',
    ANALYZE: 'Analysis',
    TOOLS: 'Tools',
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-lg"
        style={{ background: SB.bg, border: `1px solid ${SB.border}` }}
      >
        <Menu className="w-4 h-4" style={{ color: SB.textActive }} />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — dark navy panel */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          flex flex-col shrink-0
          transform transition-all duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          width: collapsed ? '60px' : '220px',
          background: SB.bg,
          borderRight: `1px solid ${SB.border}`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: collapsed ? 'var(--space-4) var(--space-3)' : 'var(--space-5) var(--space-4)',
            borderBottom: `1px solid ${SB.border}`,
          }}
        >
          {!collapsed && (
            <div className="min-w-0">
              <h1 style={{
                color: SB.accent,
                letterSpacing: '0.22em',
                fontSize: '13px',
                fontWeight: 300,
                fontFamily: 'var(--font-cormorant), Georgia, serif',
                textTransform: 'none' as const,
              }}>
                RAISE
              </h1>
              <p style={{ fontSize: '10px', color: SB.muted, marginTop: '2px', letterSpacing: '0.08em', fontWeight: 300 }}>
                Series C
              </p>
            </div>
          )}
          {collapsed && (
            <div className="w-full flex justify-center">
              <span style={{
                color: SB.accent,
                letterSpacing: '0.12em',
                fontWeight: 300,
                fontFamily: 'var(--font-cormorant), Georgia, serif',
                fontSize: '14px',
              }}>R</span>
            </div>
          )}
          <button
            onClick={() => mobileOpen ? setMobileOpen(false) : setCollapsed(!collapsed)}
            className="hidden md:flex items-center justify-center shrink-0 rounded-md transition-colors"
            style={{
              width: '24px',
              height: '24px',
              color: SB.muted,
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = SB.textHover; (e.target as HTMLElement).style.background = SB.bgHover; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = SB.muted; (e.target as HTMLElement).style.background = 'transparent'; }}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1"
            style={{ color: SB.textHover }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto"
          style={{ padding: collapsed ? 'var(--space-2)' : 'var(--space-3)' }}
        >
          {Object.entries(sections).map(([section, items], sIdx) => (
            <div key={section} style={{ marginTop: sIdx > 0 ? 'var(--space-4)' : '0' }}>
              {/* Section label */}
              {!collapsed && sectionLabels[section] && (
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 400,
                    color: SB.sectionLabel,
                    letterSpacing: '0.04em',
                    padding: '0 var(--space-3)',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  {sectionLabels[section]}
                </div>
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
                      className="group relative flex items-center rounded-md transition-all duration-150"
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
                        }
                      }}
                    >
                      {/* Active indicator */}
                      {active && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r"
                          style={{
                            width: '2px',
                            height: '16px',
                            background: SB.accent,
                          }}
                        />
                      )}

                      <span className="shrink-0 flex items-center justify-center relative" style={{ width: '16px', height: '16px', color: active ? SB.accent : 'inherit' }}>
                        <Icon className="w-4 h-4" />
                        {collapsed && item.href === '/followups' && overdueCount > 0 && (
                          <span
                            className="absolute"
                            style={{
                              top: '-3px',
                              right: '-4px',
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: '#a04040',
                            }}
                          />
                        )}
                        {collapsed && item.href === '/meetings' && todayMeetingCount > 0 && (
                          <span
                            className="absolute"
                            style={{
                              top: '-3px',
                              right: '-4px',
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: SB.accent,
                            }}
                          />
                        )}
                      </span>

                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.badge === 'hot' && (
                            <span
                              className="ml-auto shrink-0"
                              style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                background: '#a04040',
                              }}
                            />
                          )}
                          {item.href === '/followups' && overdueCount > 0 && (
                            <span
                              className="ml-auto shrink-0 flex items-center justify-center"
                              style={{
                                minWidth: '18px',
                                height: '18px',
                                borderRadius: '9px',
                                background: '#a04040',
                                color: '#fafaf8',
                                fontSize: '10px',
                                fontWeight: 500,
                                padding: '0 5px',
                                lineHeight: 1,
                              }}
                            >
                              {overdueCount > 9 ? '9+' : overdueCount}
                            </span>
                          )}
                          {item.href === '/meetings' && todayMeetingCount > 0 && (
                            <span
                              className="ml-auto shrink-0 flex items-center justify-center"
                              style={{
                                minWidth: '18px',
                                height: '18px',
                                borderRadius: '9px',
                                background: 'rgba(255,255,255,0.15)',
                                color: SB.textActive,
                                fontSize: '10px',
                                fontWeight: 500,
                                padding: '0 5px',
                                lineHeight: 1,
                              }}
                            >
                              {todayMeetingCount > 9 ? '9+' : todayMeetingCount}
                            </span>
                          )}
                        </>
                      )}

                      {/* Tooltip for collapsed */}
                      {collapsed && (
                        <div
                          className="absolute left-full ml-2 px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity duration-100"
                          style={{
                            background: '#1a1a2e',
                            border: `1px solid ${SB.border}`,
                            fontSize: 'var(--font-size-xs)',
                            color: SB.textActive,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                          }}
                        >
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: collapsed ? 'var(--space-3) var(--space-2)' : 'var(--space-3) var(--space-4)',
            borderTop: `1px solid ${SB.border}`,
          }}
        >
          {!collapsed && (
            <div
              className="flex items-center justify-center"
              style={{
                fontSize: '10px',
                color: SB.muted,
                padding: '0 var(--space-2) var(--space-2)',
              }}
            >
              <kbd
                style={{
                  background: SB.bgHover,
                  border: `1px solid ${SB.border}`,
                  borderRadius: '3px',
                  padding: '1px 5px',
                  fontSize: '10px',
                  marginRight: '4px',
                  color: SB.text,
                }}
              >
                ⌘K
              </kbd>
              to search
            </div>
          )}
          <button
            onClick={async () => {
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
            onMouseLeave={e => { (e.target as HTMLElement).style.color = SB.muted; }}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
