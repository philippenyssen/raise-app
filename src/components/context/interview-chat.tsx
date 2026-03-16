'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  extractedFields?: Record<string, string>;
}

interface InterviewChatProps {
  onFieldsExtracted: (fields: Record<string, string>) => void;
  completionPct: number;
}

const FIELD_LABELS: Record<string, string> = {
  company_name: 'Company Name', founded_year: 'Year Founded', hq_location: 'Headquarters',
  sector: 'Sector', stage: 'Stage', mission: 'Mission', employee_count: 'Employees', website: 'Website',
  product_description: 'Product', key_differentiators: 'Differentiators', moat: 'Moat',
  ip_portfolio: 'IP Portfolio', tech_stack: 'Tech Stack', product_roadmap: 'Roadmap',
  tam: 'TAM', sam: 'SAM', som: 'SOM', market_trends: 'Market Trends', competitive_landscape: 'Competition',
  revenue_current: 'Revenue', revenue_growth: 'Growth', key_customers: 'Customers',
  customer_count: 'Customer Count', key_metrics: 'KPIs', contracts_backlog: 'Backlog',
  founder_bio: 'Founder', leadership_team: 'Team', key_hires_planned: 'Hires', board_members: 'Board',
  financial_summary: 'Financials', unit_economics: 'Unit Economics', burn_rate: 'Burn Rate',
  runway: 'Runway', cap_table: 'Cap Table', previous_rounds: 'Previous Rounds',
  raise_amount: 'Raise Amount', valuation: 'Valuation', use_of_proceeds: 'Use of Proceeds',
  target_investors: 'Target Investors', timeline: 'Timeline',
  one_paragraph_pitch: 'Pitch', three_beliefs: 'Core Beliefs',
  corporate_structure: 'Structure', key_contracts: 'Contracts', regulatory: 'Regulatory',
};

const msgBubbleUser: React.CSSProperties = {
  padding: 'var(--space-3)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent)',
  color: 'var(--surface-0)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 300,
  maxWidth: '85%',
  alignSelf: 'flex-end',
  lineHeight: 1.5,
};

const msgBubbleAssistant: React.CSSProperties = {
  padding: 'var(--space-3)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-1)',
  color: 'var(--text-primary)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 300,
  maxWidth: '85%',
  alignSelf: 'flex-start',
  lineHeight: 1.5,
  border: '1px solid var(--border-subtle)',
};

const extractedPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--success-muted)',
  color: 'var(--success)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 400,
};

function extractContextUpdate(text: string): { cleanText: string; fields: Record<string, string> | null } {
  const match = text.match(/<context_update>\s*([\s\S]*?)\s*<\/context_update>/);
  if (!match) return { cleanText: text, fields: null };

  const cleanText = text.replace(/<context_update>[\s\S]*?<\/context_update>/, '').trim();
  try {
    const fields = JSON.parse(match[1]);
    if (typeof fields === 'object' && fields !== null) {
      return { cleanText, fields };
    }
  } catch { /* ignore parse errors */ }
  return { cleanText: text, fields: null };
}

export function InterviewChat({ onFieldsExtracted, completionPct }: InterviewChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [started, setStarted] = useState(false);
  const [totalExtracted, setTotalExtracted] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (userMessage?: string) => {
    const text = userMessage || input.trim();
    if (!text && started) return;

    const newMessages: Message[] = started
      ? [...messages, { role: 'user', content: text }]
      : messages;

    if (started) {
      setMessages(newMessages);
      setInput('');
    }

    setStreaming(true);
    if (!started) setStarted(true);

    try {
      const res = await fetch('/api/context/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Stream failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';
      const assistantIdx = newMessages.length;

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === 'text' && parsed.text) {
              fullText += parsed.text;
              setMessages(prev => {
                const updated = [...prev];
                if (updated[assistantIdx]) {
                  updated[assistantIdx] = { role: 'assistant', content: fullText };
                }
                return updated;
              });
            }
          } catch { /* skip malformed JSON */ }
        }
      }

      // Extract context updates from completed message
      const { cleanText, fields } = extractContextUpdate(fullText);
      if (fields && Object.keys(fields).length > 0) {
        onFieldsExtracted(fields);
        setTotalExtracted(prev => prev + Object.keys(fields).length);
        setMessages(prev => {
          const updated = [...prev];
          if (updated[assistantIdx]) {
            updated[assistantIdx] = {
              role: 'assistant',
              content: cleanText,
              extractedFields: fields,
            };
          }
          return updated;
        });
      }
    } catch (e) {
      console.warn('[INTERVIEW]', e instanceof Error ? e.message : e);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, messages, started, onFieldsExtracted]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ padding: 'var(--space-6)' }}>
        <div style={{ color: 'var(--accent)' }}>
          <Sparkles className="w-8 h-8" />
        </div>
        <div className="text-center">
          <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
            AI Context Interview
          </div>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', maxWidth: '400px' }}>
            Have a conversation instead of filling forms. The AI will ask you about your company and automatically fill in the context fields.
          </p>
        </div>
        <button
          onClick={() => sendMessage('Help me fill in my company context for my Series C fundraise.')}
          className="btn btn-primary btn-md flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Start Interview
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Extraction counter */}
      {totalExtracted > 0 && (
        <div className="flex items-center gap-2" style={{
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--success-muted)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--success)',
        }}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          {totalExtracted} fields extracted · {completionPct}% complete
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto flex flex-col gap-3"
        style={{ padding: 'var(--space-3)' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <div style={msg.role === 'user' ? msgBubbleUser : msgBubbleAssistant}>
              {msg.content.split('\n').map((line, j) => (
                <span key={j}>
                  {line}
                  {j < msg.content.split('\n').length - 1 && <br />}
                </span>
              ))}
            </div>
            {msg.extractedFields && Object.keys(msg.extractedFields).length > 0 && (
              <div className="flex flex-wrap gap-1" style={{ alignSelf: 'flex-start', marginLeft: 'var(--space-1)' }}>
                {Object.keys(msg.extractedFields).map(key => (
                  <span key={key} style={extractedPill}>
                    <CheckCircle2 className="w-3 h-3" />
                    {FIELD_LABELS[key] || key}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {streaming && messages.length > 0 && messages[messages.length - 1].content === '' && (
          <div style={{ ...msgBubbleAssistant, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: 'var(--space-3)',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--surface-0)',
      }}>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
            placeholder="Answer the questions..."
            rows={1}
            style={{
              flex: 1,
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-1)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'inherit',
              fontWeight: 300,
              resize: 'none',
              minHeight: '38px',
              maxHeight: '120px',
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={streaming || !input.trim()}
            className="btn btn-primary shrink-0 flex items-center justify-center"
            style={{
              width: '38px', height: '38px', padding: 0,
              opacity: streaming || !input.trim() ? 0.5 : 1,
            }}>
            {streaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
