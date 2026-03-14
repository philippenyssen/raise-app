'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Sparkles, RotateCcw, Copy, Check, CheckCircle, XCircle } from 'lucide-react';
import { VoiceInput } from './voice-input';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatProps {
  documentId: string | null;
  documentContent: string;
  documentTitle: string;
  onApplyChange?: (newContent: string) => void;
}

interface PendingChange {
  content: string;
  messageIdx: number;
}

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

  // Auto-resize textarea
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
          messages: newMessages.slice(-10), // Send last 10 messages to stay within context limits
          documentId,
          documentContent,
          documentTitle,
        }),
      });

      if (!res.ok) throw new Error('AI request failed');

      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.response }]);

      // If the AI returned updated content, stage it for review (don't auto-apply)
      if (data.updatedContent) {
        setPendingChange({ content: data.updatedContent, messageIdx: newMessages.length });
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, documentId, documentContent, documentTitle, onApplyChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

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
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium">AI Assistant</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-4">
            <Sparkles className="w-8 h-8 text-zinc-700 mx-auto" />
            <div className="space-y-2">
              <p className="text-sm text-zinc-500">Ask me anything about this document</p>
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
                    className="text-xs bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-800 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600/20 text-blue-100 border border-blue-600/20'
                : 'bg-zinc-800/50 text-zinc-200 border border-zinc-800'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-zinc-700/30">
                  <button
                    onClick={() => copyMessage(i)}
                    className="text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-1 transition-colors"
                  >
                    {copiedIdx === i ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedIdx === i ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800/50 rounded-xl px-4 py-3 border border-zinc-800">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending changes banner */}
      {pendingChange && onApplyChange && (
        <div className="shrink-0 border-t border-zinc-800 bg-blue-950/30 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-300">AI has proposed document changes</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingChange(null)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Discard
              </button>
              <button
                onClick={() => {
                  onApplyChange(pendingChange.content);
                  setPendingChange(null);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-800 p-3">
        <div className="flex items-end gap-2">
          <VoiceInput onTranscript={handleVoiceTranscript} disabled={loading} />
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={documentId ? 'Ask about this document, or tell me what to improve...' : 'Select a document first...'}
              disabled={loading || !documentId}
              rows={1}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 pr-10 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600/50 resize-none disabled:opacity-50"
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading || !documentId}
            className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-xl transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
