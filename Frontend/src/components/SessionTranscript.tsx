import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowLeft, Bot, User, Clock, MessageSquare, Cpu, DollarSign } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { BackendSessionRow, getSessionTranscript, TranscriptMessage } from '../lib/api';

interface SessionTranscriptProps {
  session: BackendSessionRow;
  onClose: () => void;
}

export function SessionTranscript({ session, onClose }: SessionTranscriptProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getSessionTranscript(session.id);
        if (!cancelled) {
          setMessages(data.messages);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Failed to load transcript');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={onClose}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-semibold">Session Transcript</h1>
          <p className="text-muted-foreground mt-1">
            {session.id} • {session.timestamp}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transcript */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg">Conversation</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-full p-6">
                {loading && (
                  <p className="text-sm text-muted-foreground">Loading transcript…</p>
                )}
                {error && (
                  <p className="text-sm text-red-600 mb-2">Error: {error}</p>
                )}
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
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs opacity-70">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        {message.role === 'assistant' && message.tokens != null && message.cost != null && (
                          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50">
                            <div className="flex items-center gap-1 text-xs opacity-70">
                              <Cpu className="w-3 h-3" />
                              <span>{message.provider}</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs opacity-70">
                              <span>{message.tokens} tokens</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs opacity-70">
                              <DollarSign className="w-3 h-3" />
                              <span>${message.cost.toFixed(4)}</span>
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
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Session Metadata */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Session Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Session ID</p>
                <p className="text-sm font-mono">{session.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Agent</p>
                <p className="text-sm font-medium">{session.agentName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Customer ID</p>
                <p className="text-sm font-mono">{session.customerId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge
                  variant={
                    session.status === 'completed'
                      ? 'secondary'
                      : session.status === 'error'
                      ? 'destructive'
                      : 'default'
                  }
                >
                  {session.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Timestamp</p>
                <p className="text-sm">{session.timestamp}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Messages</span>
                </div>
                <span className="text-sm font-medium">{session.messageCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Duration</span>
                </div>
                <span className="text-sm font-medium">N/A</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Tokens</span>
                </div>
                <span className="text-sm font-medium">{session.totalTokens.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Cost</span>
                </div>
                <span className="text-sm font-medium">${session.totalCost.toFixed(4)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Provider Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">VendorA</span>
                  <span className="text-sm text-muted-foreground">60%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-chart-1" style={{ width: '60%' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">VendorB</span>
                  <span className="text-sm text-muted-foreground">40%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-chart-2" style={{ width: '40%' }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
