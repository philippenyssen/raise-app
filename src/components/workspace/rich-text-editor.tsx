'use client';

import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { useEffect, useCallback, useRef } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Quote, Minus, Undo2, Redo2,
  Heading1, Heading2, Heading3, Table as TableIcon,
  Code, Highlighter,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

// Convert markdown to basic HTML for initial loading
function markdownToHtml(md: string): string {
  if (md.startsWith('<') || md.includes('</p>') || md.includes('</h')) {
    return md; // Already HTML
  }

  const lines = md.split('\n');
  const htmlLines: string[] = [];
  let inList = false;
  let inOrderedList = false;
  let inTable = false;
  const tableRows: string[][] = [];

  const inlineFormat = (text: string): string => {
    return text
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table handling
    if (line.startsWith('|')) {
      const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
      if (cells.every(c => /^[\s-:]+$/.test(c))) continue; // separator row
      if (!inTable) {
        inTable = true;
        tableRows.length = 0;
      }
      tableRows.push(cells);
      // Check if next line is NOT a table row
      if (i + 1 >= lines.length || !lines[i + 1].startsWith('|')) {
        // Flush table
        let tableHtml = '<table><tbody>';
        tableRows.forEach((row, ri) => {
          tableHtml += '<tr>';
          row.forEach(cell => {
            const tag = ri === 0 ? 'th' : 'td';
            tableHtml += `<${tag}>${inlineFormat(cell)}</${tag}>`;
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        htmlLines.push(tableHtml);
        inTable = false;
      }
      continue;
    }

    if (inList && !line.startsWith('- ') && !line.startsWith('  - ')) {
      htmlLines.push('</ul>');
      inList = false;
    }
    if (inOrderedList && !/^\d+\. /.test(line)) {
      htmlLines.push('</ol>');
      inOrderedList = false;
    }

    if (line.startsWith('#### ')) {
      htmlLines.push(`<h4>${inlineFormat(line.slice(5))}</h4>`);
    } else if (line.startsWith('### ')) {
      htmlLines.push(`<h3>${inlineFormat(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      htmlLines.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      htmlLines.push(`<h1>${inlineFormat(line.slice(2))}</h1>`);
    } else if (line.startsWith('- ')) {
      if (!inList) { htmlLines.push('<ul>'); inList = true; }
      htmlLines.push(`<li>${inlineFormat(line.slice(2))}</li>`);
    } else if (/^\d+\. /.test(line)) {
      if (!inOrderedList) { htmlLines.push('<ol>'); inOrderedList = true; }
      htmlLines.push(`<li>${inlineFormat(line.replace(/^\d+\. /, ''))}</li>`);
    } else if (line.startsWith('> ')) {
      htmlLines.push(`<blockquote><p>${inlineFormat(line.slice(2))}</p></blockquote>`);
    } else if (line.match(/^---+$/)) {
      htmlLines.push('<hr>');
    } else if (line.trim() === '') {
      htmlLines.push('<p></p>');
    } else {
      htmlLines.push(`<p>${inlineFormat(line)}</p>`);
    }
  }

  if (inList) htmlLines.push('</ul>');
  if (inOrderedList) htmlLines.push('</ol>');

  return htmlLines.join('\n');
}

const toolbarBtnStyle: React.CSSProperties = {
  padding: '4px',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
};

const toolbarBtnActive: React.CSSProperties = {
  ...toolbarBtnStyle,
  background: 'var(--accent-muted)',
  color: 'var(--accent)',
};

const dividerStyle: React.CSSProperties = {
  width: '1px',
  height: '20px',
  background: 'var(--border-subtle)',
  margin: '0 2px',
  flexShrink: 0,
};

function ToolbarButton({ icon: Icon, isActive, onClick, title }: {
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={isActive ? toolbarBtnActive : toolbarBtnStyle}
      onMouseEnter={e => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
        }
      }}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

export function RichTextEditor({ content, onChange, editable = true }: RichTextEditorProps) {
  const isUpdatingRef = useRef(false);
  const initialHtml = useRef(markdownToHtml(content));

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Highlight,
      TextStyle,
      Color,
    ],
    content: initialHtml.current,
    editable,
    onUpdate: ({ editor }) => {
      if (!isUpdatingRef.current) {
        onChange(editor.getHTML());
      }
    },
    editorProps: {
      attributes: {
        class: 'rich-text-content',
        style: 'outline: none; min-height: 100%; padding: var(--space-6) var(--space-8); max-width: 56rem;',
      },
    },
  });

  // Update content from outside (e.g., AI changes)
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const currentHtml = editor.getHTML();
      const newHtml = markdownToHtml(content);
      if (currentHtml !== newHtml && content !== currentHtml) {
        isUpdatingRef.current = true;
        editor.commands.setContent(newHtml);
        isUpdatingRef.current = false;
      }
    }
  }, [content, editor]);

  const insertTable = useCallback(() => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
  }, [editor]);

  if (!editor) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        Loading editor...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--surface-0)' }}>
      {/* Toolbar */}
      {editable && (
        <div
          className="shrink-0 flex items-center flex-wrap"
          style={{
            padding: '4px var(--space-2)',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--surface-0)',
            gap: '1px',
          }}
        >
          <ToolbarButton icon={Undo2} onClick={() => editor.chain().focus().undo().run()} title="Undo" />
          <ToolbarButton icon={Redo2} onClick={() => editor.chain().focus().redo().run()} title="Redo" />
          <div style={dividerStyle} />
          <ToolbarButton
            icon={Heading1}
            isActive={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          />
          <ToolbarButton
            icon={Heading2}
            isActive={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          />
          <ToolbarButton
            icon={Heading3}
            isActive={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          />
          <div style={dividerStyle} />
          <ToolbarButton
            icon={Bold}
            isActive={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          />
          <ToolbarButton
            icon={Italic}
            isActive={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          />
          <ToolbarButton
            icon={UnderlineIcon}
            isActive={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          />
          <ToolbarButton
            icon={Strikethrough}
            isActive={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          />
          <ToolbarButton
            icon={Highlighter}
            isActive={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            title="Highlight"
          />
          <ToolbarButton
            icon={Code}
            isActive={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline Code"
          />
          <div style={dividerStyle} />
          <ToolbarButton
            icon={AlignLeft}
            isActive={editor.isActive({ textAlign: 'left' })}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Align Left"
          />
          <ToolbarButton
            icon={AlignCenter}
            isActive={editor.isActive({ textAlign: 'center' })}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Align Center"
          />
          <ToolbarButton
            icon={AlignRight}
            isActive={editor.isActive({ textAlign: 'right' })}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Align Right"
          />
          <div style={dividerStyle} />
          <ToolbarButton
            icon={List}
            isActive={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          />
          <ToolbarButton
            icon={ListOrdered}
            isActive={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
          />
          <ToolbarButton
            icon={Quote}
            isActive={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          />
          <ToolbarButton icon={Minus} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule" />
          <div style={dividerStyle} />
          <ToolbarButton icon={TableIcon} onClick={insertTable} title="Insert Table" />
        </div>
      )}

      {/* Bubble menu for inline formatting */}
      {editor && editable && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div
            className="flex items-center"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '2px',
              gap: '1px',
            }}
          >
            <ToolbarButton
              icon={Bold}
              isActive={editor.isActive('bold')}
              onClick={() => editor.chain().focus().toggleBold().run()}
              title="Bold"
            />
            <ToolbarButton
              icon={Italic}
              isActive={editor.isActive('italic')}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              title="Italic"
            />
            <ToolbarButton
              icon={UnderlineIcon}
              isActive={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Underline"
            />
            <ToolbarButton
              icon={Highlighter}
              isActive={editor.isActive('highlight')}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              title="Highlight"
            />
          </div>
        </BubbleMenu>
      )}

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
}
