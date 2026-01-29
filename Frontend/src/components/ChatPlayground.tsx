import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ArrowLeft, Send, Bot, User, Cpu, DollarSign, MessageSquare, Mic, MicOff, Volume2, Square } from 'lucide-react';
import { Agent } from './AgentsView';
import { ScrollArea } from './ui/scroll-area';
import { createSession, sendMessage } from '../lib/api';

// Web Speech API types (not in all TS libs)
const SpeechRecognitionAPI =
  typeof window !== 'undefined' &&
  ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    provider: string;
    tokens: number;
    cost: number;
  };
}

interface ChatPlaygroundProps {
  agent: Agent;
  onClose: () => void;
}

export function ChatPlayground({ agent, onClose }: ChatPlaygroundProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm ${agent.name}. How can I help you today?`,
      timestamp: new Date(),
      metadata: {
        provider: agent.primaryProvider,
        tokens: 12,
        cost: 0.0001,
      },
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch (_) {}
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  // Speech-to-text: mic button
  const toggleListening = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      return;
    }
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (_) {}
      recognitionRef.current = null;
      setIsListening(false);
      return;
    }
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new Recognition() as any;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (e: any) => {
      const last = e.results.length - 1;
      const transcript = e.results[last][0].transcript;
      if (e.results[last].isFinal) {
        setInput((prev) => ((prev ? `${prev} ` : '') + transcript).trim());
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (_) {
      setIsListening(false);
    }
  }, [isListening]);

  // Text-to-speech: play assistant message
  const speakMessage = useCallback((text: string, messageId: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => setSpeakingMessageId(null);
    u.onerror = () => setSpeakingMessageId(null);
    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(u);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      let sid = sessionId;
      if (!sid) {
        // Lazily create a session only when the user actually sends
        const res = await createSession(agent.id, 'web-user');
        sid = res.sessionId;
        setSessionId(sid);
      }
      const idem = `web-${Date.now()}`;
      const resp = await sendMessage(sid, userMessage.content, idem);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: resp.replyText,
        timestamp: new Date(),
        metadata: {
          provider: resp.providerUsed,
          tokens: resp.tokensIn + resp.tokensOut,
          cost: resp.cost,
        },
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `Error: ${e.message || e}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onClose} className="hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Try Agent: {agent.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Test your agent in a live chat environment
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col shadow-xl border-0 bg-gradient-to-br from-white to-indigo-50/20">
            <CardHeader className="border-b border-border bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-xl">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Conversation
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 flex flex-col">
              <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        } rounded-lg px-4 py-3`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm leading-relaxed flex-1">{message.content}</p>
                          {message.role === 'assistant' && typeof window !== 'undefined' && window.speechSynthesis && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 flex-shrink-0"
                              title={speakingMessageId === message.id ? 'Stop' : 'Listen'}
                              onClick={() =>
                                speakingMessageId === message.id
                                  ? stopSpeaking()
                                  : speakMessage(message.content, message.id)
                              }
                            >
                              {speakingMessageId === message.id ? (
                                <Square className="w-3.5 h-3.5 text-destructive" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </Button>
                          )}
                        </div>
                        {message.metadata && (
                          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
                            <div className="flex items-center gap-1 text-xs opacity-70">
                              <Cpu className="w-3 h-3" />
                              <span>{message.metadata.provider}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs opacity-70">
                              <span>{message.metadata.tokens} tokens</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs opacity-70">
                              <DollarSign className="w-3 h-3" />
                              <span>${message.metadata.cost.toFixed(4)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {message.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                      <div className="bg-muted rounded-lg px-4 py-3">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  {SpeechRecognitionAPI && (
                    <Button
                      type="button"
                      variant={isListening ? 'destructive' : 'outline'}
                      size="icon"
                      onClick={toggleListening}
                      disabled={isTyping}
                      title={isListening ? 'Stop listening' : 'Speak (voice input)'}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                  )}
                  <Input
                    placeholder="Type your message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isTyping}
                  />
                  <Button onClick={handleSend} disabled={isTyping || !input.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Info Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Agent Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Name</p>
                <p className="text-sm text-muted-foreground">{agent.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm text-muted-foreground">{agent.description}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Primary Provider</p>
                <Badge variant="secondary">{agent.primaryProvider}</Badge>
              </div>
              {agent.fallbackProvider && (
                <div>
                  <p className="text-sm font-medium mb-2">Fallback Provider</p>
                  <Badge variant="outline">{agent.fallbackProvider}</Badge>
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-2">Enabled Tools</p>
                <div className="flex flex-wrap gap-2">
                  {agent.enabledTools.map((tool) => (
                    <Badge key={tool} variant="secondary" className="text-xs">
                      {tool.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Prompt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {agent.systemPrompt}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}