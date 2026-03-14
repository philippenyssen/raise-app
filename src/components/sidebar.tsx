'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Users, Calendar, Brain, HeartPulse, FileText, BookOpen,
  Menu, X
} from 'lucide-react';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/investors', label: 'Investors', icon: Users },
  { href: '/meetings', label: 'Meetings', icon: Calendar },
  { href: '/documents', label: 'Documents', icon: BookOpen },
  { href: '/analysis', label: 'Analysis', icon: Brain },
  { href: '/health', label: 'Health', icon: HeartPulse },
  { href: '/terms', label: 'Terms', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
            <p className="text-xs text-zinc-500 mt-0.5">Series C Orchestrator</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1 text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map((item) => {
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
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-600">
            ASL Series C
          </div>
        </div>
      </aside>
    </>
  );
}
