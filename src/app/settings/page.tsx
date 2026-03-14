'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw, Key } from 'lucide-react';

interface KeyTest {
  status: string;
  message: string;
  key?: string;
  fix?: string | string[];
  error?: string;
}

export default function SettingsPage() {
  const [keyTest, setKeyTest] = useState<KeyTest | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => { testKey(); }, []);

  async function testKey() {
    setTesting(true);
    try {
      const res = await fetch('/api/test-key');
      setKeyTest(await res.json());
    } catch {
      setKeyTest({ status: 'error', message: 'Could not reach test endpoint' });
    } finally {
      setTesting(false);
    }
  }

  const statusIcon = keyTest?.status === 'ok'
    ? <CheckCircle className="w-5 h-5 text-green-400" />
    : keyTest?.status === 'credits_issue'
    ? <AlertTriangle className="w-5 h-5 text-yellow-400" />
    : <XCircle className="w-5 h-5 text-red-400" />;

  const statusColor = keyTest?.status === 'ok' ? 'border-green-800 bg-green-900/20' : keyTest?.status === 'credits_issue' ? 'border-yellow-800 bg-yellow-900/20' : 'border-red-800 bg-red-900/20';

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">API configuration & diagnostics</p>
      </div>

      {/* API Key Status */}
      <div className={`border rounded-xl p-6 ${statusColor}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-zinc-400" />
            <h2 className="text-lg font-semibold">Anthropic API Key</h2>
          </div>
          <button
            onClick={testKey}
            disabled={testing}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            Test Key
          </button>
        </div>

        {keyTest && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              {statusIcon}
              <div>
                <div className="font-medium">{keyTest.message}</div>
                {keyTest.key && (
                  <div className="text-xs text-zinc-500 mt-1 font-mono">{keyTest.key}</div>
                )}
              </div>
            </div>

            {keyTest.error && (
              <div className="text-sm text-red-400 bg-red-900/20 rounded-lg p-3 font-mono text-xs">
                {keyTest.error}
              </div>
            )}

            {keyTest.fix && (
              <div className="bg-zinc-900 rounded-lg p-4 space-y-2">
                <div className="text-sm font-medium text-zinc-300">How to fix:</div>
                {Array.isArray(keyTest.fix) ? (
                  <ol className="text-sm text-zinc-400 space-y-1">
                    {keyTest.fix.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-zinc-400">{keyTest.fix}</p>
                )}
              </div>
            )}
          </div>
        )}

        {testing && !keyTest && (
          <div className="text-sm text-zinc-400 animate-pulse">Testing API key...</div>
        )}
      </div>

      {/* Important Note */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <h3 className="text-sm font-medium text-zinc-400 mb-3">IMPORTANT: Claude.ai vs API Credits</h3>
        <div className="text-sm text-zinc-500 space-y-2">
          <p>Anthropic has <strong className="text-zinc-300">two separate billing systems</strong>:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-zinc-300">claude.ai</strong> --- subscription credits for the chatbot (Claude Pro/Team)</li>
            <li><strong className="text-zinc-300">console.anthropic.com</strong> --- API credits for programmatic access (what this app uses)</li>
          </ul>
          <p>Credits on claude.ai do <strong className="text-red-400">NOT</strong> apply to API usage. You need credits specifically on <strong className="text-zinc-300">console.anthropic.com/settings/billing</strong>.</p>
          <p className="mt-3">If the test above shows a credits issue:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Go to <strong className="text-zinc-300">console.anthropic.com/settings/billing</strong></li>
            <li>Click <strong className="text-zinc-300">&ldquo;Add to credit balance&rdquo;</strong> (minimum $5)</li>
            <li>Then go to <strong className="text-zinc-300">console.anthropic.com/settings/keys</strong></li>
            <li>Create a <strong className="text-zinc-300">new API key</strong></li>
            <li>Update it in your <strong className="text-zinc-300">Vercel environment variables</strong></li>
            <li><strong className="text-zinc-300">Redeploy</strong> the app</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
