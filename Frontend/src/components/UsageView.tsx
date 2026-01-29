import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { TrendingUp, TrendingDown, Cpu, DollarSign, ArrowUpRight } from 'lucide-react';
import { getUsageRollup } from '../lib/api';
import { todayChicago, daysAgoChicago, formatDateChicago, dateRangeChicago } from '../lib/dateUtils';

const providerColors: Record<string, string> = {
  vendorA: 'hsl(var(--chart-1))',
  vendorB: 'hsl(var(--chart-2))',
};

type AgentPerf = { agent: string; tokens: number; cost: number; percentage: number; sessions: number };

export function UsageView() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [totals, setTotals] = useState<{ cost: number; tokens: number }>({ cost: 0, tokens: 0 });
  const [providerBreakdown, setProviderBreakdown] = useState<Array<{ name: string; value: number; tokens: number; color: string }>>([]);
  const [topAgents, setTopAgents] = useState<Array<AgentPerf>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<Array<{ date: string; cost: number; tokens: number }>>([]);
  const [providerTokensData, setProviderTokensData] = useState<Array<{ label: string; vendorA: number; vendorB: number }>>([]);

  const { fromStr, toStr } = useMemo(() => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    return { fromStr: daysAgoChicago(days), toStr: todayChicago() };
  }, [timeRange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getUsageRollup(fromStr, toStr);
        if (cancelled) return;
        setTotals({ cost: data.totals.cost, tokens: data.totals.tokensIn + data.totals.tokensOut });
        const providers = Object.entries(data.byProvider as any).map(([name, v]: [string, any]) => ({
          name,
          value: v.cost,
          tokens: v.tokensIn + v.tokensOut,
          color: providerColors[name] || 'hsl(var(--chart-3))',
        }));
        setProviderBreakdown(providers);
        // Build provider tokens bar data (single row)
        const vendorATokens = (data.byProvider?.vendorA?.tokensIn || 0) + (data.byProvider?.vendorA?.tokensOut || 0);
        const vendorBTokens = (data.byProvider?.vendorB?.tokensIn || 0) + (data.byProvider?.vendorB?.tokensOut || 0);
        setProviderTokensData([{ label: 'Total', vendorA: vendorATokens, vendorB: vendorBTokens }]);
        const totalCost = data.totals.cost || 1;
        setTopAgents(
          (data.topAgentsByCost as any[]).map((a: any) => ({
            agent: a.agentName,
            cost: a.cost || 0,
            tokens: a.tokens || 0,
            sessions: a.sessions || 0,
            percentage: totalCost ? ((a.cost || 0) / totalCost) * 100 : 0,
          }))
        );
        // Build daily trend series (dates in Chicago)
        const dayStrs = dateRangeChicago(fromStr, toStr);
        const perDay = await Promise.all(dayStrs.map(async (dateStr) => {
          const r = await getUsageRollup(dateStr, dateStr);
          return {
            date: formatDateChicago(dateStr),
            cost: r.totals.cost || 0,
            tokens: (r.totals.tokensIn || 0) + (r.totals.tokensOut || 0),
          };
        }));
        setTrendData(perDay);
      } catch (e: any) {
        setError(e.message || 'Failed to fetch usage');
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fromStr, toStr]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Usage & Billing</h1>
        <p className="text-muted-foreground">
          Monitor your token usage and costs across all agents. All dates and ranges use Central Time (Chicago).
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cost ({timeRange})
            </CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">${totals.cost.toFixed(6)}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <p className="text-xs text-green-500">+12.3% from last week</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tokens ({timeRange})
            </CardTitle>
            <Cpu className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{(totals.tokens / 1000).toFixed(1)}K</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <p className="text-xs text-green-500">+8.7% from last week</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Cost per 1K Tokens
            </CardTitle>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">$0.053</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendingDown className="w-3 h-3 text-red-500" />
              <p className="text-xs text-red-500">-2.1% from last week</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projected Monthly Cost
            </CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">$91.23</div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on current usage
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Cost Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Cost & Token Usage Over Time</CardTitle>
              <CardDescription>
                Daily breakdown of your spending and token consumption
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="cost" 
                      stroke="hsl(var(--chart-1))" 
                      strokeWidth={2}
                      name="Cost ($)"
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="tokens" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      name="Tokens"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Provider Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cost by Provider</CardTitle>
                <CardDescription>
                  Distribution of costs across AI providers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={providerBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(entry) => `${entry.name}: $${entry.value}`}
                      >
                        {providerBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {providerBreakdown.map((provider) => (
                    <div key={provider.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: provider.color }} />
                        <span className="text-sm">{provider.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">${provider.value.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{provider.tokens.toLocaleString()} tokens</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Agents by Cost</CardTitle>
                <CardDescription>
                  Your most expensive agents this week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topAgents.slice(0, 5).map((agent, index) => (
                    <div key={index}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{agent.agent}</span>
                        <span className="text-sm">${agent.cost.toFixed(6)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-chart-1" 
                            style={{ width: `${agent.percentage}%` }} 
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {Math.round(agent.percentage)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="providers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Token Usage by Provider</CardTitle>
              <CardDescription>
                Compare token consumption across different AI providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={providerTokensData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="label" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="vendorA" name="vendorA" fill="hsl(var(--chart-1))" />
                    <Bar dataKey="vendorB" name="vendorB" fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Provider Statistics</CardTitle>
              <CardDescription>
                Detailed breakdown of provider usage and costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Total Tokens</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Avg Cost/1K</TableHead>
                    <TableHead>Usage %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providerBreakdown.map((provider) => (
                    <TableRow key={provider.name}>
                      <TableCell className="font-medium">{provider.name}</TableCell>
                      <TableCell>{provider.tokens.toLocaleString()}</TableCell>
                      <TableCell>${provider.value.toFixed(2)}</TableCell>
                      <TableCell>${(provider.tokens ? (provider.value / (provider.tokens / 1000)) : 0).toFixed(4)}</TableCell>
                      <TableCell>
                        {/* percentage vs total tokens (fallback to tokens sum) */}
                        {(() => {
                          const totalTokens = providerBreakdown.reduce((acc, p) => acc + p.tokens, 0) || 1;
                          return ((provider.tokens / totalTokens) * 100).toFixed(1);
                        })()}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <CardDescription>
                Cost and usage breakdown by individual agent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent Name</TableHead>
                    <TableHead>Total Tokens</TableHead>
                    <TableHead>Total Cost</TableHead>
                    <TableHead>Avg Cost/Session</TableHead>
                    <TableHead>% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topAgents.map((agent) => (
                    <TableRow key={agent.agent}>
                      <TableCell className="font-medium">{agent.agent}</TableCell>
                      <TableCell>{agent.tokens.toLocaleString()}</TableCell>
                      <TableCell>${agent.cost.toFixed(2)}</TableCell>
                      <TableCell>
                        ${agent.sessions ? (agent.cost / agent.sessions).toFixed(6) : '0.000000'}
                      </TableCell>
                      <TableCell>{agent.percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {loading && <p className="text-sm text-muted-foreground">Loading usage…</p>}
      {error && <p className="text-sm text-red-600">Error: {error}</p>}
    </div>
  );
}
