'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CopyButton({ text, label = 'Copy', className = '', style }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center gap-1 transition-colors ${className}`}
      style={{
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        cursor: 'pointer',
        fontSize: 'var(--font-size-xs)',
        background: copied ? 'var(--success-muted)' : hovered ? 'var(--surface-3)' : 'var(--surface-2)',
        color: copied ? 'var(--success)' : hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        ...style,
      }}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : label}
    </button>
  );
}
