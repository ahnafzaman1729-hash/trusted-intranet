import { useState } from 'react';
import { Shield, Key, Server, ArrowRight, Loader2, Lock, Globe, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useChatContext } from '@/contexts/ChatContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OPEN_SERVER_CONFIG } from '@/lib/protocol';

export function OnboardingScreen() {
  const { createIdentity, configureServer, connectToServer, identity, serverConfig } = useChatContext();
  const [step, setStep] = useState<'identity' | 'server' | 'connecting'>('identity');
  const [username, setUsername] = useState('');
  const [serverType, setServerType] = useState<'open' | 'custom'>('open');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8443');
  const [useTLS, setUseTLS] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateIdentity = async () => {
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await createIdentity(username.trim());
      setStep('server');
    } catch (err) {
      setError('Failed to create identity');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureServer = async () => {
    setLoading(true);
    setError('');
    
    try {
      if (serverType === 'open') {
        // For open server, just configure and we're done (no real connection needed)
        await configureServer({
          ...OPEN_SERVER_CONFIG,
          isOpenServer: true
        });
        // Skip connecting step for open server - it's local demo mode
      } else {
        if (!host.trim()) {
          setError('Server address is required');
          setLoading(false);
          return;
        }
        await configureServer({
          host: host.trim(),
          port: parseInt(port, 10),
          useTLS,
          isOpenServer: false
        });
        setStep('connecting');
        await connectToServer();
      }
    } catch (err) {
      setError('Failed to connect to server');
      setStep('server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 glow-primary">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SecureChat</h1>
          <p className="text-muted-foreground text-sm">
            End-to-end encrypted intranet messaging
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-center gap-2">
          {['identity', 'server', 'connecting'].map((s, i) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${
                step === s ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Identity Step */}
        {step === 'identity' && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                Create Identity
              </CardTitle>
              <CardDescription>
                Your cryptographic keys will be generated locally and never leave your device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="bg-input"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateIdentity()}
                />
              </div>
              
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              
              <Button 
                onClick={handleCreateIdentity}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Generate Keys
              </Button>
              
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Using XChaCha20-Poly1305 encryption with X25519 key exchange. 
                    Your private keys are stored only on this device.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Server Step */}
        {step === 'server' && (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                Connect to Server
              </CardTitle>
              <CardDescription>
                Choose an open server for testing or connect to your own intranet server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Server Type Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setServerType('open')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    serverType === 'open'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/50 hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-5 h-5 text-primary" />
                    <span className="font-medium">Open Server</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Demo server for testing. No setup required.
                  </p>
                </button>
                
                <button
                  type="button"
                  onClick={() => setServerType('custom')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    serverType === 'custom'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/50 hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Radio className="w-5 h-5 text-primary" />
                    <span className="font-medium">Custom Server</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your own intranet server.
                  </p>
                </button>
              </div>

              {/* Open Server Info */}
              {serverType === 'open' && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-start gap-2 text-sm">
                    <Globe className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-foreground font-medium">Demo Server</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {OPEN_SERVER_CONFIG.host}:{OPEN_SERVER_CONFIG.port}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">
                        Messages are still end-to-end encrypted. The server cannot read them.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Server Fields */}
              {serverType === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="host">Server Address</Label>
                    <Input
                      id="host"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="192.168.1.100 or chat.local"
                      className="bg-input font-mono"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="8443"
                      className="bg-input font-mono"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="tls" className="text-sm">Use TLS (recommended)</Label>
                    <Switch
                      id="tls"
                      checked={useTLS}
                      onCheckedChange={setUseTLS}
                    />
                  </div>
                  
                  {!useTLS && (
                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                      <p className="text-xs text-warning">
                        Without TLS, connection metadata may be visible on the network. 
                        Message contents remain encrypted.
                      </p>
                    </div>
                  )}
                </>
              )}
              
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              
              <Button 
                onClick={handleConfigureServer}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-4 h-4 mr-2" />
                )}
                Connect
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Connecting Step */}
        {step === 'connecting' && (
          <Card className="border-border bg-card">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Connecting to server...</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}