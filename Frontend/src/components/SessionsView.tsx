import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MessageSquare, User, Clock, Search, ChevronRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { SessionTranscript } from './SessionTranscript';
import { BackendSessionRow, listSessions } from '../lib/api';

type Session = BackendSessionRow;

const mockSessions: Session[] = [];

export function SessionsView() {
  const [sessions, setSessions] = useState<Session[]>(mockSessions);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listSessions();
        setSessions(data);
      } catch (e: any) {
        setError(e.message || 'Failed to load sessions');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredSessions = sessions.filter((session) => {
    const q = searchQuery.toLowerCase();
    return (
      String(session.id).toLowerCase().includes(q) ||
      (session.agentName || '').toLowerCase().includes(q) ||
      (session.customerId || '').toLowerCase().includes(q)
    );
  });

  if (selectedSession) {
    return (
      <SessionTranscript 
        session={selectedSession} 
        onClose={() => setSelectedSession(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Sessions</h1>
        <p className="text-muted-foreground">
          View and analyze past conversations
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-2xl font-semibold mt-1">{sessions.length.toLocaleString()}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg. Duration</p>
                <p className="text-2xl font-semibold mt-1">6m 24s</p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unique Users</p>
                <p className="text-2xl font-semibold mt-1">1,234</p>
              </div>
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-semibold mt-1">98.2%</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>
                Click on a session to view the full conversation transcript
              </CardDescription>
            </div>
            <div className="w-80">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search sessions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading sessions…</p>}
          {error && <p className="text-sm text-red-600">Error: {error}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session ID</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.map((session) => (
                <TableRow key={session.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">{session.id}</TableCell>
                  <TableCell>{session.agentName}</TableCell>
                  <TableCell className="font-mono text-sm">{session.customerId}</TableCell>
                  <TableCell>{session.messageCount}</TableCell>
                  <TableCell>{session.timestamp}</TableCell>
                  <TableCell>{session.totalTokens.toLocaleString()}</TableCell>
                  <TableCell>${session.totalCost.toFixed(4)}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSession(session)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
