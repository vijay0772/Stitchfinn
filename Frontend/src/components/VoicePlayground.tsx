import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, Mic, Square, Volume2 } from 'lucide-react';
import { Agent } from './AgentsView';
import { createSession, sendVoiceMessage } from '../lib/api';

interface VoicePlaygroundProps {
  agent: Agent;
  onClose: () => void;
}

export function VoicePlayground({ agent, onClose }: VoicePlaygroundProps) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastAssistantTranscript, setLastAssistantTranscript] = useState<string | null>(null);
  const [lastCorrelationId, setLastCorrelationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ensureSession = useCallback(async (): Promise<number> => {
    if (sessionId != null) return sessionId;
    const res = await createSession(agent.id, 'web-voice-user');
    setSessionId(res.sessionId);
    return res.sessionId;
  }, [agent.id, sessionId]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 100) {
          setError('Recording too short. Try again.');
          setIsSending(false);
          return;
        }
        try {
          const sid = await ensureSession();
          const result = await sendVoiceMessage(sid, blob);
          setLastTranscript(result.transcript);
          setLastAssistantTranscript(result.assistantTranscript);
          setLastCorrelationId(result.correlationId);
          const url = URL.createObjectURL(result.audioBlob);
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.play().catch(() => {});
          }
        } catch (e: any) {
          setError(e.message || 'Voice request failed');
        } finally {
          setIsSending(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
    } catch (e: any) {
      setError(e.message || 'Microphone access failed');
    }
  }, [ensureSession]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;
    setIsRecording(false);
    setIsSending(true);
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onClose} className="hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Voice: {agent.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Speak to the agent and hear the response (voice channel)
          </p>
        </div>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Record &amp; hear reply
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Recording is sent to the backend (STT → chat → TTS). Same session and billing as chat.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                disabled={isSending}
                className="gap-2"
              >
                <Mic className="w-4 h-4" />
                {isSending ? 'Sending…' : 'Start recording'}
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopRecording} className="gap-2">
                <Square className="w-4 h-4" />
                Stop &amp; send
              </Button>
            )}
          </div>
          <audio ref={audioRef} controls className="w-full" />
          {lastCorrelationId && (
            <p className="text-xs text-muted-foreground">
              The player above is the <strong>agent&apos;s reply</strong> (real TTS when edge-tts is installed; otherwise a short beep).
            </p>
          )}
          {(lastCorrelationId != null) && (
            <div className="text-sm space-y-1">
              <p className="font-medium text-muted-foreground">You (transcript):</p>
              <p className="rounded bg-muted px-2 py-1">{lastTranscript || '—'}</p>
            </div>
          )}
          {(lastCorrelationId != null) && (
            <div className="text-sm space-y-1">
              <p className="font-medium text-muted-foreground">Assistant (transcript):</p>
              <p className="rounded bg-muted px-2 py-1">{lastAssistantTranscript || '—'}</p>
            </div>
          )}
          {lastCorrelationId && (
            <p className="text-xs text-muted-foreground font-mono">
              Correlation ID: {lastCorrelationId}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
