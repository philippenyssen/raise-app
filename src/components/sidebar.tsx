'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { href: '/', label: 'Dashboard', icon: '~' },
  { href: '/investors', label: 'Investors', icon: 'I' },
  { href: '/meetings', label: 'Meetings', icon: 'M' },
  { href: '/analysis', label: 'Analysis', icon: 'A' },
  { href: '/health', label: 'Health', icon: 'H' },
  { href: '/terms', label: 'Terms', icon: 'T' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
      <div className="p-5 border-b border-zinc-800">
        <h1 className="text-lg font-bold tracking-tight">RAISE</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Series C Orchestrator</p>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-zinc-800 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono ${
                active ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-zinc-800">
        <div className="text-xs text-zinc-600">
          GSD-Powered Process
        </div>
      </div>
    </aside>
  );
}
