import { useState } from 'react';
import { Search, Plus, Settings, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatContext } from '@/contexts/ChatContext';
import { SecurityBadge, StatusIndicator, ConnectionBadge } from './SecurityBadge';
import { AddContactDialog } from './ContactDialogs';
import { SettingsDialog } from './SettingsDialog';
import { Contact } from '@/lib/protocol';
import { cn } from '@/lib/utils';

interface ContactListProps {
  className?: string;
}

export function ContactList({ className }: ContactListProps) {
  const { identity, contacts, activeContact, setActiveContact, connected, getFingerprint } = useChatContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const filteredContacts = contacts.filter(c => 
    c.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.nickname?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={cn('flex flex-col h-full bg-card border-r border-border', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-semibold">SecureChat</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="h-8 w-8"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <ConnectionBadge connected={connected} />
        
        {identity && (
          <div className="text-xs text-muted-foreground font-mono truncate">
            {identity.username}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="pl-9 bg-input"
          />
        </div>
      </div>

      {/* Contacts */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? 'No contacts found' : 'No contacts yet'}
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <ContactItem
                key={contact.id}
                contact={contact}
                active={activeContact?.id === contact.id}
                onClick={() => setActiveContact(contact)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add Contact */}
      <div className="p-3 border-t border-border">
        <Button
          onClick={() => setAddContactOpen(true)}
          className="w-full"
          variant="outline"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Contact
        </Button>
      </div>

      <AddContactDialog open={addContactOpen} onOpenChange={setAddContactOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

interface ContactItemProps {
  contact: Contact;
  active: boolean;
  onClick: () => void;
}

function ContactItem({ contact, active, onClick }: ContactItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-3 rounded-lg text-left transition-colors',
        'hover:bg-muted/50',
        active && 'bg-muted'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <span className="text-sm font-medium text-secondary-foreground">
              {contact.username.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <StatusIndicator
            online={contact.online || false}
            className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {contact.nickname || contact.username}
            </span>
            {contact.verified && (
              <SecurityBadge verified={true} className="scale-90" />
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {contact.online ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>
    </button>
  );
}