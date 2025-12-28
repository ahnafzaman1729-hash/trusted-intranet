import { useState, useEffect } from 'react';
import { Search, Loader2, ShieldCheck, Copy, Check, UserPlus, Fingerprint } from 'lucide-react';
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
import { Contact, ContactRequest } from '@/lib/protocol';
import { toast } from 'sonner';

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddContactDialog({ open, onOpenChange }: AddContactDialogProps) {
  const { addContact, addContactByFingerprint, connected, identity, getFingerprint, pendingRequests } = useChatContext();
  const [username, setUsername] = useState('');
  const [contactUsername, setContactUsername] = useState('');
  const [contactFingerprint, setContactFingerprint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const myFingerprint = identity ? getFingerprint(identity.identityKeyPair.publicKey) : '';

  const copyMyFingerprint = () => {
    navigator.clipboard.writeText(myFingerprint);
    setCopied(true);
    toast.success('Fingerprint copied!');
    setTimeout(() => setCopied(false), 2000);
  };

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

  const handleFingerprintAdd = async () => {
    if (!contactUsername.trim() || !contactFingerprint.trim()) {
      setError('Username and fingerprint are required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const contact = await addContactByFingerprint(contactUsername.trim(), contactFingerprint.trim());
      if (contact) {
        toast.success(`Added ${contact.username} to contacts (verified by fingerprint)`);
        onOpenChange(false);
        setContactUsername('');
        setContactFingerprint('');
      } else {
        setError('Failed to add contact');
      }
    } catch (err) {
      setError('Invalid fingerprint format');
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
            Add a contact by verifying fingerprints or searching the server.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="fingerprint" className="pt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fingerprint">
              <Fingerprint className="w-4 h-4 mr-2" />
              Fingerprint
            </TabsTrigger>
            <TabsTrigger value="server" disabled={!connected}>
              <Search className="w-4 h-4 mr-2" />
              Server
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="fingerprint" className="space-y-4 pt-4">
            {/* Your fingerprint to share */}
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-2">
              <Label className="text-sm font-medium text-primary">Your Fingerprint (share this)</Label>
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs bg-background px-2 py-1 rounded flex-1 break-all">
                  {myFingerprint}
                </code>
                <Button variant="ghost" size="icon" onClick={copyMyFingerprint}>
                  {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact-username">Contact Username</Label>
              <Input
                id="contact-username"
                value={contactUsername}
                onChange={(e) => setContactUsername(e.target.value)}
                placeholder="Enter their username"
                className="bg-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact-fingerprint">Their Fingerprint</Label>
              <Input
                id="contact-fingerprint"
                value={contactFingerprint}
                onChange={(e) => setContactFingerprint(e.target.value)}
                placeholder="e.g. alpha bravo charlie delta echo foxtrot"
                className="bg-input"
              />
              <p className="text-xs text-muted-foreground">
                Exchange fingerprints over a secure channel (phone call, in person)
              </p>
            </div>
            
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            
            <Button onClick={handleFingerprintAdd} disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Add & Verify Contact
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

        {/* Pending requests section */}
        {pendingRequests.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <Label className="text-sm font-medium">Pending Contact Requests</Label>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {pendingRequests.map((request) => (
                <PendingRequestItem key={request.id} request={request} />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PendingRequestItem({ request }: { request: ContactRequest }) {
  const { acceptContactRequest } = useChatContext();
  const [loading, setLoading] = useState(false);
  const timeLeft = Math.max(0, request.expiresAt - Date.now());
  const minutesLeft = Math.floor(timeLeft / 60000);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await acceptContactRequest(request.id);
      toast.success(`Added ${request.fromUsername} to contacts!`);
    } catch (err) {
      toast.error('Failed to accept request');
    } finally {
      setLoading(false);
    }
  };

  if (timeLeft <= 0) return null;

  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border">
      <div>
        <p className="text-sm font-medium">{request.fromUsername}</p>
        <p className="text-xs text-muted-foreground">{minutesLeft}m left to accept</p>
      </div>
      <Button size="sm" onClick={handleAccept} disabled={loading}>
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Accept'}
      </Button>
    </div>
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
