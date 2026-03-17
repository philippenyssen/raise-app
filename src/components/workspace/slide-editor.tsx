'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Type, StickyNote, Copy, Play, X, Palette } from 'lucide-react';

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

function isDarkBg(bg?: string): boolean {
  if (!bg) return false;
  const hex = bg.replace('#', '');
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

function renderSlideContent(slide: Slide, scale: number = 1): React.ReactNode {
  const dark = isDarkBg(slide.background);
  return slide.elements.map(el => {
    const style = getElementStyle(el);
    // Invert colors on dark backgrounds
    if (dark) {
      if (el.type === 'title') style.color = '#f1f5f9';
      else if (el.type === 'subtitle') style.color = '#94a3b8';
      else style.color = '#cbd5e1';
    }
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

const slideTemplates: Record<string, { label: string; create: () => Slide }> = {
  title_content: { label: 'Title + Content', create: () => ({
    id: crypto.randomUUID(), layout: 'title_content',
    elements: [
      { id: crypto.randomUUID(), type: 'title', content: 'New Slide', x: 5, y: 5, width: 90 },
      { id: crypto.randomUUID(), type: 'body', content: 'Add your content here...', x: 5, y: 25, width: 90 },
    ],
  })},
  title_only: { label: 'Title Only', create: () => ({
    id: crypto.randomUUID(), layout: 'title',
    elements: [
      { id: crypto.randomUUID(), type: 'title', content: 'Section Title', x: 5, y: 35, width: 90, fontSize: '2.5em' },
      { id: crypto.randomUUID(), type: 'subtitle', content: 'Subtitle goes here', x: 5, y: 55, width: 90 },
    ],
  })},
  two_column: { label: 'Two Column', create: () => ({
    id: crypto.randomUUID(), layout: 'two_column',
    elements: [
      { id: crypto.randomUUID(), type: 'title', content: 'Comparison', x: 5, y: 5, width: 90 },
      { id: crypto.randomUUID(), type: 'body', content: 'Left column content', x: 5, y: 25, width: 42 },
      { id: crypto.randomUUID(), type: 'body', content: 'Right column content', x: 52, y: 25, width: 42 },
    ],
  })},
  big_number: { label: 'Big Number', create: () => ({
    id: crypto.randomUUID(), layout: 'blank',
    elements: [
      { id: crypto.randomUUID(), type: 'number', content: '$4.3Bn', x: 10, y: 20, width: 80, fontSize: '4em' },
      { id: crypto.randomUUID(), type: 'subtitle', content: 'Key metric description', x: 10, y: 60, width: 80 },
    ],
  })},
  bullets: { label: 'Bullet List', create: () => ({
    id: crypto.randomUUID(), layout: 'title_content',
    elements: [
      { id: crypto.randomUUID(), type: 'title', content: 'Key Points', x: 5, y: 5, width: 90 },
      { id: crypto.randomUUID(), type: 'bullet', content: '- First point\n- Second point\n- Third point\n- Fourth point', x: 5, y: 25, width: 90 },
    ],
  })},
  blank: { label: 'Blank', create: () => ({
    id: crypto.randomUUID(), layout: 'blank', elements: [],
  })},
};

function createDefaultSlide(): Slide {
  return slideTemplates.title_content.create();
}

export function SlideEditor({ slides, onChange, editable = true }: SlideEditorProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [editingElement, setEditingElement] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [presentIdx, setPresentIdx] = useState(0);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(100);
  const [draggingElement, setDraggingElement] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizingElement, setResizingElement] = useState<{ id: string; startX: number; origWidth: number } | null>(null);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const presentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const activeSlide = slides[activeIdx] || null;

  // Slide navigation keyboard shortcuts (when not presenting or editing)
  useEffect(() => {
    if (presenting) return;
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when editing text
      if (editingElement) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(prev => Math.max(0, prev - 1));
        setEditingElement(null);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(prev => Math.min(slides.length - 1, prev + 1));
        setEditingElement(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete slides with Backspace (only Delete key when element not editing)
        if (e.key === 'Delete' && editingElement) {
          // Delete selected element if any element is focused but not being text-edited
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presenting, editingElement, slides.length]);

  // Presentation mode keyboard navigation
  useEffect(() => {
    if (!presenting) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setPresentIdx(prev => Math.min(prev + 1, slides.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        e.preventDefault();
        setPresentIdx(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Escape') {
        setPresenting(false);
        window.document.exitFullscreen?.().catch(() => {});
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [presenting, slides.length]);

  const startPresentation = useCallback(() => {
    setPresentIdx(activeIdx);
    setPresenting(true);
    setTimeout(() => {
      presentRef.current?.requestFullscreen?.().catch(() => {});
    }, 50);
  }, [activeIdx]);

  useEffect(() => {
    const handler = () => { if (!window.document.fullscreenElement) setPresenting(false); };
    window.document.addEventListener('fullscreenchange', handler);
    return () => window.document.removeEventListener('fullscreenchange', handler);
  }, []);

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

  const duplicateSlide = useCallback(() => {
    if (!activeSlide) return;
    const dup: Slide = {
      ...activeSlide,
      id: crypto.randomUUID(),
      elements: activeSlide.elements.map(el => ({ ...el, id: crypto.randomUUID() })),
    };
    const updated = [...slides];
    updated.splice(activeIdx + 1, 0, dup);
    onChange(updated);
    setActiveIdx(activeIdx + 1);
  }, [slides, activeIdx, activeSlide, onChange]);

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
      const updated = [...slides];
      const [moved] = updated.splice(dragIdx, 1);
      updated.splice(dragOverIdx, 0, moved);
      onChange(updated);
      setActiveIdx(dragOverIdx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }, [dragIdx, dragOverIdx, slides, onChange]);

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

  const updateNotes = useCallback((notes: string) => {
    const updated = slides.map((slide, i) => {
      if (i !== activeIdx) return slide;
      return { ...slide, notes };
    });
    onChange(updated);
  }, [slides, activeIdx, onChange]);

  const handleElementDragStart = useCallback((e: React.MouseEvent, el: SlideElement) => {
    if (!canvasRef.current || !editable) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingElement({ id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x ?? 5, origY: el.y ?? 10 });
  }, [editable]);

  useEffect(() => {
    if (!draggingElement || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const handleMouseMove = (e: MouseEvent) => {
      const dx = ((e.clientX - draggingElement.startX) / rect.width) * 100;
      const dy = ((e.clientY - draggingElement.startY) / rect.height) * 100;
      let newX = Math.max(0, Math.min(95, draggingElement.origX + dx));
      let newY = Math.max(0, Math.min(95, draggingElement.origY + dy));

      // Snap to center guides (5% snap zone)
      const centerX = 50;
      const centerY = 50;
      if (Math.abs(newX - centerX) < 3) newX = centerX;
      if (Math.abs(newY - centerY) < 3) newY = centerY;
      // Snap to edges
      if (newX < 3) newX = 0;
      if (newY < 3) newY = 0;
      if (newX > 92) newX = 95;
      if (newY > 92) newY = 95;

      const updated = slides.map((slide, i) => {
        if (i !== activeIdx) return slide;
        return { ...slide, elements: slide.elements.map(el =>
          el.id === draggingElement.id ? { ...el, x: Math.round(newX), y: Math.round(newY) } : el
        )};
      });
      onChange(updated);
    };

    const handleMouseUp = () => {
      setDraggingElement(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingElement, slides, activeIdx, onChange]);

  // Element width resize via drag
  useEffect(() => {
    if (!resizingElement || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const handleMouseMove = (e: MouseEvent) => {
      const dx = ((e.clientX - resizingElement.startX) / rect.width) * 100;
      const newWidth = Math.max(10, Math.min(95, resizingElement.origWidth + dx));
      const updated = slides.map((slide, i) => {
        if (i !== activeIdx) return slide;
        return { ...slide, elements: slide.elements.map(el =>
          el.id === resizingElement.id ? { ...el, width: Math.round(newWidth) } : el
        )};
      });
      onChange(updated);
    };

    const handleMouseUp = () => setResizingElement(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingElement, slides, activeIdx, onChange]);

  const deleteElement = useCallback((elementId: string) => {
    const updated = slides.map((slide, i) => {
      if (i !== activeIdx) return slide;
      return { ...slide, elements: slide.elements.filter(el => el.id !== elementId) };
    });
    onChange(updated);
    setEditingElement(null);
  }, [slides, activeIdx, onChange]);

  const setSlideBackground = useCallback((bg: string) => {
    const updated = slides.map((slide, i) => {
      if (i !== activeIdx) return slide;
      return { ...slide, background: bg };
    });
    onChange(updated);
    setShowBgPicker(false);
  }, [slides, activeIdx, onChange]);

  const updateElementFontSize = useCallback((elementId: string, fontSize: string) => {
    const updated = slides.map((slide, i) => {
      if (i !== activeIdx) return slide;
      return {
        ...slide,
        elements: slide.elements.map(el =>
          el.id === elementId ? { ...el, fontSize } : el
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
          <div
            key={slide.id}
            className="flex flex-col"
            style={{
              gap: '2px',
              opacity: dragIdx === idx ? 0.4 : 1,
              borderTop: dragOverIdx === idx && dragIdx !== null && dragIdx !== idx ? '2px solid var(--accent)' : 'none',
            }}
            draggable={editable}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
          >
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '4px' }}>{idx + 1}</span>
            <div
              onClick={() => goToSlide(idx)}
              style={{
                ...(idx === activeIdx ? slidePreviewActive : slidePreviewStyle),
                background: slide.background || 'var(--surface-0)',
              }}
            >
              <div style={{ transform: 'scale(0.15)', transformOrigin: 'top left', width: '666%', height: '666%', position: 'relative', pointerEvents: 'none' }}>
                {renderSlideContent(slide, 1)}
              </div>
            </div>
          </div>
        ))}
        {editable && (
          <div className="relative">
            <button
              onClick={() => setShowTemplatePicker(!showTemplatePicker)}
              className="flex items-center justify-center w-full"
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
            {showTemplatePicker && (
              <div style={{
                position: 'absolute',
                left: '100%',
                top: 0,
                marginLeft: '4px',
                background: 'var(--surface-1)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                padding: 'var(--space-2)',
                width: '160px',
                zIndex: 50,
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', padding: '2px 8px', marginBottom: '4px' }}>Choose layout</div>
                {Object.entries(slideTemplates).map(([key, tmpl]) => (
                  <button
                    key={key}
                    onClick={() => {
                      const newSlide = tmpl.create();
                      const updated = [...slides, newSlide];
                      onChange(updated);
                      setActiveIdx(updated.length - 1);
                      setShowTemplatePicker(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '4px 8px',
                      fontSize: 'var(--font-size-xs)',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            )}
          </div>
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
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.6 }}>
                Arrow keys to navigate
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
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 'var(--font-size-xs)', ...(showNotes ? { background: 'var(--accent-muted)', color: 'var(--accent)' } : {}) }}
                title="Speaker Notes"
              >
                <StickyNote className="w-3.5 h-3.5" /> Notes
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowBgPicker(!showBgPicker)}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 'var(--font-size-xs)', ...(showBgPicker ? { background: 'var(--accent-muted)', color: 'var(--accent)' } : {}) }}
                  title="Slide Background"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
                {showBgPicker && (
                  <div
                    className="absolute z-50"
                    style={{
                      top: '100%',
                      left: 0,
                      marginTop: '4px',
                      background: 'var(--surface-1)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-lg)',
                      boxShadow: 'var(--shadow-lg)',
                      padding: 'var(--space-2)',
                      display: 'flex',
                      gap: '4px',
                      flexWrap: 'wrap',
                      width: '160px',
                    }}
                  >
                    {['#ffffff', '#f8fafc', '#f1f5f9', '#1e293b', '#0f172a', '#000000', '#1e3a5f', '#1a1a2e', '#fef3c7', '#ecfdf5'].map(color => (
                      <button
                        key={color}
                        onClick={() => setSlideBackground(color)}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: 'var(--radius-sm)',
                          background: color,
                          border: `1px solid ${color === '#ffffff' || color === '#f8fafc' ? 'var(--border-default)' : color}`,
                          cursor: 'pointer',
                          outline: activeSlide?.background === color ? '2px solid var(--accent)' : 'none',
                          outlineOffset: '1px',
                        }}
                        title={color}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />
              <button
                onClick={startPresentation}
                className="btn btn-primary btn-sm"
                title="Present"
                style={{ fontSize: 'var(--font-size-xs)' }}
              >
                <Play className="w-3 h-3" /> Present
              </button>
              <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />
              <button onClick={duplicateSlide} className="btn btn-ghost btn-sm" title="Duplicate Slide" style={{ fontSize: 'var(--font-size-xs)' }}>
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button onClick={deleteSlide} className="btn btn-ghost btn-sm" title="Delete Slide" disabled={slides.length <= 1}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Slide canvas */}
        <div className="flex-1 flex items-center justify-center overflow-auto" style={{ padding: 'var(--space-6)' }}>
          <div ref={canvasRef} style={{ ...slideCanvasStyle, background: activeSlide?.background || 'white', transform: `scale(${canvasZoom / 100})`, transformOrigin: 'center center' }}>
            {/* Alignment guides shown during drag */}
            {draggingElement && (
              <>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(59,130,246,0.3)', pointerEvents: 'none', zIndex: 5 }} />
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(59,130,246,0.3)', pointerEvents: 'none', zIndex: 5 }} />
              </>
            )}
            {activeSlide && activeSlide.elements.map(el => {
              const style = getElementStyle(el);
              const isEditing = editingElement === el.id;
              const isDragging = draggingElement?.id === el.id;

              const isHovered = hoveredElement === el.id;

              return (
                <div
                  key={el.id}
                  style={{
                    ...style,
                    cursor: isDragging ? 'grabbing' : editable ? (isEditing ? 'text' : 'grab') : 'default',
                    ...(isEditing ? { outline: '2px solid var(--accent)', outlineOffset: '2px', borderRadius: '2px' } : {}),
                    ...(isDragging ? { opacity: 0.8, zIndex: 10 } : {}),
                    ...(isHovered && !isEditing && !isDragging && editable ? { outline: '1px dashed rgba(59,130,246,0.3)', outlineOffset: '2px', borderRadius: '2px' } : {}),
                  }}
                  onMouseEnter={() => { if (editable && !draggingElement) setHoveredElement(el.id); }}
                  onMouseLeave={() => setHoveredElement(null)}
                  onMouseDown={(e) => {
                    if (editable && !isEditing) {
                      handleElementDragStart(e, el);
                    }
                  }}
                  onClick={(e) => {
                    if (editable && !isDragging) {
                      e.stopPropagation();
                      setEditingElement(el.id);
                    }
                  }}
                >
                  {isEditing ? (
                    <div style={{ position: 'relative' }}>
                      <textarea
                        autoFocus
                        value={el.content}
                        onChange={e => updateElement(el.id, e.target.value)}
                        onBlur={() => setTimeout(() => setEditingElement(null), 150)}
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
                      {/* Element controls */}
                      <div style={{
                        position: 'absolute',
                        top: '-28px',
                        left: '0',
                        display: 'flex',
                        gap: '2px',
                        background: 'var(--surface-1, #fff)',
                        border: '1px solid var(--border-default, #ddd)',
                        borderRadius: '4px',
                        padding: '2px',
                        zIndex: 5,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      }}>
                        {['0.6em', '0.8em', '1em', '1.2em', '1.5em', '2em', '3em'].map(size => (
                          <button
                            key={size}
                            onClick={(e) => { e.stopPropagation(); updateElementFontSize(el.id, size); }}
                            style={{
                              padding: '1px 4px',
                              fontSize: '10px',
                              border: 'none',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              background: el.fontSize === size ? 'var(--accent, #3b82f6)' : 'transparent',
                              color: el.fontSize === size ? 'white' : '#666',
                              fontFamily: 'monospace',
                            }}
                            title={`Font size: ${size}`}
                          >
                            {parseFloat(size) * 16}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                        style={{
                          position: 'absolute',
                          top: '-12px',
                          right: '-12px',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'var(--danger, #ef4444)',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          lineHeight: 1,
                          zIndex: 5,
                        }}
                        title="Delete element"
                      >
                        &times;
                      </button>
                      {/* Width resize handle */}
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setResizingElement({ id: el.id, startX: e.clientX, origWidth: el.width ?? 90 });
                        }}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          right: '-6px',
                          transform: 'translateY(-50%)',
                          width: '10px',
                          height: '24px',
                          borderRadius: '3px',
                          background: 'var(--accent, #3b82f6)',
                          cursor: 'ew-resize',
                          zIndex: 5,
                          opacity: 0.7,
                        }}
                        title="Drag to resize width"
                      />
                    </div>
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

        {/* Speaker notes */}
        {showNotes && activeSlide && (
          <div
            className="shrink-0"
            style={{
              borderTop: '1px solid var(--border-subtle)',
              background: 'var(--surface-0)',
              padding: 'var(--space-2) var(--space-4)',
            }}
          >
            <div className="flex items-center justify-between" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>
              <span>Speaker Notes</span>
              {activeSlide.notes && (
                <span style={{ fontSize: '10px' }}>
                  {activeSlide.notes.split(/\s+/).filter(Boolean).length} words
                </span>
              )}
            </div>
            <textarea
              value={activeSlide.notes || ''}
              onChange={e => updateNotes(e.target.value)}
              placeholder="Add speaker notes for this slide..."
              className="input resize-none"
              style={{
                width: '100%',
                minHeight: '60px',
                maxHeight: '120px',
                fontSize: 'var(--font-size-sm)',
              }}
            />
          </div>
        )}

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
          <div className="flex items-center" style={{ gap: '3px' }}>
            {slides.length <= 12 ? slides.map((_, idx) => (
              <div
                key={idx}
                onClick={() => goToSlide(idx)}
                style={{
                  width: idx === activeIdx ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: idx === activeIdx ? 'var(--accent)' : idx < activeIdx ? 'var(--text-muted)' : 'var(--border-subtle)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              />
            )) : (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {activeIdx + 1} / {slides.length}
              </span>
            )}
          </div>
          <button
            onClick={() => goToSlide(activeIdx + 1)}
            disabled={activeIdx >= slides.length - 1}
            className="btn btn-ghost btn-sm"
            style={{ opacity: activeIdx >= slides.length - 1 ? 0.3 : 1 }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 4px' }} />
          <button
            onClick={() => setCanvasZoom(z => Math.max(50, z - 10))}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '11px', padding: '2px 6px' }}
            disabled={canvasZoom <= 50}
          >
            -
          </button>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'center' }}>
            {canvasZoom}%
          </span>
          <button
            onClick={() => setCanvasZoom(z => Math.min(200, z + 10))}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '11px', padding: '2px 6px' }}
            disabled={canvasZoom >= 200}
          >
            +
          </button>
          {canvasZoom !== 100 && (
            <button
              onClick={() => setCanvasZoom(100)}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '10px', padding: '2px 4px', color: 'var(--text-muted)' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Presentation mode overlay */}
      {presenting && (
        <div
          ref={presentRef}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: '#000', cursor: 'none' }}
          onClick={(e) => {
            // Click right half = next, left half = prev
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            if (clickX > rect.width / 2) {
              setPresentIdx(prev => Math.min(prev + 1, slides.length - 1));
            } else {
              setPresentIdx(prev => Math.max(prev - 1, 0));
            }
          }}
        >
          {/* Slide content with fade transition */}
          <div
            key={presentIdx}
            style={{
              aspectRatio: '16/9',
              background: slides[presentIdx]?.background || 'white',
              width: '100vw',
              maxHeight: '100vh',
              position: 'relative',
              overflow: 'hidden',
              animation: 'slideFadeIn 0.35s ease-out',
            }}
          >
            {slides[presentIdx] && renderSlideContent(slides[presentIdx], 2.5)}
          </div>

          {/* Slide counter */}
          <div style={{
            position: 'absolute',
            bottom: '16px',
            right: '24px',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '14px',
          }}>
            {presentIdx + 1} / {slides.length}
          </div>

          {/* Exit button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPresenting(false);
              window.document.exitFullscreen?.().catch(() => {});
            }}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(0,0,0,0.5)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.5,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.5'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
