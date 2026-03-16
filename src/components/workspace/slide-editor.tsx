'use client';

import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Type, Image as ImageIcon } from 'lucide-react';

export interface SlideElement {
  id: string;
  type: 'title' | 'subtitle' | 'body' | 'bullet' | 'image' | 'number';
  content: string;
  x?: number;  // percentage from left
  y?: number;  // percentage from top
  width?: number; // percentage
  fontSize?: string;
}

export interface Slide {
  id: string;
  layout: 'title' | 'title_content' | 'two_column' | 'blank' | 'section';
  elements: SlideElement[];
  notes?: string;
  background?: string;
}

interface SlideEditorProps {
  slides: Slide[];
  onChange: (slides: Slide[]) => void;
  editable?: boolean;
}

const slidePreviewStyle: React.CSSProperties = {
  aspectRatio: '16/9',
  background: 'var(--surface-0)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  overflow: 'hidden',
  position: 'relative',
};

const slidePreviewActive: React.CSSProperties = {
  ...slidePreviewStyle,
  border: '2px solid var(--accent)',
  boxShadow: '0 0 0 2px var(--accent-muted)',
};

const slideCanvasStyle: React.CSSProperties = {
  aspectRatio: '16/9',
  background: 'white',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-lg)',
  position: 'relative',
  overflow: 'hidden',
  width: '100%',
  maxWidth: '900px',
};

function getElementStyle(el: SlideElement): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: `${el.x ?? 5}%`,
    top: `${el.y ?? 10}%`,
    width: `${el.width ?? 90}%`,
    outline: 'none',
    wordWrap: 'break-word',
  };

  switch (el.type) {
    case 'title':
      return { ...base, fontSize: el.fontSize || '2em', fontWeight: 400, color: '#1a1a2e' };
    case 'subtitle':
      return { ...base, fontSize: el.fontSize || '1.2em', fontWeight: 300, color: '#666' };
    case 'body':
      return { ...base, fontSize: el.fontSize || '0.9em', fontWeight: 300, color: '#333', lineHeight: 1.6 };
    case 'bullet':
      return { ...base, fontSize: el.fontSize || '0.9em', fontWeight: 300, color: '#333', lineHeight: 1.8 };
    case 'number':
      return { ...base, fontSize: el.fontSize || '3em', fontWeight: 400, color: 'var(--accent)', textAlign: 'center' };
    default:
      return base;
  }
}

function renderSlideContent(slide: Slide, scale: number = 1): React.ReactNode {
  return slide.elements.map(el => {
    const style = getElementStyle(el);
    if (scale !== 1) {
      const fontSize = style.fontSize;
      if (typeof fontSize === 'string' && fontSize.endsWith('em')) {
        style.fontSize = `${parseFloat(fontSize) * scale}em`;
      }
    }

    if (el.type === 'bullet') {
      const items = el.content.split('\n').filter(l => l.trim());
      return (
        <div key={el.id} style={style}>
          <ul style={{ margin: 0, paddingLeft: '1.5em' }}>
            {items.map((item, i) => (
              <li key={i}>{item.replace(/^[-•]\s*/, '')}</li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <div key={el.id} style={style}>
        {el.content}
      </div>
    );
  });
}

function createDefaultSlide(): Slide {
  return {
    id: crypto.randomUUID(),
    layout: 'title_content',
    elements: [
      { id: crypto.randomUUID(), type: 'title', content: 'New Slide', x: 5, y: 5, width: 90 },
      { id: crypto.randomUUID(), type: 'body', content: 'Add your content here...', x: 5, y: 25, width: 90 },
    ],
  };
}

export function SlideEditor({ slides, onChange, editable = true }: SlideEditorProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [editingElement, setEditingElement] = useState<string | null>(null);

  const activeSlide = slides[activeIdx] || null;

  const goToSlide = useCallback((idx: number) => {
    if (idx >= 0 && idx < slides.length) {
      setActiveIdx(idx);
      setEditingElement(null);
    }
  }, [slides.length]);

  const addSlide = useCallback(() => {
    const newSlide = createDefaultSlide();
    const updated = [...slides, newSlide];
    onChange(updated);
    setActiveIdx(updated.length - 1);
  }, [slides, onChange]);

  const deleteSlide = useCallback(() => {
    if (slides.length <= 1) return;
    const updated = slides.filter((_, i) => i !== activeIdx);
    onChange(updated);
    setActiveIdx(Math.min(activeIdx, updated.length - 1));
  }, [slides, activeIdx, onChange]);

  const updateElement = useCallback((elementId: string, newContent: string) => {
    const updated = slides.map((slide, i) => {
      if (i !== activeIdx) return slide;
      return {
        ...slide,
        elements: slide.elements.map(el =>
          el.id === elementId ? { ...el, content: newContent } : el
        ),
      };
    });
    onChange(updated);
  }, [slides, activeIdx, onChange]);

  const addElement = useCallback((type: SlideElement['type']) => {
    if (!activeSlide) return;
    const newEl: SlideElement = {
      id: crypto.randomUUID(),
      type,
      content: type === 'title' ? 'Title' : type === 'subtitle' ? 'Subtitle' : type === 'number' ? '42' : 'Text content',
      x: 5,
      y: 40 + activeSlide.elements.length * 15,
      width: 90,
    };
    const updated = slides.map((slide, i) => {
      if (i !== activeIdx) return slide;
      return { ...slide, elements: [...slide.elements, newEl] };
    });
    onChange(updated);
  }, [slides, activeIdx, activeSlide, onChange]);

  if (slides.length === 0) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--surface-0)' }}>
        <div className="text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>No slides yet</p>
          {editable && (
            <button onClick={addSlide} className="btn btn-primary btn-sm">
              <Plus className="w-4 h-4" /> Add First Slide
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex" style={{ background: 'var(--surface-1)' }}>
      {/* Slide thumbnails */}
      <div
        className="shrink-0 overflow-y-auto flex flex-col"
        style={{
          width: '160px',
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--surface-0)',
          padding: 'var(--space-2)',
          gap: 'var(--space-2)',
        }}
      >
        {slides.map((slide, idx) => (
          <div key={slide.id} className="flex flex-col" style={{ gap: '2px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '4px' }}>{idx + 1}</span>
            <div
              onClick={() => goToSlide(idx)}
              style={idx === activeIdx ? slidePreviewActive : slidePreviewStyle}
            >
              <div style={{ transform: 'scale(0.15)', transformOrigin: 'top left', width: '666%', height: '666%', position: 'relative', pointerEvents: 'none' }}>
                {renderSlideContent(slide, 1)}
              </div>
            </div>
          </div>
        ))}
        {editable && (
          <button
            onClick={addSlide}
            className="flex items-center justify-center"
            style={{
              aspectRatio: '16/9',
              border: '1px dashed var(--border-default)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 'var(--font-size-xs)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main slide area */}
      <div className="flex-1 flex flex-col">
        {/* Slide toolbar */}
        {editable && (
          <div
            className="shrink-0 flex items-center justify-between"
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--surface-0)',
            }}
          >
            <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Slide {activeIdx + 1} of {slides.length}
              </span>
            </div>
            <div className="flex items-center" style={{ gap: 'var(--space-1)' }}>
              <button
                onClick={() => addElement('title')}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 'var(--font-size-xs)' }}
                title="Add Title"
              >
                <Type className="w-3.5 h-3.5" /> Title
              </button>
              <button
                onClick={() => addElement('body')}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 'var(--font-size-xs)' }}
                title="Add Text"
              >
                <Type className="w-3 h-3" /> Text
              </button>
              <button
                onClick={() => addElement('bullet')}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 'var(--font-size-xs)' }}
                title="Add Bullets"
              >
                Bullets
              </button>
              <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />
              <button onClick={deleteSlide} className="btn btn-ghost btn-sm" title="Delete Slide" disabled={slides.length <= 1}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Slide canvas */}
        <div className="flex-1 flex items-center justify-center overflow-auto" style={{ padding: 'var(--space-6)' }}>
          <div style={slideCanvasStyle}>
            {activeSlide && activeSlide.elements.map(el => {
              const style = getElementStyle(el);
              const isEditing = editingElement === el.id;

              return (
                <div
                  key={el.id}
                  style={{
                    ...style,
                    cursor: editable ? 'text' : 'default',
                    ...(isEditing ? { outline: '2px solid var(--accent)', outlineOffset: '2px', borderRadius: '2px' } : {}),
                  }}
                  onClick={(e) => {
                    if (editable) {
                      e.stopPropagation();
                      setEditingElement(el.id);
                    }
                  }}
                >
                  {isEditing ? (
                    <textarea
                      autoFocus
                      value={el.content}
                      onChange={e => updateElement(el.id, e.target.value)}
                      onBlur={() => setEditingElement(null)}
                      onKeyDown={e => { if (e.key === 'Escape') setEditingElement(null); }}
                      style={{
                        width: '100%',
                        minHeight: el.type === 'bullet' || el.type === 'body' ? '80px' : '40px',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'vertical',
                        font: 'inherit',
                        color: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 'inherit',
                        lineHeight: 'inherit',
                      }}
                    />
                  ) : el.type === 'bullet' ? (
                    <ul style={{ margin: 0, paddingLeft: '1.5em' }}>
                      {el.content.split('\n').filter(l => l.trim()).map((item, i) => (
                        <li key={i}>{item.replace(/^[-•]\s*/, '')}</li>
                      ))}
                    </ul>
                  ) : (
                    el.content
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{
            padding: 'var(--space-2)',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface-0)',
            gap: 'var(--space-3)',
          }}
        >
          <button
            onClick={() => goToSlide(activeIdx - 1)}
            disabled={activeIdx === 0}
            className="btn btn-ghost btn-sm"
            style={{ opacity: activeIdx === 0 ? 0.3 : 1 }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {activeIdx + 1} / {slides.length}
          </span>
          <button
            onClick={() => goToSlide(activeIdx + 1)}
            disabled={activeIdx >= slides.length - 1}
            className="btn btn-ghost btn-sm"
            style={{ opacity: activeIdx >= slides.length - 1 ? 0.3 : 1 }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
