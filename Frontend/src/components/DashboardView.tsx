import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { MessageSquare, Cpu, DollarSign, Bot } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { getUsageRollup, listSessions, listAgents } from '../lib/api';
import { todayChicago, daysAgoChicago, formatDateChicago, dateRangeChicago } from '../lib/dateUtils';

export function DashboardView() {
  const [sessionsCount, setSessionsCount] = React.useState(0);
  const [agentsCount, setAgentsCount] = React.useState(0);
  const [totalTokens, setTotalTokens] = React.useState(0);
  const [totalCost, setTotalCost] = React.useState(0);
  const [trendData, setTrendData] = React.useState<Array<{ date: string; tokens: number; cost: number }>>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [recentActivities, setRecentActivities] = React.useState<Array<{ agent: string; event: string; time: string; color: string }>>([]);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Counts
        const [sess, ags] = await Promise.all([listSessions(), listAgents()]);
        setSessionsCount(sess.length);
        setAgentsCount(ags.length);
        // Recent activity from latest sessions
        const gradients = [
          'from-blue-500 to-indigo-500',
          'from-purple-500 to-pink-500',
          'from-emerald-500 to-teal-500',
          'from-amber-500 to-orange-500',
        ];
        const timeAgo = (ts: string) => {
          const d = new Date(ts);
          const diffMs = Date.now() - d.getTime();
          const mins = Math.floor(diffMs / 60000);
          if (mins < 1) return 'just now';
          if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
          const hours = Math.floor(mins / 60);
          if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
          const days = Math.floor(hours / 24);
          return `${days} day${days === 1 ? '' : 's'} ago`;
        };
        const recent = [...sess]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 4)
          .map((s, idx) => ({
            agent: s.agentName || 'Agent',
            event: `Handled ${s.messageCount} conversation${s.messageCount === 1 ? '' : 's'}`,
            time: timeAgo(s.timestamp),
            color: gradients[idx % gradients.length],
          }));
        setRecentActivities(recent);

        // 7-day window (Central Time - Chicago)
        const toStr = todayChicago();
        const fromStr = daysAgoChicago(6);

        // Totals for header cards
        const totals = await getUsageRollup(fromStr, toStr);
        setTotalTokens((totals.totals.tokensIn || 0) + (totals.totals.tokensOut || 0));
        setTotalCost(totals.totals.cost || 0);

        // Per-day trend (Chicago dates)
        const dayStrs = dateRangeChicago(fromStr, toStr);
        const perDay = await Promise.all(
          dayStrs.map(async (dateStr) => {
            const r = await getUsageRollup(dateStr, dateStr);
            const tokens = (r.totals.tokensIn || 0) + (r.totals.tokensOut || 0);
            const cost = r.totals.cost || 0;
            return { date: formatDateChicago(dateStr), tokens, cost };
          })
        );
        setTrendData(perDay);
      } catch (e: any) {
        setError(e.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="animate-fadeIn">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Overview of your AI agents and usage statistics
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading dashboard…</p>}
      {error && <p className="text-sm text-red-600">Error: {error}</p>}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="animate-scaleIn hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden relative group" style={{ animationDelay: '100ms' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-indigo-700">
              Total Conversations
            </CardTitle>
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-indigo-900">{sessionsCount.toLocaleString()}</div>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +12.5% from last week
            </p>
          </CardContent>
        </Card>

        <Card className="animate-scaleIn hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-purple-50 to-pink-50 overflow-hidden relative group" style={{ animationDelay: '200ms' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-purple-700">
              Total Tokens
            </CardTitle>
            <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <Cpu className="w-5 h-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-purple-900">{(totalTokens / 1000).toFixed(1)}K</div>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +8.2% from last week
            </p>
          </CardContent>
        </Card>

        <Card className="animate-scaleIn hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden relative group" style={{ animationDelay: '300ms' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-emerald-700">
              Total Cost
            </CardTitle>
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-emerald-900">${totalCost.toFixed(6)}</div>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +5.3% from last week
            </p>
          </CardContent>
        </Card>

        <Card className="animate-scaleIn hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden relative group" style={{ animationDelay: '400ms' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200 rounded-full -mr-16 -mt-16 opacity-20 group-hover:scale-150 transition-transform duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-amber-700">
              Active Agents
            </CardTitle>
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-amber-900">{agentsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              2 created this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Chart */}
      <Card className="animate-scaleIn shadow-lg hover:shadow-xl transition-all duration-300" style={{ animationDelay: '500ms' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            Usage Trend
          </CardTitle>
          <CardDescription>
            Token usage and costs over the last 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <defs>
                  <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b"
                  fontSize={12}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'tokens') return [(value / 1000).toFixed(1) + 'K tokens', 'Tokens'];
                    if (name === 'cost') return ['$' + value.toFixed(2), 'Cost'];
                    return [value, name];
                  }}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="tokens" 
                  stroke="#6366f1" 
                  strokeWidth={3}
                  dot={{ fill: '#6366f1', r: 5, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7 }}
                  fill="url(#colorTokens)"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="cost" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7 }}
                  fill="url(#colorCost)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="animate-scaleIn shadow-lg hover:shadow-xl transition-all duration-300" style={{ animationDelay: '600ms' }}>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest agent interactions and events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivities.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            )}
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0 hover:bg-indigo-50/50 p-3 rounded-lg transition-all duration-200 -mx-3 animate-fadeIn" style={{ animationDelay: `${700 + index * 100}ms` }}>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${activity.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{activity.agent}</p>
                  <p className="text-sm text-muted-foreground">{activity.event}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap bg-secondary px-2 py-1 rounded-md">
                  {activity.time}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}