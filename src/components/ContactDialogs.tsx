import { useState } from 'react';
import { Search, Loader2, ShieldCheck, Copy, Check, UserPlus, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useChatContext } from '@/contexts/ChatContext';
import { Contact } from '@/lib/protocol';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddContactDialog({ open, onOpenChange }: AddContactDialogProps) {
  const { addContact, addContactManual, connected } = useChatContext();
  const [username, setUsername] = useState('');
  const [manualUsername, setManualUsername] = useState('');
  const [manualPublicKey, setManualPublicKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!username.trim()) return;
    
    setLoading(true);
    setError('');
    
    try {
      const contact = await addContact(username.trim());
      if (contact) {
        toast.success(`Added ${contact.username} to contacts`);
        onOpenChange(false);
        setUsername('');
      } else {
        setError('User not found');
      }
    } catch (err) {
      setError('Failed to add contact');
    } finally {
      setLoading(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualUsername.trim() || !manualPublicKey.trim()) {
      setError('Username and public key are required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const contact = await addContactManual(manualUsername.trim(), manualPublicKey.trim());
      if (contact) {
        toast.success(`Added ${contact.username} to contacts`);
        onOpenChange(false);
        setManualUsername('');
        setManualPublicKey('');
      } else {
        setError('Failed to add contact');
      }
    } catch (err) {
      setError('Invalid public key format');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Add a contact by searching the server or manually entering their details.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="manual" className="pt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">
              <Key className="w-4 h-4 mr-2" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="server" disabled={!connected}>
              <Search className="w-4 h-4 mr-2" />
              Server
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="manual" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="manual-username">Contact Username</Label>
              <Input
                id="manual-username"
                value={manualUsername}
                onChange={(e) => setManualUsername(e.target.value)}
                placeholder="Enter their username"
                className="bg-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="manual-key">Their Public Key</Label>
              <Input
                id="manual-key"
                value={manualPublicKey}
                onChange={(e) => setManualPublicKey(e.target.value)}
                placeholder="Paste their public key..."
                className="bg-input font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Ask your contact to share their public key from Settings → Identity
              </p>
            </div>
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            
            <Button onClick={handleManualAdd} disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Add Contact
            </Button>
          </TabsContent>
          
          <TabsContent value="server" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="search-username">Username</Label>
              <div className="flex gap-2">
                <Input
                  id="search-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter username..."
                  className="bg-input"
                  disabled={!connected}
                />
                <Button onClick={handleSearch} disabled={loading || !connected}>
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {!connected && (
              <p className="text-sm text-warning">
                Connect to server to search for contacts
              </p>
            )}
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface VerifyContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
}

export function VerifyContactDialog({ open, onOpenChange, contact }: VerifyContactDialogProps) {
  const { identity, verifyContact, getFingerprint, getFingerprintHex } = useChatContext();
  const [copied, setCopied] = useState<'mine' | 'theirs' | null>(null);

  if (!contact || !identity) return null;

  const myFingerprint = getFingerprint(identity.identityKeyPair.publicKey);
  const myFingerprintHex = getFingerprintHex(identity.identityKeyPair.publicKey);
  const theirFingerprint = getFingerprint(contact.identityKey);
  const theirFingerprintHex = getFingerprintHex(contact.identityKey);

  const copyToClipboard = async (text: string, type: 'mine' | 'theirs') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleVerify = async () => {
    await verifyContact(contact.id);
    toast.success(`${contact.username} has been verified`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Verify Contact
          </DialogTitle>
          <DialogDescription>
            Compare these fingerprints with {contact.username} over a secure channel (e.g., phone call).
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          {/* Your Fingerprint */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Your Fingerprint</Label>
            <div className="space-y-2">
              <div className="fingerprint-display flex items-center justify-between">
                <span className="text-primary">{myFingerprint}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(myFingerprint, 'mine')}
                >
                  {copied === 'mine' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {myFingerprintHex}
              </div>
            </div>
          </div>

          {/* Their Fingerprint */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">{contact.username}'s Fingerprint</Label>
            <div className="space-y-2">
              <div className="fingerprint-display flex items-center justify-between">
                <span className="text-accent">{theirFingerprint}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(theirFingerprint, 'theirs')}
                >
                  {copied === 'theirs' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {theirFingerprintHex}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm text-muted-foreground">
            <strong>Verification steps:</strong>
            <ol className="list-decimal ml-4 mt-2 space-y-1">
              <li>Call {contact.username} on a trusted phone line</li>
              <li>Read your fingerprint words to them</li>
              <li>Ask them to read their fingerprint to you</li>
              <li>If both match, click "Mark as Verified"</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleVerify} className="flex-1">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Mark as Verified
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}