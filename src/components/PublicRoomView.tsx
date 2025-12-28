import { useState, useRef, useEffect } from 'react';
import { Send, Globe, Users, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatContext } from '@/contexts/ChatContext';
import { StoredMessage } from '@/lib/protocol';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PublicRoomViewProps {
  className?: string;
}

export function PublicRoomView({ className }: PublicRoomViewProps) {
  const { identity, publicRoomMessages, sendPublicMessage } = useChatContext();
  const [messageInput, setMessageInput] = useState('');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [publicRoomMessages]);

  const handleSend = async () => {
    if (!messageInput.trim()) return;
    
    const content = messageInput.trim();
    setMessageInput('');
    
    try {
      await sendPublicMessage(content);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    }
  };

  const copyUsername = () => {
    if (identity?.username) {
      navigator.clipboard.writeText(identity.username);
      setCopied(true);
      toast.success('Username copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Public Room</span>
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                Open Server
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" />
              Everyone can join and chat
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-right mr-2">
            <p className="text-xs text-muted-foreground">Your username</p>
            <p className="text-sm font-medium">{identity?.username}</p>
          </div>
          <Button variant="outline" size="icon" onClick={copyUsername}>
            {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {/* Welcome Notice */}
          <div className="flex justify-center">
            <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm text-center max-w-md">
              <Globe className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="font-medium text-foreground">Welcome to the Public Room!</p>
              <p className="text-muted-foreground text-xs mt-1">
                This is an open chat room for testing. Messages are stored locally on your device.
              </p>
            </div>
          </div>
          
          {publicRoomMessages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">No messages yet. Start the conversation!</p>
            </div>
          )}
          
          {publicRoomMessages.map((message) => (
            <PublicMessageBubble
              key={message.id}
              message={message}
              isSent={message.senderId === identity?.id}
              senderName={message.senderId === identity?.id ? identity?.username || 'You' : 'Unknown'}
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
    </div>
  );
}

interface PublicMessageBubbleProps {
  message: StoredMessage;
  isSent: boolean;
  senderName: string;
}

function PublicMessageBubble({ message, isSent, senderName }: PublicMessageBubbleProps) {
  const time = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={cn('flex', isSent ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[75%] space-y-1')}>
        {!isSent && (
          <span className="text-xs font-medium text-primary ml-2">{senderName}</span>
        )}
        <div className={isSent ? 'chat-bubble-sent' : 'chat-bubble-received'}>
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className={cn(
          'flex items-center gap-1 text-xs text-muted-foreground',
          isSent ? 'justify-end' : 'justify-start'
        )}>
          <span>{time}</span>
        </div>
      </div>
    </div>
  );
}