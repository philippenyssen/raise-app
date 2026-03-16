import { NextRequest, NextResponse } from 'next/server';
import { getDocument } from '@/lib/db';

// Dynamic import for Office generation libraries (they're large)
async function generateDocx(title: string, htmlContent: string): Promise<Buffer> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table: DocxTable, TableRow: DocxTableRow, TableCell: DocxTableCell, WidthType, BorderStyle } = await import('docx');

  // Parse HTML to document elements
  const elements: (typeof Paragraph extends new (...args: infer U) => infer R ? R : never)[] = [];
  const parser = new (await import('node:stream/web')).WritableStream ? null : null;

  // Simple HTML-to-docx conversion
  const lines = htmlContent
    .replace(/<\/p>/g, '\n')
    .replace(/<\/h[1-4]>/g, '\n')
    .replace(/<\/li>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/tr>/g, '\n')
    .replace(/<\/table>/g, '\n')
    .split('\n');

  for (const line of lines) {
    const cleaned = line.replace(/<[^>]+>/g, '').trim();
    if (!cleaned) continue;

    if (line.includes('<h1')) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: cleaned, size: 36, font: 'DM Sans' })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      }));
    } else if (line.includes('<h2')) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: cleaned, size: 28, font: 'DM Sans' })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 150 },
      }));
    } else if (line.includes('<h3')) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: cleaned, size: 24, font: 'DM Sans' })],
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      }));
    } else if (line.includes('<li')) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: cleaned, size: 22, font: 'DM Sans' })],
        bullet: { level: 0 },
        spacing: { after: 60 },
      }));
    } else if (line.includes('<blockquote')) {
      elements.push(new Paragraph({
        children: [new TextRun({ text: cleaned, size: 22, italics: true, font: 'DM Sans', color: '888888' })],
        indent: { left: 720 },
        spacing: { before: 100, after: 100 },
      }));
    } else {
      // Parse inline formatting
      const runs: (typeof TextRun extends new (...args: infer U) => infer R ? R : never)[] = [];
      let remaining = line.replace(/<(?!strong|em|\/strong|\/em|u|\/u|code|\/code)[^>]+>/g, '');

      // Split by formatting tags
      const parts = remaining.split(/(<\/?(?:strong|em|u|code)>)/);
      let isBold = false, isItalic = false, isUnderline = false, isCode = false;

      for (const part of parts) {
        if (part === '<strong>') { isBold = true; continue; }
        if (part === '</strong>') { isBold = false; continue; }
        if (part === '<em>') { isItalic = true; continue; }
        if (part === '</em>') { isItalic = false; continue; }
        if (part === '<u>') { isUnderline = true; continue; }
        if (part === '</u>') { isUnderline = false; continue; }
        if (part === '<code>') { isCode = true; continue; }
        if (part === '</code>') { isCode = false; continue; }
        if (part.trim()) {
          runs.push(new TextRun({
            text: part.replace(/<[^>]+>/g, ''),
            bold: isBold,
            italics: isItalic,
            underline: isUnderline ? {} : undefined,
            font: isCode ? 'Courier New' : 'DM Sans',
            size: 22,
          }));
        }
      }

      if (runs.length > 0) {
        elements.push(new Paragraph({
          children: runs,
          spacing: { after: 120 },
        }));
      }
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: elements.length > 0 ? elements : [
        new Paragraph({ children: [new TextRun({ text: title, size: 36, font: 'DM Sans' })] }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

async function generateXlsx(title: string, jsonContent: string): Promise<Buffer> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  try {
    const data = JSON.parse(jsonContent);

    if (data.sheets) {
      // Multi-sheet format
      for (const sheetData of data.sheets) {
        const ws = workbook.addWorksheet(sheetData.name || 'Sheet');
        populateWorksheet(ws, sheetData.cells || {});
      }
    } else if (data.cells) {
      // Single sheet format
      const ws = workbook.addWorksheet(title);
      populateWorksheet(ws, data.cells);
    } else {
      // Raw cells object
      const ws = workbook.addWorksheet(title);
      populateWorksheet(ws, data);
    }
  } catch {
    // If not valid JSON, create a simple sheet with the content
    const ws = workbook.addWorksheet(title);
    ws.getCell('A1').value = title;
    ws.getCell('A2').value = jsonContent.substring(0, 32767);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function populateWorksheet(ws: import('exceljs').Worksheet, cells: Record<string, { v: string | number; f?: string; fmt?: string; bold?: boolean; bg?: string }>) {
  for (const [ref, cell] of Object.entries(cells)) {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) continue;

    const excelCell = ws.getCell(ref);

    if (cell.f) {
      try {
        excelCell.value = { formula: cell.f.replace(/^=/, ''), result: cell.v };
      } catch {
        excelCell.value = cell.v;
      }
    } else {
      excelCell.value = cell.v;
    }

    if (cell.bold) {
      excelCell.font = { bold: true };
    }

    if (cell.fmt === '%') {
      excelCell.numFmt = '0.0%';
    } else if (cell.fmt === '$') {
      excelCell.numFmt = '$#,##0';
    } else if (cell.fmt === '€') {
      excelCell.numFmt = '€#,##0';
    } else if (cell.fmt === '#,##0') {
      excelCell.numFmt = '#,##0';
    }
  }

  // Auto-fit column widths (approximate)
  ws.columns.forEach(col => {
    if (col.values) {
      let maxLen = 10;
      col.values.forEach(val => {
        if (val) {
          const len = String(val).length;
          if (len > maxLen) maxLen = Math.min(len, 40);
        }
      });
      col.width = maxLen + 2;
    }
  });
}

async function generatePptx(title: string, jsonContent: string): Promise<Buffer> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  try {
    const data = JSON.parse(jsonContent);
    const slides = Array.isArray(data) ? data : data.slides || [data];

    for (const slideData of slides) {
      const slide = pptx.addSlide();
      const elements = slideData.elements || [];

      for (const el of elements) {
        const xPct = (el.x ?? 5) / 100;
        const yPct = (el.y ?? 10) / 100;
        const wPct = (el.width ?? 90) / 100;

        const x = xPct * 10; // inches (10" wide)
        const y = yPct * 5.625; // inches (5.625" tall)
        const w = wPct * 10;

        if (el.type === 'title') {
          slide.addText(el.content, {
            x, y, w, h: 0.8,
            fontSize: 32, fontFace: 'DM Sans',
            color: '1A1A2E',
          });
        } else if (el.type === 'subtitle') {
          slide.addText(el.content, {
            x, y, w, h: 0.5,
            fontSize: 18, fontFace: 'DM Sans',
            color: '666666',
          });
        } else if (el.type === 'bullet') {
          const items = el.content.split('\n').filter((l: string) => l.trim());
          slide.addText(
            items.map((item: string) => ({
              text: item.replace(/^[-•]\s*/, ''),
              options: { bullet: true, fontSize: 14, fontFace: 'DM Sans', color: '333333' },
            })),
            { x, y, w, h: 3 }
          );
        } else if (el.type === 'number') {
          slide.addText(el.content, {
            x, y, w, h: 1.2,
            fontSize: 48, fontFace: 'DM Sans',
            color: '1B2A4A',
            align: 'center',
          });
        } else {
          slide.addText(el.content, {
            x, y, w, h: 2,
            fontSize: 14, fontFace: 'DM Sans',
            color: '333333',
          });
        }
      }
    }
  } catch {
    // Fallback: create a title slide
    const slide = pptx.addSlide();
    slide.addText(title, { x: 0.5, y: 1, w: 9, h: 1.5, fontSize: 36, fontFace: 'DM Sans', color: '1A1A2E' });
    slide.addText(jsonContent.substring(0, 500), { x: 0.5, y: 3, w: 9, h: 3, fontSize: 14, fontFace: 'DM Sans', color: '666666' });
  }

  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(buffer as ArrayBuffer);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const format = req.nextUrl.searchParams.get('format') || 'docx';

    const doc = await getDocument(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const safeTitle = doc.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    let buffer: Buffer;
    let contentType: string;
    let extension: string;

    switch (format) {
      case 'xlsx': {
        buffer = await generateXlsx(doc.title, doc.content);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        extension = 'xlsx';
        break;
      }
      case 'pptx': {
        buffer = await generatePptx(doc.title, doc.content);
        contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        extension = 'pptx';
        break;
      }
      case 'docx':
      default: {
        buffer = await generateDocx(doc.title, doc.content);
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        extension = 'docx';
        break;
      }
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeTitle}.${extension}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (err) {
    console.error('[EXPORT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
