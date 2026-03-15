import { NextResponse } from 'next/server';
import { AI_MODEL } from '@/lib/ai';

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return NextResponse.json({
      status: 'error',
      message: 'ANTHROPIC_API_KEY is not set in environment variables.',
      fix: 'Add ANTHROPIC_API_KEY to your Vercel environment variables and redeploy.',
    });
  }

  const masked = key.substring(0, 12) + '...' + key.substring(key.length - 4);

  try {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Say OK' }],
      }),
      signal: ac.signal,
    });
    clearTimeout(tid);

    const data = await res.json();

    if (res.ok) {
      return NextResponse.json({
        status: 'ok',
        message: 'API key is working. AI features are operational.',
        key: masked,
      });
    }

    // Parse specific error types
    const errorMsg = data?.error?.message || 'Unknown error';
    const errorType = data?.error?.type || 'unknown';

    if (errorMsg.includes('credit balance') || errorMsg.includes('too low')) {
      return NextResponse.json({
        status: 'credits_issue',
        message: 'API key is valid but has no credits.',
        key: masked,
        error: errorMsg,
        fix: [
          '1. Go to console.anthropic.com/settings/billing',
          '2. The $25 credit shown might be for Claude.ai chat, NOT for the API.',
          '3. Click "Add to credit balance" to add API-specific credits (min $5).',
          '4. If credits are already there: DELETE this key, create a NEW key, update it in Vercel, and redeploy.',
          '5. Make sure you are in the correct Organization/Workspace when creating the key.',
        ],
      });
    }

    if (errorType === 'authentication_error') {
      return NextResponse.json({
        status: 'auth_error',
        message: 'API key is invalid or expired.',
        key: masked,
        error: errorMsg,
        fix: 'Generate a new API key at console.anthropic.com/settings/keys',
      });
    }

    return NextResponse.json({
      status: 'error',
      message: errorMsg,
      key: masked,
      raw: data,
    });
  } catch (err) {
    console.error('[TEST_KEY]', err instanceof Error ? err.message : err);
    return NextResponse.json({
      status: 'network_error',
      message: `Could not reach Anthropic API: ${err instanceof Error ? err.message : 'unknown'}`,
      key: masked,
    });
  }
}
