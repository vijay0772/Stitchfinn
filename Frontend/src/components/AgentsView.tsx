import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Plus, Bot, Play, Settings, Trash2, Mic } from 'lucide-react';
import { AgentModal } from './AgentModal';
import { BackendAgent, createAgent as apiCreateAgent, listAgents } from '../lib/api';
import { ChatPlayground } from './ChatPlayground';
import { VoicePlayground } from './VoicePlayground';

export interface Agent {
  id: number;
  name: string;
  description: string;
  systemPrompt: string;
  primaryProvider: 'VendorA' | 'VendorB';
  fallbackProvider?: 'VendorA' | 'VendorB';
  enabledTools: string[];
  status: 'active' | 'inactive';
  conversations: number;
  lastUsed: string;
}

export function AgentsView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [playgroundAgent, setPlaygroundAgent] = useState<Agent | null>(null);
  const [voiceAgent, setVoiceAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapBackendAgent = (a: BackendAgent): Agent => ({
    id: a.id,
    name: a.name,
    description: '', // backend has no description field
    systemPrompt: a.system_prompt,
    primaryProvider: a.primary_provider === 'vendorA' ? 'VendorA' : 'VendorB',
    fallbackProvider: a.fallback_provider ? (a.fallback_provider === 'vendorA' ? 'VendorA' : 'VendorB') : undefined,
    enabledTools: a.enabled_tools || [],
    status: 'active',
    conversations: 0,
    lastUsed: '—',
  });

  const refreshAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAgents();
      setAgents(data.map(mapBackendAgent));
    } catch (e: any) {
      setError(e.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAgents();
  }, []);

  const handleCreateAgent = (agentData: Omit<Agent, 'id' | 'conversations' | 'lastUsed' | 'status'>) => {
    (async () => {
      try {
        await apiCreateAgent({
          name: agentData.name,
          primaryProvider: agentData.primaryProvider,
          fallbackProvider: agentData.fallbackProvider,
          systemPrompt: agentData.systemPrompt,
          enabledTools: agentData.enabledTools,
        });
        await refreshAgents();
        setIsModalOpen(false);
      } catch (e: any) {
        alert(e.message || 'Failed to create agent');
      }
    })();
  };

  const handleEditAgent = (agentData: Omit<Agent, 'id' | 'conversations' | 'lastUsed' | 'status'>) => {
    if (editingAgent) {
      // Optional: implement update endpoint; for now refetch list
      setAgents(agents.map(a => (a.id === editingAgent.id ? { ...a, ...agentData } : a)));
      setEditingAgent(null);
      setIsModalOpen(false);
    }
  };

  const handleDeleteAgent = (id: string) => {
    setAgents(agents.filter(a => a.id !== id));
  };

  const openEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingAgent(null);
    setIsModalOpen(true);
  };

  if (voiceAgent) {
    return (
      <VoicePlayground
        agent={voiceAgent}
        onClose={() => setVoiceAgent(null)}
      />
    );
  }

  if (playgroundAgent) {
    return (
      <ChatPlayground 
        agent={playgroundAgent} 
        onClose={() => setPlaygroundAgent(null)} 
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fadeIn">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Agents
          </h1>
          <p className="text-muted-foreground">
            Manage your AI agents and their configurations
          </p>
        </div>
        <Button onClick={openCreateModal} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200">
          <Plus className="w-4 h-4 mr-2" />
          Create Agent
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading agents…</p>}
      {error && <p className="text-sm text-red-600">Error: {error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {agents.map((agent, index) => (
          <Card key={agent.id} className="hover:shadow-2xl transition-all duration-300 border-0 shadow-lg bg-gradient-to-br from-white to-indigo-50/30 animate-scaleIn" style={{ animationDelay: `${index * 100}ms` }}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {agent.description}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="flex-shrink-0 bg-green-100 text-green-700 border-green-200">
                  {agent.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm p-2 bg-indigo-50/50 rounded-lg">
                  <span className="text-muted-foreground">Primary Provider</span>
                  <span className="font-semibold text-indigo-700">{agent.primaryProvider}</span>
                </div>
                {agent.fallbackProvider && (
                  <div className="flex items-center justify-between text-sm p-2 bg-purple-50/50 rounded-lg">
                    <span className="text-muted-foreground">Fallback Provider</span>
                    <span className="font-semibold text-purple-700">{agent.fallbackProvider}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm p-2 bg-emerald-50/50 rounded-lg">
                  <span className="text-muted-foreground">Enabled Tools</span>
                  <span className="font-semibold text-emerald-700">{agent.enabledTools.length}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-muted-foreground">Conversations</span>
                  <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{agent.conversations.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Used</span>
                  <span className="font-medium">{agent.lastUsed}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-300 transition-all duration-200"
                  onClick={() => setPlaygroundAgent(agent)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Chat
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-900 hover:border-purple-300 transition-all duration-200"
                  onClick={() => setVoiceAgent(agent)}
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Voice
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-900 hover:border-purple-300"
                  onClick={() => openEditModal(agent)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-900 hover:border-red-300"
                  onClick={() => handleDeleteAgent(agent.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {agents.length === 0 && (
        <Card className="text-center py-12 border-0 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardContent>
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
              <Bot className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first AI agent to get started
            </p>
            <Button onClick={openCreateModal} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl">
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </Button>
          </CardContent>
        </Card>
      )}

      <AgentModal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAgent(null);
        }}
        onSave={editingAgent ? handleEditAgent : handleCreateAgent}
        agent={editingAgent}
      />
    </div>
  );
}