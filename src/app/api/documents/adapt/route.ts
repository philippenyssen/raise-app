import { NextRequest, NextResponse } from 'next/server';
import { getDocument } from '@/lib/db';
import { getAIClient, AI_MODEL } from '@/lib/ai';
import { checkRateLimit } from '@/lib/api-helpers';
import { getNarrativeProfile } from '@/lib/investor-narratives';
import type { InvestorType } from '@/lib/types';

export interface AdaptationSuggestion {
  section: string;
  suggestion: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: 'strengthen' | 'add' | 'remove' | 'reframe';
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit('documents-adapt')) { return NextResponse.json({ error: 'Too many requests' }, { status: 429 }); }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  try {
    const document_id = body.document_id as string | undefined;
    const investor_type = body.investor_type as string | undefined;

    if (!document_id || !investor_type) {
      return NextResponse.json(
        { error: 'document_id and investor_type are required' },
        { status: 400 },);
    }

    // Validate investor type
    const validTypes: InvestorType[] = ['vc', 'growth', 'sovereign', 'strategic', 'debt', 'family_office'];
    if (!validTypes.includes(investor_type as InvestorType)) {
      return NextResponse.json(
        { error: `Invalid investor_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 },);
    }

    // Load document
    const document = await getDocument(document_id);
    if (!document) { return NextResponse.json({ error: 'Document not found' }, { status: 404 }); }

    // Get narrative profile
    const narrative = getNarrativeProfile(investor_type as InvestorType);

    // Labels for investor types
    const typeLabels: Record<string, string> = {
      vc: 'Venture Capital',
      growth: 'Growth Equity',
      sovereign: 'Sovereign Wealth Fund',
      strategic: 'Strategic Investor',
      debt: 'Debt Provider',
      family_office: 'Family Office',};

    // Call Claude to analyze the document against the narrative profile
    const response = await getAIClient().messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `You are an expert fundraising document advisor. Analyze this document and suggest specific modifications to optimize it for a ${typeLabels[investor_type]} investor.

DOCUMENT TITLE: ${document.title}
DOCUMENT TYPE: ${document.type}

NARRATIVE PROFILE FOR ${typeLabels[investor_type].toUpperCase()} INVESTORS:
- They care about: ${narrative.emphasis.join(', ')}
- Key metrics they want: ${narrative.keyMetrics.join(', ')}
- Opening hook that works: ${narrative.openingHook}
- Tone guidance: ${narrative.toneGuidance}
- Topics to avoid: ${narrative.avoidTopics.join(', ')}
- Data room priorities: ${narrative.dataRoomPriority.join(', ')}
- Questions they will ask: ${narrative.anticipatedQuestions.join('; ')}

DOCUMENT CONTENT (first 6000 chars):
${document.content.substring(0, 6000)}

Analyze this document and return JSON (no markdown):
{
  "suggestions": [
    {
      "section": "Which section of the document (be specific — quote the heading or first few words)",
      "suggestion": "Specific, actionable suggestion. Say exactly what to change and why.",
      "priority": "critical|high|medium|low",
      "type": "strengthen|add|remove|reframe"
    }],
  "overall_assessment": "2-3 sentence overall assessment of how well this document serves ${typeLabels[investor_type]} investors",
  "missing_sections": ["Sections that should be added for this investor type but are currently absent"],
  "strongest_sections": ["Sections that already work well for this investor type"]
}

Rules:
- Be specific: reference actual sections by name/heading.
- Priority "critical" = document will fail without this change.
- Priority "high" = significantly weakens the pitch.
- Priority "medium" = noticeable improvement.
- Priority "low" = nice to have.
- Type "strengthen" = section exists but needs more depth/data.
- Type "add" = content is missing entirely.
- Type "remove" = content actively hurts with this investor type.
- Type "reframe" = content is there but positioned wrong.
- Return 5-10 suggestions, ranked by priority.`,
      }],});

    const block = response.content[0];
    const text = block?.type === 'text' && block.text ? block.text : '{}';
    if (response.stop_reason === 'max_tokens') console.error('[DOC_ADAPT] Response truncated — JSON may be incomplete');
    let result: {
      suggestions: AdaptationSuggestion[];
      overall_assessment: string;
      missing_sections: string[];
      strongest_sections: string[];
    } = {
      suggestions: [],
      overall_assessment: 'Could not analyze document.',
      missing_sections: [],
      strongest_sections: [],};

    try {
      result = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { result = JSON.parse(jsonMatch[0]); } catch { /* use default */ }
      }}

    return NextResponse.json({
      document_id,
      document_title: document.title,
      investor_type,
      investor_type_label: typeLabels[investor_type],
      narrative_profile: {
        emphasis: narrative.emphasis,
        key_metrics: narrative.keyMetrics,
        tone_guidance: narrative.toneGuidance,},
      ...result,
      generated_at: new Date().toISOString(),});
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to generate adaptation suggestions' },
      { status: 500 },);
  }}
