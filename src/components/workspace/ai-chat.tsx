'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, RotateCcw, Copy, Check, CheckCircle, XCircle, Square, Search, X, ThumbsUp, ThumbsDown, Pin, FileDown } from 'lucide-react';
import { VoiceInput } from './voice-input';
import { textSmMuted } from '@/lib/styles';
import { useMemo } from 'react';

interface Message { role: 'user' | 'assistant'; content: string; error?: boolean; timestamp?: number; }

interface AIChatProps {
  documentId: string | null;
  documentContent: string;
  documentTitle: string;
  documentType?: string;
  onApplyChange?: (newContent: string) => void;
}

interface PendingChange { content: string; messageIdx: number; summary?: string; }
interface SuggestedFollowUp { text: string; }

function computeChangeSummary(oldContent: string, newContent: string, docType?: string): string {
  if (docType === 'model' || docType === 'spreadsheet') {
    try {
      const oldCells = Object.keys(JSON.parse(oldContent).cells || JSON.parse(oldContent));
      const newCells = Object.keys(JSON.parse(newContent).cells || JSON.parse(newContent));
      const added = newCells.filter(k => !oldCells.includes(k)).length;
      const changed = newCells.filter(k => oldCells.includes(k)).length;
      return `${added > 0 ? `${added} cells added` : ''}${added > 0 && changed > 0 ? ', ' : ''}${changed > 0 ? `${changed} cells updated` : ''}`;
    } catch { return ''; }
  }
  const oldLen = oldContent.length;
  const newLen = newContent.length;
  const diff = newLen - oldLen;
  const oldLines = oldContent.split('\n').length;
  const newLines = newContent.split('\n').length;
  const lineDiff = newLines - oldLines;
  const parts: string[] = [];
  if (diff > 0) parts.push(`+${diff} chars`);
  else if (diff < 0) parts.push(`${diff} chars`);
  if (lineDiff > 0) parts.push(`+${lineDiff} lines`);
  else if (lineDiff < 0) parts.push(`${lineDiff} lines`);
  return parts.join(', ') || 'Content updated';
}

function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  // Split into blocks
  const blocks: React.ReactNode[] = [];
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push(
        <pre key={blocks.length} style={{
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          fontSize: 'var(--font-size-xs)',
          overflow: 'auto',
          margin: '4px 0',
          fontFamily: 'monospace',
        }}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Heading
    if (line.startsWith('### ')) {
      blocks.push(<div key={blocks.length} style={{ fontWeight: 600, marginTop: '8px' }}>{inlineFormat(line.slice(4))}</div>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      blocks.push(<div key={blocks.length} style={{ fontWeight: 600, marginTop: '8px', fontSize: '1.05em' }}>{inlineFormat(line.slice(3))}</div>);
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push(<div key={blocks.length} style={{ fontWeight: 600, marginTop: '8px', fontSize: '1.1em' }}>{inlineFormat(line.slice(2))}</div>);
      i++;
      continue;
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableRows: string[][] = [];
      let hasHeader = false;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const row = lines[i].trim();
        if (row.match(/^\|[\s\-:|]+\|$/)) {
          hasHeader = tableRows.length === 1;
          i++;
          continue;
        }
        const cells = row.split('|').filter((_, ci, arr) => ci > 0 && ci < arr.length - 1).map(c => c.trim());
        tableRows.push(cells);
        i++;
      }
      if (tableRows.length > 0) {
        blocks.push(
          <div key={blocks.length} style={{ overflow: 'auto', margin: '6px 0' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85em' }}>
              {hasHeader && tableRows.length > 0 && (
                <thead>
                  <tr>
                    {tableRows[0].map((cell, ci) => (
                      <th key={ci} style={{
                        padding: '4px 8px',
                        borderBottom: '2px solid var(--border-default)',
                        textAlign: 'left',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>{inlineFormat(cell)}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {tableRows.slice(hasHeader ? 1 : 0).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{
                        padding: '3px 8px',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}>{inlineFormat(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Bullet list
    if (line.match(/^[-*]\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s/)) {
        items.push(lines[i].replace(/^[-*]\s/, ''));
        i++;
      }
      blocks.push(
        <ul key={blocks.length} style={{ margin: '4px 0', paddingLeft: '1.2em' }}>
          {items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      blocks.push(
        <ol key={blocks.length} style={{ margin: '4px 0', paddingLeft: '1.2em' }}>
          {items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}\s*$/)) {
      blocks.push(<hr key={blocks.length} style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '8px 0' }} />);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <blockquote key={blocks.length} style={{
          borderLeft: '3px solid var(--accent)',
          paddingLeft: '12px',
          margin: '6px 0',
          color: 'var(--text-tertiary)',
          fontStyle: 'italic',
        }}>
          {quoteLines.map((ql, qi) => <div key={qi}>{inlineFormat(ql)}</div>)}
        </blockquote>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
    blocks.push(<div key={blocks.length} style={{ margin: '2px 0' }}>{inlineFormat(line)}</div>);
    i++;
  }

  return blocks;
}

function inlineFormat(text: string): React.ReactNode {
  // Split on bold, italic, code patterns and reconstruct with React elements
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^([\s\S]*?)\*\*(.+?)\*\*([\s\S]*)/);
    // Code: `text`
    const codeMatch = remaining.match(/^([\s\S]*?)`(.+?)`([\s\S]*)/);
    // Italic: *text* (but not **)
    const italicMatch = remaining.match(/^([\s\S]*?)\*([^*]+?)\*([\s\S]*)/);
    // Skip italic if it looks like bold
    if (italicMatch && italicMatch[1].endsWith('*')) {
      parts.push(remaining);
      break;
    }

    // Find which match comes first
    const matches = [
      boldMatch ? { type: 'bold', index: boldMatch[1].length, match: boldMatch } : null,
      codeMatch ? { type: 'code', index: codeMatch[1].length, match: codeMatch } : null,
      italicMatch ? { type: 'italic', index: italicMatch[1].length, match: italicMatch } : null,
    ].filter(Boolean).sort((a, b) => a!.index - b!.index);

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    const first = matches[0]!;
    const m = first.match!;
    if (m[1]) parts.push(m[1]);

    if (first.type === 'bold') {
      parts.push(<strong key={key++}>{m[2]}</strong>);
    } else if (first.type === 'code') {
      parts.push(
        <code key={key++} style={{
          background: 'var(--surface-2)',
          padding: '1px 4px',
          borderRadius: '3px',
          fontSize: '0.9em',
          fontFamily: 'monospace',
        }}>{m[2]}</code>
      );
    } else {
      parts.push(<em key={key++}>{m[2]}</em>);
    }
    remaining = m[3];
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function generateFollowUps(responseText: string, docType?: string): SuggestedFollowUp[] {
  const suggestions: SuggestedFollowUp[] = [];
  const lower = responseText.toLowerCase();

  if (docType === 'model' || docType === 'spreadsheet') {
    if (lower.includes('formula') || lower.includes('calculation')) suggestions.push({ text: 'Verify all formulas are consistent' });
    if (lower.includes('revenue') || lower.includes('growth')) suggestions.push({ text: 'Add sensitivity analysis for key assumptions' });
    if (lower.includes('added') || lower.includes('updated')) suggestions.push({ text: 'Add totals and summary row' });
    if (suggestions.length === 0) suggestions.push({ text: 'Add a chart-ready summary' }, { text: 'Check for circular references' });
  } else if (docType === 'presentation' || docType === 'deck') {
    if (lower.includes('slide')) suggestions.push({ text: 'Add transition between these slides' });
    if (lower.includes('data') || lower.includes('number')) suggestions.push({ text: 'Add a data visualization slide' });
    if (suggestions.length === 0) suggestions.push({ text: 'Add speaker notes' }, { text: 'Improve visual hierarchy' });
  } else {
    if (lower.includes('risk') || lower.includes('weak')) suggestions.push({ text: 'Now strengthen the mitigants' });
    if (lower.includes('rewrite') || lower.includes('rewrote')) suggestions.push({ text: 'Make it even more concise' });
    if (lower.includes('section') || lower.includes('paragraph')) suggestions.push({ text: 'Now do the same for the next section' });
    if (lower.includes('number') || lower.includes('metric')) suggestions.push({ text: 'Cross-check numbers against the model' });
    if (suggestions.length === 0) suggestions.push({ text: 'Find more inconsistencies' }, { text: 'Strengthen the conclusion' });
  }

  return suggestions.slice(0, 3);
}

// Per-document message history (persists across document switches)
const docMessageCache = new Map<string, Message[]>();

export function AIChat({ documentId, documentContent, documentTitle, documentType, onApplyChange }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [followUps, setFollowUps] = useState<SuggestedFollowUp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [ratings, setRatings] = useState<Record<number, 'up' | 'down'>>({});
  const [pinnedMessages, setPinnedMessages] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const prevDocIdRef = useRef<string | null>(null);

  // Persist messages when switching documents
  useEffect(() => {
    // Save current messages for previous doc
    if (prevDocIdRef.current && prevDocIdRef.current !== documentId && messages.length > 0) {
      docMessageCache.set(prevDocIdRef.current, messages);
    }
    // Load messages for new doc
    if (documentId && documentId !== prevDocIdRef.current) {
      const cached = docMessageCache.get(documentId);
      setMessages(cached || []);
      setPendingChange(null);
    }
    prevDocIdRef.current = documentId;
  }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(m => m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text.trim(), timestamp: Date.now() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setFollowUps([]);

    try {
      abortControllerRef.current = new AbortController();
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.slice(-10),
          documentId,
          documentContent,
          documentTitle,
          documentType,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error('AI request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullText = '';
      const assistantIdx = newMessages.length;

      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now() }]);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullText += parsed.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[assistantIdx] = { role: 'assistant', content: fullText };
                return updated;});
            }
          } catch (e) { console.warn('[AICHAT_CHUNK]', e instanceof Error ? e.message : e); }
        }}

      const contentMatch = fullText.match(/<updated_content>([\s\S]*?)<\/updated_content>/);
      const cellMatch = fullText.match(/<cell_updates>([\s\S]*?)<\/cell_updates>/);
      const slideMatch = fullText.match(/<slide_updates>([\s\S]*?)<\/slide_updates>/);

      if (contentMatch) {
        const updatedContent = contentMatch[1].trim();
        const cleanResponse = fullText.replace(/<updated_content>[\s\S]*?<\/updated_content>/, '').trim();
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIdx] = { role: 'assistant', content: cleanResponse };
          return updated;});
        setPendingChange({ content: updatedContent, messageIdx: assistantIdx, summary: computeChangeSummary(documentContent, updatedContent, documentType) });
      } else if (cellMatch) {
        // Merge cell updates into existing spreadsheet content
        const cleanResponse = fullText.replace(/<cell_updates>[\s\S]*?<\/cell_updates>/, '').trim();
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIdx] = { role: 'assistant', content: cleanResponse };
          return updated;});
        try {
          const cellUpdates = JSON.parse(cellMatch[1].trim());
          const existing = documentContent ? JSON.parse(documentContent) : {};
          const cells = existing.cells || existing;
          // Apply each cell update
          for (const update of Array.isArray(cellUpdates) ? cellUpdates : Object.entries(cellUpdates).map(([ref, val]) => ({ ref, ...(val as object) }))) {
            const ref = update.ref || update.cell;
            if (!ref) continue;
            cells[ref] = {
              v: update.formula ? update.value : (isNaN(Number(update.value)) ? update.value : Number(update.value)),
              ...(update.formula ? { f: update.formula } : {}),
              t: isNaN(Number(update.value)) ? 's' : 'n',
              ...(update.bold ? { bold: true } : {}),
            };
          }
          const mergedContent = JSON.stringify(existing.cells ? { ...existing, cells } : cells, null, 2);
          setPendingChange({ content: mergedContent, messageIdx: assistantIdx, summary: computeChangeSummary(documentContent, mergedContent, documentType) });
        } catch {
          // If parsing fails, don't apply
          console.warn('[AICHAT] Failed to parse cell_updates');
        }
      } else if (slideMatch) {
        // Merge slide updates into existing presentation content
        const cleanResponse = fullText.replace(/<slide_updates>[\s\S]*?<\/slide_updates>/, '').trim();
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIdx] = { role: 'assistant', content: cleanResponse };
          return updated;});
        try {
          const slideUpdates = JSON.parse(slideMatch[1].trim());
          if (Array.isArray(slideUpdates)) {
            // Full slide array replacement
            setPendingChange({ content: JSON.stringify(slideUpdates, null, 2), messageIdx: assistantIdx });
          } else if (slideUpdates.action === 'update' && slideUpdates.slides) {
            // Partial update: merge specific slides
            const existing = documentContent ? JSON.parse(documentContent) : [];
            const slides = Array.isArray(existing) ? existing : existing.slides || [];
            for (const updated of slideUpdates.slides) {
              const idx = slides.findIndex((s: { id: string }) => s.id === updated.id);
              if (idx >= 0) {
                slides[idx] = { ...slides[idx], ...updated };
              } else {
                slides.push(updated);
              }
            }
            setPendingChange({ content: JSON.stringify(slides, null, 2), messageIdx: assistantIdx });
          }
        } catch {
          console.warn('[AICHAT] Failed to parse slide_updates');
        }
      }

      // Generate contextual follow-up suggestions
      const followUpSuggestions = generateFollowUps(fullText, documentType);
      if (followUpSuggestions.length > 0) setFollowUps(followUpSuggestions);
    } catch (e) {
      console.warn('[AICHAT_SEND]', e instanceof Error ? e.message : e);
      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
          updated[updated.length - 1] = { role: 'assistant', content: 'AI response failed — check your connection and try again.', error: true };
        } else {
          updated.push({ role: 'assistant', content: 'AI response failed — check your connection and try again.', error: true });
        }
        return updated;});
    } finally {
      setLoading(false);
    }
  }, [messages, loading, documentId, documentContent, documentTitle, documentType]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  }, []);

  const retryLast = useCallback(() => {
    const lastUserIdx = messages.findLastIndex(m => m.role === 'user');
    if (lastUserIdx === -1) return;
    const lastUserText = messages[lastUserIdx].content;
    setMessages(prev => prev.slice(0, lastUserIdx));
    setTimeout(() => sendMessage(lastUserText), 50);
  }, [messages, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }};

  const handleVoiceTranscript = (text: string) => {
    setInput(prev => prev + (prev ? ' ' : '') + text);
  };

  const copyMessage = (idx: number) => {
    navigator.clipboard.writeText(messages[idx].content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--surface-0)' }}>
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-2) var(--space-4)' }}>
        <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
          <Sparkles style={{ width: '16px', height: '16px', color: 'var(--accent)' }} />
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>AI Assistant</span>
        </div>
        {messages.length > 0 && (
          <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex items-center transition-colors icon-delete"
              style={{ fontSize: 'var(--font-size-xs)', gap: 'var(--space-1)', ...(showSearch ? { color: 'var(--accent)' } : {}) }}>
              <Search style={{ width: '12px', height: '12px' }} /></button>
            <button
              onClick={() => {
                const text = messages.map(m => `${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`).join('\n\n');
                navigator.clipboard.writeText(text);
              }}
              className="flex items-center transition-colors icon-delete"
              style={{ fontSize: 'var(--font-size-xs)', gap: 'var(--space-1)' }}>
              <Copy style={{ width: '12px', height: '12px' }} /> Copy all</button>
            <button
              onClick={() => {
                // Export as downloadable HTML file
                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${documentTitle} — AI Chat Export</title><style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;color:#333;line-height:1.6}.msg{margin:16px 0;padding:12px 16px;border-radius:8px}.user{background:#f0f4ff;border-left:3px solid #3b82f6}.ai{background:#f9f9f7;border-left:3px solid #888}.role{font-size:11px;font-weight:600;text-transform:uppercase;color:#888;margin-bottom:4px}hr{border:none;border-top:1px solid #eee;margin:24px 0}</style></head><body><h1>${documentTitle} — Chat Export</h1><p style="color:#888;font-size:13px">Exported ${new Date().toLocaleString()}</p><hr>${messages.map(m => `<div class="msg ${m.role}"><div class="role">${m.role === 'user' ? 'You' : 'AI Assistant'}</div><div>${m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div></div>`).join('')}</body></html>`;
                const blob = new Blob([html], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = window.document.createElement('a');
                a.href = url;
                a.download = `${documentTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_chat_export.html`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center transition-colors icon-delete"
              style={{ fontSize: 'var(--font-size-xs)', gap: 'var(--space-1)' }}>
              <FileDown style={{ width: '12px', height: '12px' }} /> Export</button>
            <button
              onClick={clearChat}
              className="flex items-center transition-colors icon-delete"
              style={{ fontSize: 'var(--font-size-xs)', gap: 'var(--space-1)' }}>
              <RotateCcw style={{ width: '12px', height: '12px' }} /> Clear</button>
          </div>
        )}</div>

      {/* Search bar */}
      {showSearch && (
        <div
          className="shrink-0 flex items-center"
          style={{ padding: '4px var(--space-3)', borderBottom: '1px solid var(--border-subtle)', gap: 'var(--space-2)' }}>
          <Search style={{ width: '14px', height: '14px', color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', border: 'none' }}
            onKeyDown={e => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); } }}
          />
          {searchQuery && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
              {filteredMessages.length} / {messages.length}
            </span>
          )}
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex' }}>
            <X style={{ width: '12px', height: '12px' }} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Pinned messages */}
        {pinnedMessages.size > 0 && (
          <div style={{
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: 'var(--space-3)',
            marginBottom: 'var(--space-2)',
          }}>
            <div className="flex items-center" style={{ gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
              <Pin style={{ width: '10px', height: '10px', color: 'var(--accent)', transform: 'rotate(-45deg)' }} />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>Pinned</span>
            </div>
            {Array.from(pinnedMessages).sort((a, b) => a - b).map(idx => {
              const msg = messages[idx];
              if (!msg) return null;
              return (
                <div key={`pin-${idx}`} style={{
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--accent-muted)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                  maxHeight: '60px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  position: 'relative',
                }}
                onClick={() => {
                  // Scroll to original message
                  const el = document.querySelector(`[data-msg-idx="${idx}"]`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                >
                  <span className="line-clamp-2">{msg.content.slice(0, 150)}{msg.content.length > 150 ? '...' : ''}</span>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '16px', background: 'linear-gradient(transparent, var(--surface-1))' }} />
                </div>
              );
            })}
          </div>
        )}

        {messages.length === 0 && (
          <div className="text-center" style={{ padding: 'var(--space-12) 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
            <Sparkles style={{ width: '32px', height: '32px', color: 'var(--text-muted)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <p style={textSmMuted}>Edit, critique, or rewrite any section of this document</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {(documentType === 'model' || documentType === 'spreadsheet' ? [
                  'Add a sensitivity analysis row',
                  'Check formulas for errors',
                  'Add revenue bridge assumptions',
                  'Recalculate growth rates',
                  'Add unit economics breakdown',
                ] : documentType === 'presentation' || documentType === 'deck' ? [
                  'Add a market size slide',
                  'Improve the title slide',
                  'Add speaker notes',
                  'Strengthen the returns slide',
                  'Add a competitive landscape slide',
                ] : [
                  'Make the executive summary more concise',
                  'Add quantitative evidence to the TAM section',
                  'Rewrite in Goldman style',
                  'Find weak arguments',
                  'Check for inconsistencies',
                ]).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="transition-colors"
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      background: 'var(--surface-1)',
                      color: 'var(--text-tertiary)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-1)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                  >
                    {suggestion}</button>
                ))}</div></div></div>
        )}

        {filteredMessages.map((msg, i) => (
          <div key={i} data-msg-idx={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%]"
              style={{
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--font-size-sm)',
                lineHeight: 1.6,
                background: msg.role === 'user' ? 'var(--accent-muted)' : 'var(--surface-1)',
                color: msg.role === 'user' ? 'var(--accent)' : 'var(--text-secondary)',
                border: `1px solid ${msg.role === 'user' ? 'var(--accent-10)' : 'var(--border-subtle)'}`,}}>
              <div className="whitespace-pre-wrap">{msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}</div>
              {msg.role === 'assistant' && (
                <div
                  className="flex items-center"
                  style={{
                    gap: 'var(--space-2)',
                    marginTop: 'var(--space-2)',
                    paddingTop: 'var(--space-2)',
                    borderTop: '1px solid var(--border-subtle)',}}>
                  <button
                    onClick={() => copyMessage(i)}
                    className="flex items-center transition-colors icon-delete"
                    style={{ fontSize: 'var(--font-size-xs)', gap: 'var(--space-1)' }}>
                    {copiedIdx === i ? <Check style={{ width: '12px', height: '12px' }} /> : <Copy style={{ width: '12px', height: '12px' }} />}
                    {copiedIdx === i ? 'Copied' : 'Copy'}</button>
                  <button
                    onClick={() => setPinnedMessages(prev => {
                      const next = new Set(prev);
                      if (next.has(i)) next.delete(i); else next.add(i);
                      return next;
                    })}
                    className="flex items-center transition-colors"
                    style={{
                      fontSize: 'var(--font-size-xs)', gap: 'var(--space-1)',
                      color: pinnedMessages.has(i) ? 'var(--accent)' : 'var(--text-muted)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                    }}>
                    <Pin style={{ width: '11px', height: '11px', transform: pinnedMessages.has(i) ? 'rotate(-45deg)' : 'none' }} />
                  </button>
                  {msg.error && (
                    <button
                      onClick={retryLast}
                      className="flex items-center transition-colors"
                      style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', gap: 'var(--space-1)' }}>
                      <RotateCcw style={{ width: '12px', height: '12px' }} /> Retry</button>
                  )}
                  <div className="flex items-center" style={{ gap: '2px' }}>
                    <button
                      onClick={() => setRatings(prev => ({ ...prev, [i]: prev[i] === 'up' ? undefined as unknown as 'up' : 'up' }))}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex',
                        color: ratings[i] === 'up' ? 'var(--success)' : 'var(--text-muted)',
                      }}
                      title="Helpful"
                    >
                      <ThumbsUp style={{ width: '11px', height: '11px' }} />
                    </button>
                    <button
                      onClick={() => setRatings(prev => ({ ...prev, [i]: prev[i] === 'down' ? undefined as unknown as 'down' : 'down' }))}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex',
                        color: ratings[i] === 'down' ? 'var(--danger)' : 'var(--text-muted)',
                      }}
                      title="Not helpful"
                    >
                      <ThumbsDown style={{ width: '11px', height: '11px' }} />
                    </button>
                  </div>
                  <span className="flex-1" />
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {msg.content.split(/\s+/).filter(Boolean).length} words
                  </span>
                  {msg.timestamp && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}</div>
              )}</div></div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2) var(--space-4)', border: '1px solid var(--border-subtle)', gap: 'var(--space-3)' }}>
              <div className="flex items-center" style={{ gap: '3px' }}>
                {[0, 1, 2].map(dot => (
                  <span
                    key={dot}
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      animation: `typingBounce 1.2s ease-in-out ${dot * 0.15}s infinite`,
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Thinking...</span>
              <button
                onClick={stopGeneration}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                title="Stop generating"
              >
                <Square style={{ width: '12px', height: '12px', fill: 'currentColor' }} />
              </button>
            </div>
          </div>
        )}
        {/* Follow-up suggestions */}
        {followUps.length > 0 && !loading && messages.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 'var(--space-2)', padding: '4px 0' }}>
            {followUps.map((fu, i) => (
              <button
                key={i}
                onClick={() => { setFollowUps([]); sendMessage(fu.text); }}
                style={{
                  fontSize: 'var(--font-size-xs)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-1)',
                  color: 'var(--text-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
              >
                {fu.text}
              </button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} /></div>

      {/* Pending changes banner */}
      {pendingChange && onApplyChange && (
        <div
          className="shrink-0"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--accent-muted)',
            padding: 'var(--space-3) var(--space-4)',}}>
          <div className="flex items-center justify-between">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: 'var(--accent)',
                  animation: 'typingBounce 2s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent)' }}>
                  {documentType === 'model' || documentType === 'spreadsheet'
                    ? 'AI has proposed cell updates'
                    : documentType === 'presentation' || documentType === 'deck'
                    ? 'AI has proposed slide changes'
                    : 'AI has proposed edits'}
                </span>
              </div>
              {pendingChange.summary && (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: '18px' }}>
                  {pendingChange.summary}
                </span>
              )}
            </div>
            <div className="flex" style={{ gap: 'var(--space-2)' }}>
              <button onClick={() => setPendingChange(null)} className="btn btn-ghost btn-sm">
                <XCircle style={{ width: '14px', height: '14px' }} /> Discard</button>
              <button
                onClick={() => {
                  onApplyChange(pendingChange.content);
                  setPendingChange(null);
                }}
                className="btn btn-primary btn-sm">
                <CheckCircle style={{ width: '14px', height: '14px' }} /> Apply Changes</button></div></div></div>
      )}

      {/* Input */}
      <div className="shrink-0" style={{ borderTop: '1px solid var(--border-subtle)', padding: 'var(--space-3)' }}>
        <div className="flex items-end" style={{ gap: 'var(--space-2)' }}>
          <VoiceInput onTranscript={handleVoiceTranscript} disabled={loading} />
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={!documentId ? 'Select a document first...' : documentType === 'model' || documentType === 'spreadsheet' ? 'e.g. "Add bear case assumptions" or "Fix the COGS formula"' : documentType === 'presentation' || documentType === 'deck' ? 'e.g. "Add a TAM slide" or "Make the title more impactful"' : 'e.g. "Sharpen the risk factors" or "Rewrite Section 3 for a growth equity IC"'}
              disabled={loading || !documentId}
              rows={1}
              maxLength={5000}
              className="input resize-none"
              style={{
                borderRadius: 'var(--radius-lg)',
                paddingRight: 'var(--space-10)',
                opacity: loading || !documentId ? 0.5 : 1,
              }}/>
            {input.length > 50 && (
              <span style={{
                position: 'absolute',
                bottom: '4px',
                right: '8px',
                fontSize: '10px',
                color: input.length > 4500 ? 'var(--danger)' : 'var(--text-muted)',
              }}>
                {input.length > 100 ? `${input.length}/5000` : `${input.split(/\s+/).filter(Boolean).length}w`}
              </span>
            )}</div>
          {loading ? (
            <button
              onClick={stopGeneration}
              className="btn btn-md"
              style={{
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--danger)',
                color: 'white',
                border: 'none',
              }}
              title="Stop generating"
            >
              <Square style={{ width: '14px', height: '14px', fill: 'currentColor' }} />
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || !documentId}
              className="btn btn-primary btn-md"
              style={{
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-lg)',
                opacity: !input.trim() || !documentId ? 0.3 : 1,
              }}
            >
              <Send style={{ width: '16px', height: '16px' }} />
            </button>
          )}</div></div>
    </div>);
}
