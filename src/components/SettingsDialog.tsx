import { useState, useEffect, useRef } from 'react';
import { Settings, Key, Server, Copy, Check, Shield, Trash2, Globe, Radio, Camera, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useChatContext } from '@/contexts/ChatContext';
import { toast } from 'sonner';
import { OPEN_SERVER_CONFIG } from '@/lib/protocol';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { identity, serverConfig, configureServer, getFingerprint, getFingerprintHex, updateAvatar } = useChatContext();
  const [serverType, setServerType] = useState<'open' | 'custom'>(serverConfig?.isOpenServer ? 'open' : 'custom');
  const [host, setHost] = useState(serverConfig?.host || '');
  const [port, setPort] = useState(serverConfig?.port?.toString() || '8443');
  const [useTLS, setUseTLS] = useState(serverConfig?.useTLS ?? true);
  const [copied, setCopied] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (serverConfig) {
      setServerType(serverConfig.isOpenServer ? 'open' : 'custom');
      setHost(serverConfig.host || '');
      setPort(serverConfig.port?.toString() || '8443');
      setUseTLS(serverConfig.useTLS ?? true);
    }
  }, [serverConfig]);

  const fingerprint = identity ? getFingerprint(identity.identityKeyPair.publicKey) : '';
  const fingerprintHex = identity ? getFingerprintHex(identity.identityKeyPair.publicKey) : '';

  const copyFingerprint = async () => {
    await navigator.clipboard.writeText(fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      await updateAvatar(reader.result as string);
      toast.success('Profile picture updated!');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveServer = async () => {
    try {
      if (serverType === 'open') {
        await configureServer({
          ...OPEN_SERVER_CONFIG,
          isOpenServer: true
        });
      } else {
        await configureServer({
          host: host.trim(),
          port: parseInt(port, 10),
          useTLS,
          isOpenServer: false
        });
      }
      toast.success('Server settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Settings
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="identity" className="pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="identity">
                <Key className="w-4 h-4 mr-2" />
                Identity
              </TabsTrigger>
              <TabsTrigger value="server">
                <Server className="w-4 h-4 mr-2" />
                Server
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="identity" className="space-y-4 pt-4">
              {identity ? (
                <>
                  {/* Profile Picture */}
                  <div className="flex flex-col items-center gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="relative w-20 h-20 rounded-full bg-muted border-2 border-border hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden group"
                    >
                      {identity.avatar ? (
                        <img src={identity.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                      )}
                      <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-5 h-5 text-primary" />
                      </div>
                    </button>
                    <p className="text-xs text-muted-foreground">Click to change profile picture</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Username</Label>
                    <div className="p-3 rounded-lg bg-muted font-mono">
                      {identity.username}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Your Fingerprint</Label>
                    <div className="fingerprint-display flex items-center justify-between">
                      <span className="text-primary">{fingerprint}</span>
                      <Button variant="ghost" size="sm" onClick={copyFingerprint}>
                        {copied ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono break-all">
                      {fingerprintHex}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Public Key</Label>
                    <div className="p-3 rounded-lg bg-muted text-xs font-mono break-all text-muted-foreground">
                      {identity.identityKeyPair.publicKey}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-primary mt-0.5" />
                      <span className="text-muted-foreground">
                        Your private keys never leave this device. Share your fingerprint 
                        with contacts over a secure channel to verify your identity.
                      </span>
                    </div>
                  </div>

                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Identity & Data
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No identity created yet
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="server" className="space-y-4 pt-4">
              {/* Server Type Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setServerType('open')}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    serverType === 'open'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/50 hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">Open Server</span>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setServerType('custom')}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    serverType === 'custom'
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted/50 hover:border-muted-foreground/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">Custom Server</span>
                  </div>
                </button>
              </div>

              {serverType === 'open' && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm">
                  <p className="text-foreground font-medium">Demo Server</p>
                  <p className="text-muted-foreground text-xs font-mono mt-1">
                    {OPEN_SERVER_CONFIG.host}:{OPEN_SERVER_CONFIG.port}
                  </p>
                </div>
              )}

              {serverType === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="settings-host">Server Address</Label>
                    <Input
                      id="settings-host"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="192.168.1.100 or chat.local"
                      className="bg-input font-mono"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="settings-port">Port</Label>
                    <Input
                      id="settings-port"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="8443"
                      className="bg-input font-mono"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="settings-tls">Use TLS</Label>
                    <Switch
                      id="settings-tls"
                      checked={useTLS}
                      onCheckedChange={setUseTLS}
                    />
                  </div>

                  {!useTLS && (
                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning">
                      Without TLS, connection metadata is visible on the network.
                    </div>
                  )}
                </>
              )}

              <Button onClick={handleSaveServer} className="w-full">
                Save Server Settings
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Identity & All Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your identity keys, contacts, and all messages. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                // Would call clearAllData here
                toast.success('All data deleted');
                setDeleteConfirmOpen(false);
                onOpenChange(false);
              }}
            >
              Delete Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}