'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, RotateCcw, Copy, Check, CheckCircle, XCircle } from 'lucide-react';
import { VoiceInput } from './voice-input';

interface Message { role: 'user' | 'assistant'; content: string; error?: boolean; }

interface AIChatProps {
  documentId: string | null;
  documentContent: string;
  documentTitle: string;
  onApplyChange?: (newContent: string) => void;
}

interface PendingChange { content: string; messageIdx: number; }

export function AIChat({ documentId, documentContent, documentTitle, onApplyChange }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    const userMessage: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.slice(-10),
          documentId,
          documentContent,
          documentTitle,
        }),});

      if (!res.ok) throw new Error('AI request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullText = '';
      const assistantIdx = newMessages.length;

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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

      if (contentMatch) {
        const updatedContent = contentMatch[1].trim();
        const cleanResponse = fullText.replace(/<updated_content>[\s\S]*?<\/updated_content>/, '').trim();
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIdx] = { role: 'assistant', content: cleanResponse };
          return updated;});
        setPendingChange({ content: updatedContent, messageIdx: assistantIdx });
      } else if (cellMatch && onApplyChange) {
        const cleanResponse = fullText.replace(/<cell_updates>[\s\S]*?<\/cell_updates>/, '').trim();
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantIdx] = { role: 'assistant', content: cleanResponse };
          return updated;});
        setPendingChange({ content: fullText, messageIdx: assistantIdx });
      }
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
  }, [messages, loading, documentId, documentContent, documentTitle]);

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
          <button
            onClick={clearChat}
            className="flex items-center transition-colors icon-delete"
            style={{ fontSize: 'var(--font-size-xs)', gap: 'var(--space-1)' }}>
            <RotateCcw style={{ width: '12px', height: '12px' }} /> Clear</button>
        )}</div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {messages.length === 0 && (
          <div className="text-center" style={{ padding: 'var(--space-12) 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
            <Sparkles style={{ width: '32px', height: '32px', color: 'var(--text-muted)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Edit, critique, or rewrite any section of this document</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  'Make the executive summary more concise',
                  'Add quantitative evidence to the TAM section',
                  'Rewrite in Goldman style',
                  'Find weak arguments',
                  'Check for inconsistencies',
                ].map((suggestion) => (
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

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
              <div className="whitespace-pre-wrap">{msg.content}</div>
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
                  {msg.error && (
                    <button
                      onClick={retryLast}
                      className="flex items-center transition-colors"
                      style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', gap: 'var(--space-1)' }}>
                      <RotateCcw style={{ width: '12px', height: '12px' }} /> Retry</button>
                  )}</div>
              )}</div></div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-4)', border: '1px solid var(--border-subtle)' }}>
              <Loader2 style={{ width: '16px', height: '16px', color: 'var(--accent)' }} className="animate-spin" /></div></div>
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
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent)' }}>AI has proposed edits — review before applying</span>
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
              placeholder={documentId ? 'e.g. "Sharpen the risk factors" or "Rewrite Section 3 for a growth equity IC"' : 'Select a document first...'}
              disabled={loading || !documentId}
              rows={1}
              maxLength={5000}
              className="input resize-none"
              style={{
                borderRadius: 'var(--radius-lg)',
                paddingRight: 'var(--space-10)',
                opacity: loading || !documentId ? 0.5 : 1,
              }}/></div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading || !documentId}
            className="btn btn-primary btn-md"
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-lg)',
              opacity: !input.trim() || loading || !documentId ? 0.3 : 1,}}>
            <Send style={{ width: '16px', height: '16px' }} /></button></div></div>
    </div>);
}
