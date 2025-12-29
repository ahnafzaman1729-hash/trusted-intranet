import { useState } from 'react';
import { 
  Settings, 
  Users, 
  Copy, 
  Check, 
  Shield, 
  Globe, 
  ChevronLeft,
  ChevronRight,
  User,
  Key,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatContext } from '@/contexts/ChatContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SettingsDialog } from '@/components/SettingsDialog';

interface PublicRoomSidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function PublicRoomSidebar({ className, collapsed, onToggleCollapse }: PublicRoomSidebarProps) {
  const { identity, contacts, pendingRequests, getFingerprint, connected } = useChatContext();
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const copyUsername = () => {
    if (identity?.username) {
      navigator.clipboard.writeText(identity.username);
      setCopiedUsername(true);
      toast.success('Username copied!');
      setTimeout(() => setCopiedUsername(false), 2000);
    }
  };

  const copyFingerprint = () => {
    if (identity) {
      const fingerprint = getFingerprint(identity.identityKeyPair.publicKey);
      navigator.clipboard.writeText(fingerprint);
      setCopiedFingerprint(true);
      toast.success('Fingerprint copied!');
      setTimeout(() => setCopiedFingerprint(false), 2000);
    }
  };

  const fingerprint = identity ? getFingerprint(identity.identityKeyPair.publicKey) : '';

  if (collapsed) {
    return (
      <div className={cn(
        'flex flex-col items-center py-4 gap-4 bg-sidebar-background border-r border-sidebar-border w-14',
        className
      )}>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggleCollapse}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
        
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        
        <div className="flex-1" />
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setShowSettings(true)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <Settings className="w-5 h-5" />
        </Button>

        <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      </div>
    );
  }

  return (
    <div className={cn(
      'flex flex-col bg-sidebar-background border-r border-sidebar-border w-72',
      className
    )}>
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sidebar-foreground">SecureChat</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggleCollapse}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center gap-2 text-xs">
          <div className={cn(
            'w-2 h-2 rounded-full',
            connected ? 'bg-online' : 'bg-offline'
          )} />
          <span className="text-muted-foreground">
            {connected ? 'Connected' : 'Offline Mode'}
          </span>
        </div>
      </div>

      {/* User Identity Card */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="space-y-3">
          {/* Username */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Username</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={copyUsername}
            >
              {copiedUsername ? (
                <Check className="w-3 h-3 text-primary" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <p className="font-medium text-sidebar-foreground pl-6">
            {identity?.username || 'Anonymous'}
          </p>

          {/* Fingerprint */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Fingerprint</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={copyFingerprint}
            >
              {copiedFingerprint ? (
                <Check className="w-3 h-3 text-primary" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <code className="text-xs font-mono text-muted-foreground pl-6 break-all block">
            {fingerprint.slice(0, 16)}...
          </code>
        </div>
      </div>

      {/* Current Room */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-sidebar-foreground">Public Room</span>
          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
            Active
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Everyone can see messages in this room. Tap usernames to send contact requests.
        </p>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium text-sidebar-foreground">
              Pending Requests
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-warning/20 text-warning text-xs font-medium">
              {pendingRequests.length}
            </span>
          </div>
        </div>
      )}

      {/* Contacts Summary */}
      <ScrollArea className="flex-1 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-sidebar-foreground">
            Contacts ({contacts.length})
          </span>
        </div>
        
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No contacts yet. Send contact requests in the public room!
          </p>
        ) : (
          <div className="space-y-2">
            {contacts.slice(0, 5).map(contact => (
              <div 
                key={contact.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-sidebar-accent/50"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary">
                    {contact.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">
                    {contact.username}
                  </p>
                  {contact.verified && (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Verified
                    </p>
                  )}
                </div>
              </div>
            ))}
            {contacts.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{contacts.length - 5} more contacts
              </p>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={() => setShowSettings(true)}
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
