'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [hovered, setHovered] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }}
      if (finalTranscript) {
        onTranscript(finalTranscript);
      }};

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [onTranscript]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  }, [listening]);

  if (!supported) return null;

  const listeningStyle: React.CSSProperties = {
    backgroundColor: 'color-mix(in srgb, var(--danger) 20%, transparent)',
    color: 'var(--danger)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)',};

  const idleStyle: React.CSSProperties = {
    color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
    backgroundColor: hovered ? 'var(--surface-2)' : 'transparent',};

  return (
    <button
      onClick={toggleListening}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`p-2 rounded-lg transition-all ${listening ? 'animate-pulse' : ''} disabled:opacity-50`}
      style={listening ? listeningStyle : idleStyle}
      title={listening ? 'Stop listening' : 'Voice input'}>
      {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>);
}

// Web Speech API types are not in default TS lib — we use `any` for cross-browser compat
