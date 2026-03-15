import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { filename, mime_type, base64_content } = body as { filename: string; mime_type: string; base64_content: string };

  if (!base64_content) {
    return NextResponse.json({ text: '' });
  }

  try {
    // For PDF files, extract text using basic parsing
    if (filename.toLowerCase().endsWith('.pdf') || mime_type === 'application/pdf') {
      const text = extractPdfText(base64_content);
      return NextResponse.json({ text });
    }

    // For CSV/TSV, decode directly
    if (filename.toLowerCase().match(/\.(csv|tsv)$/)) {
      const text = Buffer.from(base64_content, 'base64').toString('utf-8');
      return NextResponse.json({ text });
    }

    // For Office docs, extract what we can
    if (filename.toLowerCase().match(/\.(xlsx|xls)$/)) {
      const text = `[Excel file: ${filename}. For best results, export as CSV and re-upload, or paste the key data using the "Paste Text" button.]`;
      return NextResponse.json({ text });
    }

    if (filename.toLowerCase().match(/\.(docx|doc)$/)) {
      const text = extractDocxText(base64_content);
      return NextResponse.json({ text });
    }

    if (filename.toLowerCase().match(/\.pptx$/)) {
      const text = `[PowerPoint file: ${filename}. For best results, paste the slide content using the "Paste Text" button.]`;
      return NextResponse.json({ text });
    }

    // Fallback: try reading as text
    try {
      const text = Buffer.from(base64_content, 'base64').toString('utf-8');
      // Check if it looks like text (no excessive null bytes)
      const nullCount = (text.match(/\0/g) || []).length;
      if (nullCount / text.length < 0.01) {
        return NextResponse.json({ text: text.substring(0, 50000) });
      }
    } catch { /* not text */ }

    return NextResponse.json({
      text: `[Binary file: ${filename} (${mime_type}). Paste the text content manually for best results.]`,
    });
  } catch (err) {
    console.error('Text extraction error:', err);
    return NextResponse.json({
      text: `[File: ${filename}. Text extraction failed — paste content manually.]`,
    });
  }
}

// Basic PDF text extraction — extracts visible text from PDF stream objects
function extractPdfText(base64: string): string {
  try {
    const buffer = Buffer.from(base64, 'base64');
    const raw = buffer.toString('latin1');

    const textParts: string[] = [];

    // Extract text between BT (begin text) and ET (end text) operators
    const btEtRegex = /BT\s([\s\S]*?)ET/g;
    let match;
    while ((match = btEtRegex.exec(raw)) !== null) {
      const block = match[1];
      // Extract text from Tj and TJ operators
      const tjRegex = /\((.*?)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        textParts.push(tjMatch[1]);
      }
      // TJ array
      const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
      let tjArrayMatch;
      while ((tjArrayMatch = tjArrayRegex.exec(block)) !== null) {
        const inner = tjArrayMatch[1];
        const stringRegex = /\((.*?)\)/g;
        let strMatch;
        while ((strMatch = stringRegex.exec(inner)) !== null) {
          textParts.push(strMatch[1]);
        }
      }
    }

    if (textParts.length > 0) {
      return textParts.join(' ').substring(0, 50000);
    }

    return `[PDF file with ${Math.round(buffer.length / 1024)}KB. Text extraction found no readable text — the PDF may use scanned images. Paste the content manually for best results.]`;
  } catch {
    return '[PDF text extraction failed. Paste content manually.]';
  }
}

// Basic DOCX text extraction — DOCX is a ZIP containing XML
function extractDocxText(base64: string): string {
  try {
    const buffer = Buffer.from(base64, 'base64');
    const raw = buffer.toString('latin1');

    // DOCX is a ZIP. Find word/document.xml inside it.
    // Look for the XML content between PK entries
    const textParts: string[] = [];

    // Simple approach: find XML text nodes
    const xmlTextRegex = /<w:t[^>]*>(.*?)<\/w:t>/g;
    let match;
    while ((match = xmlTextRegex.exec(raw)) !== null) {
      textParts.push(match[1]);
    }

    if (textParts.length > 0) {
      // Join with spaces, clean up
      return textParts.join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50000);
    }

    return `[Word document. Text extraction incomplete — paste content manually for best results.]`;
  } catch {
    return '[DOCX text extraction failed. Paste content manually.]';
  }
}
