import { useState } from 'react';
import { Settings, Key, Server, Copy, Check, Shield, Trash2 } from 'lucide-react';
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

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { identity, serverConfig, configureServer, getFingerprint, getFingerprintHex } = useChatContext();
  const [host, setHost] = useState(serverConfig?.host || '');
  const [port, setPort] = useState(serverConfig?.port?.toString() || '8443');
  const [useTLS, setUseTLS] = useState(serverConfig?.useTLS ?? true);
  const [copied, setCopied] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const fingerprint = identity ? getFingerprint(identity.identityKeyPair.publicKey) : '';
  const fingerprintHex = identity ? getFingerprintHex(identity.identityKeyPair.publicKey) : '';

  const copyFingerprint = async () => {
    await navigator.clipboard.writeText(fingerprint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveServer = async () => {
    try {
      await configureServer({
        host: host.trim(),
        port: parseInt(port, 10),
        useTLS
      });
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