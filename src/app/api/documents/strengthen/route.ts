import { NextResponse } from 'next/server';
import { getQuestionPatterns, getAllDocuments, createDocumentFlag } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

// Topic keywords for content matching
const TOPIC_KEYWORDS: Record<string, string[]> = {
  valuation: ['valuation', 'multiple', 'sotp', 'ev/', 'price', 'premium', 'discount', 'comparable'],
  competition: ['compet', 'rival', 'iceye', 'airbus', 'thales', 'rocket lab', 'moat', 'barrier'],
  execution: ['execut', 'deliver', 'timeline', 'milestone', 'schedule', 'ramp', 'production'],
  team: ['team', 'management', 'founder', 'ceo', 'cto', 'hire', 'talent', 'leadership'],
  market_size: ['tam', 'market size', 'addressable', 'opportunity', 'growth rate'],
  technology: ['technolog', 'platform', 'architecture', 'satellite', 'oisl', 'payload'],
  financials: ['revenue', 'ebitda', 'margin', 'cash flow', 'burn', 'profitab'],
  regulation: ['regulat', 'itar', 'compliance', 'export', 'fdi', 'approval', 'government'],
  iris2: ['iris2', 'iris-2', 'constellation', 'esa', 'eu commission'],
  exit: ['exit', 'ipo', 'liquidity', 'return', 'moic', 'multiple on invested'],
  governance: ['governance', 'board', 'reporting', 'rights', 'protection'],
  dilution: ['dilution', 'ownership', 'cap table', 'anti-dilut'],
};

/**
 * POST /api/documents/strengthen
 *
 * Analyzes cross-investor question convergence patterns against existing documents.
 * Creates document_flags (narrative_weakness type) for documents that need strengthening
 * based on topics that multiple investors are questioning.
 */
export async function POST() {
  try {
    // 1. Fetch question patterns (convergence data)
    const patterns = await getQuestionPatterns();
    const convergencePatterns = patterns.filter(p => p.investorCount >= 2);

    if (convergencePatterns.length === 0) {
      return NextResponse.json({
        flagsCreated: 0,
        message: 'No convergence patterns detected — fewer than 2 investors asking about the same topics',
        patterns: [],
      });
    }

    // 2. Fetch all documents
    const documents = await getAllDocuments();

    if (documents.length === 0) {
      return NextResponse.json({
        flagsCreated: 0,
        message: 'No documents found in the system',
        patterns: convergencePatterns.map(p => ({ topic: p.topic, investorCount: p.investorCount })),
      });
    }

    // 3. For each convergence pattern, check if any document covers that topic
    const flagsCreated: Array<{
      documentId: string;
      documentTitle: string;
      topic: string;
      investorCount: number;
      questionCount: number;
      description: string;
    }> = [];

    for (const pattern of convergencePatterns) {
      const keywords = TOPIC_KEYWORDS[pattern.topic] || [pattern.topic.toLowerCase()];

      // Find documents that contain this topic (search title + content)
      const matchingDocs = documents.filter(doc => {
        const searchText = `${doc.title} ${doc.content}`.toLowerCase();
        return keywords.some(kw => searchText.includes(kw));
      });

      if (matchingDocs.length === 0) {
        // No document covers this topic at all — flag the first memo/pitch doc
        const primaryDoc = documents.find(d => ['memo', 'pitch', 'exec_brief', 'one_pager'].includes(d.type)) || documents[0];
        if (primaryDoc) {
          const description = `${pattern.investorCount} investors questioned "${pattern.topic}" but no document adequately covers this topic — create or strengthen content`;
          const flag = await createDocumentFlag({
            document_id: primaryDoc.id,
            meeting_id: '',
            investor_id: '',
            investor_name: pattern.investorNames.join(', '),
            flag_type: 'section_improvement',
            description,
            section_hint: `Topic: ${pattern.topic}`,
            objection_text: pattern.recentQuestions.slice(0, 2).join('; '),
            status: 'open',
          });

          flagsCreated.push({
            documentId: primaryDoc.id,
            documentTitle: primaryDoc.title,
            topic: pattern.topic,
            investorCount: pattern.investorCount,
            questionCount: pattern.questionCount,
            description,
          });

          emitContextChange('document_updated', `Auto-flag: "${pattern.topic}" weakness in ${primaryDoc.title} (${pattern.investorCount} investors questioning)`);
        }
      } else {
        // Document covers the topic but multiple investors still questioning it — flag for strengthening
        for (const doc of matchingDocs) {
          const description = `${pattern.investorCount} investors questioned "${pattern.topic}" — strengthen this section (${pattern.questionCount} questions total)`;
          const flag = await createDocumentFlag({
            document_id: doc.id,
            meeting_id: '',
            investor_id: '',
            investor_name: pattern.investorNames.join(', '),
            flag_type: 'section_improvement',
            description,
            section_hint: `Topic: ${pattern.topic}`,
            objection_text: pattern.recentQuestions.slice(0, 2).join('; '),
            status: 'open',
          });

          flagsCreated.push({
            documentId: doc.id,
            documentTitle: doc.title,
            topic: pattern.topic,
            investorCount: pattern.investorCount,
            questionCount: pattern.questionCount,
            description,
          });

          emitContextChange('document_updated', `Auto-flag: "${pattern.topic}" narrative weakness in ${doc.title} (${pattern.investorCount} investors questioning)`);
        }
      }
    }

    return NextResponse.json({
      flagsCreated: flagsCreated.length,
      message: `Created ${flagsCreated.length} document strengthening flag(s) across ${new Set(flagsCreated.map(f => f.documentId)).size} document(s)`,
      flags: flagsCreated,
      convergencePatterns: convergencePatterns.map(p => ({
        topic: p.topic,
        investorCount: p.investorCount,
        questionCount: p.questionCount,
        investorNames: p.investorNames,
      })),
    });
  } catch (error) {
    console.error('Document strengthen error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze documents for strengthening', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
