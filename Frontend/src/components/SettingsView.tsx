import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

interface SettingsViewProps {
  tenantName: string;
  apiKey: string;
}

export function SettingsView({ tenantName, apiKey }: SettingsViewProps) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-semibold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenant Information</CardTitle>
          <CardDescription>
            Your organization details and API credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenantName">Organization Name</Label>
            <Input id="tenantName" value={tenantName} readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type="password"
                value={apiKey ? `${apiKey.slice(0, 6)}••••••••••••` : ''}
                readOnly
              />
              <Button variant="outline" disabled>
                Regenerate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Configure how you receive updates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Usage Alerts</p>
              <p className="text-sm text-muted-foreground">
                Get notified when usage exceeds thresholds
              </p>
            </div>
            <Button variant="outline" size="sm">Configure</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Error Reports</p>
              <p className="text-sm text-muted-foreground">
                Receive notifications about agent errors
              </p>
            </div>
            <Button variant="outline" size="sm">Configure</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
