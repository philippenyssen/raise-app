'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Users, Calendar, Brain, HeartPulse, FileText,
  Sparkles, FolderOpen, BookOpen, Table, Globe, ClipboardList, Settings,
  Columns3, GitCompare, BarChart3, MessageCircleWarning, Target,
  SendHorizonal, Menu, X, LogOut, FileBarChart
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section?: string;
}

const nav: NavItem[] = [
  // Focus — top priority
  { href: '/focus', label: 'Focus', icon: Target, section: 'FOCUS' },
  // Deliverables
  { href: '/workspace', label: 'Workspace', icon: Sparkles, section: 'DELIVERABLES' },
  { href: '/documents', label: 'Documents', icon: BookOpen, section: 'DELIVERABLES' },
  { href: '/data-room', label: 'Data Room', icon: FolderOpen, section: 'DELIVERABLES' },
  { href: '/model', label: 'Model', icon: Table, section: 'DELIVERABLES' },
  // Intelligence
  { href: '/intelligence', label: 'Intelligence', icon: Globe, section: 'INTELLIGENCE' },
  { href: '/objections', label: 'Objections', icon: MessageCircleWarning, section: 'INTELLIGENCE' },
  // Workflow
  { href: '/timeline', label: 'Timeline', icon: ClipboardList, section: 'WORKFLOW' },
  // Process
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, section: 'PROCESS' },
  { href: '/pipeline', label: 'Pipeline', icon: Columns3, section: 'PROCESS' },
  { href: '/investors', label: 'Investors', icon: Users, section: 'PROCESS' },
  { href: '/compare', label: 'Compare', icon: GitCompare, section: 'PROCESS' },
  { href: '/meetings', label: 'Meetings', icon: Calendar, section: 'PROCESS' },
  { href: '/followups', label: 'Follow-ups', icon: SendHorizonal, section: 'PROCESS' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, section: 'PROCESS' },
  { href: '/analysis', label: 'Analysis', icon: Brain, section: 'PROCESS' },
  { href: '/health', label: 'Health', icon: HeartPulse, section: 'PROCESS' },
  { href: '/reports', label: 'Reports', icon: FileBarChart, section: 'PROCESS' },
  { href: '/terms', label: 'Terms', icon: FileText, section: 'PROCESS' },
  // Settings
  { href: '/settings', label: 'Settings', icon: Settings, section: 'SETTINGS' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Group by section
  const sections = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section || 'OTHER';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-zinc-900 border border-zinc-800 rounded-lg"
      >
        <Menu className="w-5 h-5 text-zinc-400" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-56 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0
        transform transition-transform duration-200 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">RAISE</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Series C Execution Platform</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {Object.entries(sections).map(([section, items]) => (
            <div key={section}>
              <div className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider px-3 mb-1.5">
                {section}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        active
                          ? 'bg-zinc-800 text-white font-medium'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded flex items-center justify-center ${
                        active ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-zinc-800 space-y-2">
          <button
            onClick={async () => {
              await fetch('/api/auth', { method: 'DELETE' });
              window.location.href = '/login';
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
