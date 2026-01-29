import React, { useState } from 'react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { 
  LayoutDashboard, 
  Bot, 
  MessageSquare, 
  TrendingUp, 
  Settings, 
  Key,
  LogOut
} from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import { AgentsView } from './components/AgentsView';
import { SessionsView } from './components/SessionsView';
import { UsageView } from './components/UsageView';
import { SettingsView } from './components/SettingsView';
import { setApiKey as apiSetApiKey, setApiBaseUrl, getApiBaseUrl, validateApiKeyOnce, getTenantMe } from './lib/api';

type NavigationItem = 'dashboard' | 'agents' | 'sessions' | 'usage' | 'settings';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [activeView, setActiveView] = useState<NavigationItem>('dashboard');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  // rehydrate state from localStorage
  React.useEffect(() => {
    const savedKey = localStorage.getItem('apiKey') || '';
    const savedTenantName = localStorage.getItem('tenantName') || '';
    const savedView = (localStorage.getItem('activeView') as NavigationItem) || 'dashboard';
    const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL;
    if (envBase) {
      setApiBaseUrl(envBase);
    }
    if (savedKey) {
      apiSetApiKey(savedKey);
      setApiKey(savedKey);
      setTenantName(savedTenantName || 'Loading…');
      setIsAuthenticated(true);
      // Refresh tenant name from backend
      (async () => {
        try {
          const t = await getTenantMe();
          setTenantName(t.name);
          localStorage.setItem('tenantName', t.name);
        } catch {
          // if invalid/expired key, force logout to login screen
          localStorage.removeItem('apiKey');
          localStorage.removeItem('tenantName');
          apiSetApiKey('');
          setIsAuthenticated(false);
          setTenantName('');
        }
      })();
    }
    setActiveView(savedView);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    setLoginError(null);
    setLoginLoading(true);
    try {
      // Validate with backend using a lightweight call
      await validateApiKeyOnce(trimmed);
      // If we reach here, key is valid
      setIsAuthenticated(true);
      apiSetApiKey(trimmed);
      const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL;
      if (envBase) {
        setApiBaseUrl(envBase);
      }
      localStorage.setItem('apiKey', trimmed);
      const t = await getTenantMe();
      setTenantName(t.name);
      localStorage.setItem('tenantName', t.name);
    } catch (err: any) {
      setIsAuthenticated(false);
      apiSetApiKey(''); // clear any previous key
      const msg = err.message || 'Invalid API key';
      const isNetworkError = msg === 'Failed to fetch' || msg.includes('Load failed');
      const baseUrl = getApiBaseUrl();
      const hint = isNetworkError
        ? ` Cannot reach API at ${baseUrl}. If deployed, set VITE_API_BASE_URL in Vercel and redeploy.`
        : '';
      setLoginError(msg + hint);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setApiKey('');
    setTenantName('');
    setActiveView('dashboard');
    localStorage.removeItem('apiKey');
    localStorage.removeItem('tenantName');
    localStorage.setItem('activeView', 'dashboard');
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-glow"></div>
          <div className="absolute bottom-20 right-20 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-glow" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-glow" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="w-full max-w-md relative z-10 animate-scaleIn">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/50 animate-fadeIn">
              <Key className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              AI Agent Gateway
            </h1>
            <p className="text-muted-foreground text-lg">
              Authenticate using your tenant API key
            </p>
          </div>

          <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/80">
            <CardHeader>
              <CardTitle>Sign In</CardTitle>
              <CardDescription>
                Enter your API key to access the dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk_live_••••••••••••••••"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    className="transition-all duration-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Your API key is used to authenticate requests
                  </p>
                  {loginError && (
                    <p className="text-xs text-red-600 mt-1">
                      {loginError}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
                >
                  {loginLoading ? 'Validating…' : 'Continue'}
                </Button>
              </form>
            </CardContent>
          </Card>

       
        </div>
      </div>
    );
  }

  // Main Dashboard
  const navigationItems = [
    { id: 'dashboard' as NavigationItem, icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'agents' as NavigationItem, icon: Bot, label: 'Agents' },
    { id: 'sessions' as NavigationItem, icon: MessageSquare, label: 'Sessions' },
    { id: 'usage' as NavigationItem, icon: TrendingUp, label: 'Usage & Billing' },
    { id: 'settings' as NavigationItem, icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 border-r border-border bg-card shadow-xl animate-slideInLeft">
        <div className="flex flex-col h-full">
          {/* Logo & Tenant */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">AI Gateway</h2>
              </div>
            </div>
            <div className="mt-3 px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100">
              <p className="text-xs text-muted-foreground">Organization</p>
              <p className="text-sm font-medium text-indigo-900">{tenantName}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {navigationItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <li key={item.id} style={{ animationDelay: `${index * 50}ms` }} className="animate-fadeIn">
                    <button
                      onClick={() => {
                        setActiveView(item.id);
                        localStorage.setItem('activeView', item.id);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        activeView === item.id
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 transform scale-105'
                          : 'text-muted-foreground hover:bg-indigo-50 hover:text-indigo-900 hover:transform hover:scale-105'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-border">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-all duration-200 hover:transform hover:scale-105"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64">
        <div className="p-8 animate-fadeIn">
          {activeView === 'dashboard' && <DashboardView />}
          {activeView === 'agents' && <AgentsView />}
          {activeView === 'sessions' && <SessionsView />}
          {activeView === 'usage' && <UsageView />}
          {activeView === 'settings' && <SettingsView tenantName={tenantName} apiKey={apiKey} />}
        </div>
      </main>
    </div>
  );
}