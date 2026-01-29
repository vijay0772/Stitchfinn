import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Checkbox } from './ui/checkbox';
import { Agent } from './AgentsView';

interface AgentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (agent: Omit<Agent, 'id' | 'conversations' | 'lastUsed' | 'status'>) => void;
  agent?: Agent | null;
}

const availableTools = [
  { id: 'knowledge_base', label: 'Knowledge Base Search' },
  { id: 'ticket_creation', label: 'Ticket Creation' },
  { id: 'product_catalog', label: 'Product Catalog' },
  { id: 'pricing_info', label: 'Pricing Information' },
  { id: 'docs_search', label: 'Documentation Search' },
  { id: 'code_examples', label: 'Code Examples' },
  { id: 'user_profile', label: 'User Profile Access' },
  { id: 'tutorials', label: 'Tutorial Library' },
];

export function AgentModal({ open, onClose, onSave, agent }: AgentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    primaryProvider: 'VendorA' as 'VendorA' | 'VendorB',
    fallbackProvider: undefined as 'VendorA' | 'VendorB' | undefined,
    enabledTools: [] as string[],
  });

  useEffect(() => {
    if (agent) {
      setFormData({
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        primaryProvider: agent.primaryProvider,
        fallbackProvider: agent.fallbackProvider,
        enabledTools: agent.enabledTools,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        systemPrompt: '',
        primaryProvider: 'VendorA',
        fallbackProvider: undefined,
        enabledTools: [],
      });
    }
  }, [agent, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const toggleTool = (toolId: string) => {
    setFormData(prev => ({
      ...prev,
      enabledTools: prev.enabledTools.includes(toolId)
        ? prev.enabledTools.filter(id => id !== toolId)
        : [...prev.enabledTools, toolId],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {agent ? 'Edit Agent' : 'Create New Agent'}
          </DialogTitle>
          <DialogDescription>
            Configure your AI agent's behavior and capabilities
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                placeholder="e.g., Customer Support Bot"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the agent's purpose"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                placeholder="You are a helpful assistant that..."
                rows={4}
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Define how the agent should behave and respond
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryProvider">Primary Provider</Label>
                <Select
                  value={formData.primaryProvider}
                  onValueChange={(value: 'VendorA' | 'VendorB') => 
                    setFormData({ ...formData, primaryProvider: value })
                  }
                >
                  <SelectTrigger id="primaryProvider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VendorA">VendorA</SelectItem>
                    <SelectItem value="VendorB">VendorB</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fallbackProvider">Fallback Provider (Optional)</Label>
                <Select
                  value={formData.fallbackProvider || 'none'}
                  onValueChange={(value) => 
                    setFormData({ 
                      ...formData, 
                      fallbackProvider: value === 'none' ? undefined : value as 'VendorA' | 'VendorB'
                    })
                  }
                >
                  <SelectTrigger id="fallbackProvider">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="VendorA">VendorA</SelectItem>
                    <SelectItem value="VendorB">VendorB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Enabled Tools</Label>
              <div className="grid grid-cols-2 gap-3">
                {availableTools.map((tool) => (
                  <div key={tool.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={tool.id}
                      checked={formData.enabledTools.includes(tool.id)}
                      onCheckedChange={() => toggleTool(tool.id)}
                    />
                    <label
                      htmlFor={tool.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {tool.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {agent ? 'Save Changes' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
