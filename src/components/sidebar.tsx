'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Users, Calendar, FileText,
  FolderOpen, BookOpen, Globe, Settings,
  Columns3, BarChart3, MessageCircleWarning, Target,
  SendHorizonal, Menu, X, LogOut,
  ChevronLeft, ChevronRight, Sun, Activity, Flame,
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
  // Analysis — understanding what's happening
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
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)' }}
      >
        <Menu className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          flex flex-col shrink-0
          transform transition-all duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          width: collapsed ? '60px' : '220px',
          background: 'var(--surface-0)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: collapsed ? 'var(--space-4) var(--space-3)' : 'var(--space-5) var(--space-4)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '0.05em' }}>
                RAISE
              </h1>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '1px' }}>
                Series C
              </p>
            </div>
          )}
          {collapsed && (
            <div className="w-full flex justify-center">
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '0.05em' }}>R</span>
            </div>
          )}
          <button
            onClick={() => mobileOpen ? setMobileOpen(false) : setCollapsed(!collapsed)}
            className="hidden md:flex items-center justify-center shrink-0 rounded-md transition-colors"
            style={{
              width: '24px',
              height: '24px',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-secondary)'; (e.target as HTMLElement).style.background = 'var(--surface-2)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; (e.target as HTMLElement).style.background = 'transparent'; }}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1"
            style={{ color: 'var(--text-muted)' }}
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
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '0 var(--space-3)',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  {sectionLabels[section]}
                </div>
              )}
              {collapsed && sIdx > 0 && (
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0 var(--space-2) var(--space-2)' }} />
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
                        background: active ? 'var(--surface-2)' : 'transparent',
                        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: active ? 500 : 400,
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = 'var(--surface-1)';
                          (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                          (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)';
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
                            background: 'var(--accent)',
                          }}
                        />
                      )}

                      <span className="shrink-0 flex items-center justify-center" style={{ width: '16px', height: '16px', color: active ? 'var(--accent)' : 'inherit' }}>
                        <Icon className="w-4 h-4" />
                      </span>

                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.badge === 'hot' && (
                            <span
                              className="ml-auto shrink-0"
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: 'var(--danger)',
                                boxShadow: '0 0 6px rgba(239, 68, 68, 0.4)',
                              }}
                            />
                          )}
                        </>
                      )}

                      {/* Tooltip for collapsed */}
                      {collapsed && (
                        <div
                          className="absolute left-full ml-2 px-2 py-1 rounded-md opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap z-50 transition-opacity duration-100"
                          style={{
                            background: 'var(--surface-3)',
                            border: '1px solid var(--border-default)',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-primary)',
                            boxShadow: 'var(--shadow-md)',
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
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
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
              color: 'var(--text-muted)',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
