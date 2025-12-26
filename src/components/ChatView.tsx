import { useState, useRef, useEffect } from 'react';
import { Send, Shield, ShieldCheck, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatContext } from '@/contexts/ChatContext';
import { SecurityBadge, MessageStatusIcon, EncryptionBadge, StatusIndicator } from './SecurityBadge';
import { VerifyContactDialog } from './ContactDialogs';
import { StoredMessage, MessageStatus } from '@/lib/protocol';
import { generateConversationId } from '@/lib/crypto';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatViewProps {
  className?: string;
}

export function ChatView({ className }: ChatViewProps) {
  const { identity, activeContact, messages, sendMessage, loadMessages } = useChatContext();
  const [messageInput, setMessageInput] = useState('');
  const [verifyOpen, setVerifyOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const conversationId = identity && activeContact 
    ? generateConversationId(identity.id, activeContact.id)
    : null;
  
  const conversationMessages = conversationId 
    ? messages.get(conversationId) || []
    : [];

  // Load messages when active contact changes
  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId);
    }
  }, [conversationId, loadMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationMessages]);

  // Focus input when contact changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeContact]);

  const handleSend = async () => {
    if (!messageInput.trim()) return;
    
    const content = messageInput.trim();
    setMessageInput('');
    
    try {
      await sendMessage(content);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (!activeContact) {
    return (
      <div className={cn('flex flex-col items-center justify-center h-full bg-background', className)}>
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted">
            <Shield className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold">Select a Contact</h2>
            <p className="text-sm text-muted-foreground">
              Choose a contact to start a secure conversation
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <span className="text-sm font-medium text-secondary-foreground">
                {activeContact.username.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <StatusIndicator
              online={activeContact.online || false}
              className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{activeContact.username}</span>
              <SecurityBadge verified={activeContact.verified} />
            </div>
            <p className="text-xs text-muted-foreground">
              {activeContact.online ? 'Online' : 'Last seen recently'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <EncryptionBadge />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setVerifyOpen(true)}>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Verify Contact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {/* Security Notice */}
          <div className="flex justify-center">
            <div className="px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground">
              Messages are end-to-end encrypted
            </div>
          </div>
          
          {conversationMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isSent={message.senderId === identity?.id}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="bg-input"
          />
          <Button onClick={handleSend} disabled={!messageInput.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <VerifyContactDialog 
        open={verifyOpen} 
        onOpenChange={setVerifyOpen}
        contact={activeContact}
      />
    </div>
  );
}

interface MessageBubbleProps {
  message: StoredMessage;
  isSent: boolean;
}

function MessageBubble({ message, isSent }: MessageBubbleProps) {
  const time = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={cn('flex', isSent ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[75%] space-y-1')}>
        <div className={isSent ? 'chat-bubble-sent' : 'chat-bubble-received'}>
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className={cn(
          'flex items-center gap-1 text-xs text-muted-foreground',
          isSent ? 'justify-end' : 'justify-start'
        )}>
          <span>{time}</span>
          {isSent && <MessageStatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}