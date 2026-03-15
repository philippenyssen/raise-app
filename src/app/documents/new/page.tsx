'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/toast';
import { FileText, Upload } from 'lucide-react';
import { stTextMuted, stTextPrimary } from '@/lib/styles';

const TEMPLATES = [
  {
    type: 'memo',
    title: 'Series C Investment Memorandum',
    description: 'Full IC-grade investment memo with all sections',
    content: `# [Company] — Series C Investment Memorandum

## Executive Summary

[One paragraph: what the company does, why now, key metrics, ask]

## Three Beliefs

1. **[Belief 1]** — If true: [MOIC]. If false: [MOIC]
2. **[Belief 2]** — If true: [MOIC]. If false: [MOIC]
3. **[Belief 3]** — If true: [MOIC]. If false: [MOIC]

## Company Overview

### Business Description
### Key Metrics
### Competitive Position

## Market Opportunity

### TAM/SAM/SOM
### Secular Tailwinds
### Regulatory Environment

## Business Model

### Revenue Streams
### Unit Economics
### Customer Concentration

## Financial Performance

### Historical Performance
### Revenue Bridge
### P&L Summary
### Cash Flow

## Team

### Founders
### Key Hires
### Board Composition

## Use of Proceeds

## Risk Factors

## Valuation

### Comparable Companies
### SOTP Analysis
### Return Scenarios

## Appendices
`,},
  {
    type: 'one_pager',
    title: 'One-Pager',
    description: 'Single-page summary for initial outreach',
    content: `# [Company] — Series C One-Pager

**The Pitch**: [One sentence]

**Ask**: [Amount] at [valuation]

## Why Now
- [Reason 1]
- [Reason 2]
- [Reason 3]

## Key Numbers
| Metric | Value |
|--------|-------|
| Revenue (LTM) | |
| Growth Rate | |
| Contracted Revenue | |
| Cash Position | |

## Returns
| Scenario | MOIC | IRR |
|----------|------|-----|
| Bear | | |
| Base | | |
| Bull | | |

## Comparable Valuations
| Company | Valuation | Multiple |
|---------|-----------|----------|
| | | |

## What Makes This Different
1.
2.
3.
`,},
  {
    type: 'exec_brief',
    title: 'Executive Brief',
    description: '2-3 page brief for senior decision-makers',
    content: `# [Company] — Executive Brief

## Deal Summary
- **Company**:
- **Round**: Series C
- **Pre-Money**:
- **Raise**:
- **Lead**:

## Why This Matters
[2-3 sentences]

## Key Reasons to Invest
1.
2.
3.
4.
5.

## Key Risks
1.
2.
3.

## Return Profile
| Scenario | Revenue 2030E | MOIC | IRR |
|----------|---------------|------|-----|
| Bear | | | |
| Base | | | |
| Bull | | | |

## Process & Timeline
`,},
  {
    type: 'custom',
    title: 'Blank Document',
    description: 'Start from scratch',
    content: '',
  },];

export default function NewDocumentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [importContent, setImportContent] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [hoveredCreate, setHoveredCreate] = useState<string | null>(null);

  async function createFromTemplate(template: typeof TEMPLATES[0]) {
    setCreating(true);
    const title = template.type === 'custom' ? (customTitle || 'Untitled Document') : template.title;
    const content = showImport && importContent ? importContent : template.content;

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type: template.type, content }),});
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const doc = await res.json();
      toast(`Created "${title}"`);
      router.push(`/documents/${doc.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create document', 'error');
      setCreating(false);
    }
  }

  return (
    <div className="page-content max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">New Document</h1>
        <p className="text-sm mt-1" style={stTextMuted}>Choose a template or start blank</p></div>

      {/* Import Toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowImport(!showImport)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={showImport ? {
            background: 'var(--accent-muted)',
            color: 'var(--accent)',
          } : {
            background: 'var(--surface-2)',
            color: 'var(--text-tertiary)', }}>
          <Upload className="w-3.5 h-3.5" /> Import Markdown</button></div>

      {showImport && (
        <div className="rounded-xl p-4">
          <label className="text-xs block mb-2" style={stTextMuted}>Paste markdown content (will replace template content)</label>
          <textarea
            value={importContent}
            onChange={e => setImportContent(e.target.value)}
            rows={8}
            placeholder="Paste your markdown here..."
            className="w-full rounded-lg px-4 py-3 text-sm font-mono focus:outline-none"
            style={{ background: 'var(--surface-1)', color: 'var(--text-secondary)' }} /></div>
      )}

      {/* Templates */}
      <div className="space-y-3">
        {TEMPLATES.map((template) => (
          <div
            key={template.type}
            className="rounded-xl p-5 transition-colors"
            style={{}}
            onMouseEnter={() => setHoveredButton(template.type)}
            onMouseLeave={() => setHoveredButton(null)}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 mt-0.5 shrink-0" style={stTextMuted} />
                <div>
                  <h3 className="font-normal" style={stTextPrimary}>{template.title}</h3>
                  <p className="text-sm mt-0.5" style={stTextMuted}>{template.description}</p>
                  {template.type === 'custom' && (
                    <input
                      value={customTitle}
                      onChange={e => setCustomTitle(e.target.value)}
                      placeholder="Document title..."
                      className="mt-2 rounded-lg px-3 py-1.5 text-sm focus:outline-none w-64"
                      style={{
                        background: 'var(--surface-1)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-secondary)', }}
                      onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                      onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }} />
                  )}</div></div>
              <button
                onClick={() => createFromTemplate(template)}
                disabled={creating}
                className="px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 shrink-0"
                style={{
                  background: hoveredCreate === template.type ? 'var(--surface-3)' : 'var(--surface-2)',
                  color: 'var(--text-primary)', }}
                onMouseEnter={() => setHoveredCreate(template.type)}
                onMouseLeave={() => setHoveredCreate(null)}>
                {creating ? 'Creating...' : 'Create'}</button></div></div>
        ))}</div>
    </div>);
}
