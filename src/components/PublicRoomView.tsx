import { useState, useRef, useEffect } from 'react';
import { Send, Globe, Users, Copy, Check, Image, UserPlus, Clock, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatContext } from '@/contexts/ChatContext';
import { StoredMessage, MessageType, ContactRequest } from '@/lib/protocol';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface PublicRoomViewProps {
  className?: string;
}

export function PublicRoomView({ className }: PublicRoomViewProps) {
  const { 
    identity, 
    publicRoomMessages, 
    sendPublicMessage, 
    sendPublicImage,
    sendContactRequest,
    pendingRequests,
    acceptContactRequest,
    contacts,
    setActiveContact,
    getFingerprint
  } = useChatContext();
  const [messageInput, setMessageInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showContactRequest, setShowContactRequest] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string } | null>(null);
  const [showDMDialog, setShowDMDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        await sendPublicImage(base64);
        toast.success('Image shared!');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast.error('Failed to share image');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

  const handleUserClick = (senderId: string, senderUsername: string) => {
    if (senderId === identity?.id) return;
    
    // Check if already a contact
    const existingContact = contacts.find(c => c.username === senderUsername);
    if (existingContact) {
      setActiveContact(existingContact);
      setShowDMDialog(true);
    } else {
      setSelectedUser({ id: senderId, username: senderUsername });
      setShowContactRequest(true);
    }
  };

  const handleSendContactRequest = async () => {
    if (!selectedUser) return;
    
    try {
      await sendContactRequest(selectedUser.id, selectedUser.username);
      toast.success(`Contact request sent to ${selectedUser.username}! They have 1 hour to accept.`);
      setShowContactRequest(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error('Failed to send contact request');
    }
  };

  // Get unique users from messages for display
  const activeUsers = Array.from(new Set(
    publicRoomMessages.map(m => m.senderUsername || 'Unknown')
  )).filter(u => u !== identity?.username);

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
              {activeUsers.length + 1} active • Share images & send contact requests
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

      {/* Pending Requests Banner */}
      {pendingRequests.length > 0 && (
        <div className="p-3 bg-primary/10 border-b border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">
                {pendingRequests.length} pending contact request{pendingRequests.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {pendingRequests.slice(0, 3).map((request) => (
              <PendingRequestBanner key={request.id} request={request} />
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {/* Welcome Notice */}
          <div className="flex justify-center">
            <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm text-center max-w-md">
              <Globe className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="font-medium text-foreground">Welcome to the Public Room!</p>
              <p className="text-muted-foreground text-xs mt-1">
                Share images, send messages, and tap on usernames to send contact requests. Requests expire in 1 hour.
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
              senderName={message.senderUsername || (message.senderId === identity?.id ? identity?.username || 'You' : 'Unknown')}
              onUserClick={() => handleUserClick(message.senderId, message.senderUsername || 'Unknown')}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => fileInputRef.current?.click()}
            title="Share image"
          >
            <Image className="w-4 h-4" />
          </Button>
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

      {/* Contact Request Dialog */}
      <Dialog open={showContactRequest} onOpenChange={setShowContactRequest}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Send Contact Request
            </DialogTitle>
            <DialogDescription>
              Send a contact request to {selectedUser?.username}. They will have 1 hour to accept and exchange credentials.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Request expires in 1 hour</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Your Fingerprint (will be shared)</Label>
              <code className="block text-xs bg-background p-2 rounded border border-border break-all">
                {identity ? getFingerprint(identity.identityKeyPair.publicKey) : ''}
              </code>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowContactRequest(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSendContactRequest} className="flex-1">
                <UserPlus className="w-4 h-4 mr-2" />
                Send Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DM Dialog for existing contacts */}
      <Dialog open={showDMDialog} onOpenChange={setShowDMDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Contact Already Added
            </DialogTitle>
            <DialogDescription>
              This user is already in your contacts. You can message them directly from the contacts list.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowDMDialog(false)} className="w-full mt-4">
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PendingRequestBanner({ request }: { request: ContactRequest }) {
  const { acceptContactRequest, getFingerprint, identity, setActiveContact, serverConfig } = useChatContext();
  const [loading, setLoading] = useState(false);
  const [acceptedContact, setAcceptedContact] = useState<{ id: string; username: string; identityKey: string; verified: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState(Math.max(0, request.expiresAt - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(Math.max(0, request.expiresAt - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [request.expiresAt]);

  const minutesLeft = Math.floor(timeLeft / 60000);
  const secondsLeft = Math.floor((timeLeft % 60000) / 1000);

  const handleAccept = async () => {
    setLoading(true);
    try {
      const contact = await acceptContactRequest(request.id);
      setAcceptedContact(contact);
      toast.success(`Added ${request.fromUsername} to contacts!`);
    } catch (err) {
      toast.error('Failed to accept request');
    } finally {
      setLoading(false);
    }
  };

  const handleStartDM = () => {
    if (acceptedContact) {
      setActiveContact(acceptedContact);
      // Navigate away from public room to contacts view
      if (serverConfig) {
        // Force a re-render by updating server config to non-open mode temporarily
        // For now, just set the active contact - user can access via sidebar
        toast.info(`Select ${acceptedContact.username} from the Contacts section in the sidebar to start messaging.`);
      }
    }
  };

  if (timeLeft <= 0 && !acceptedContact) return null;

  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{request.fromUsername}</span>
          {!acceptedContact && (
            <span className="text-xs text-muted-foreground">
              {minutesLeft}m {secondsLeft}s left
            </span>
          )}
          {acceptedContact && (
            <span className="text-xs text-primary font-medium">Added!</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          Fingerprint: {request.fromFingerprint}
        </p>
      </div>
      {acceptedContact ? (
        <Button size="sm" onClick={handleStartDM} variant="default">
          <MessageSquare className="w-3 h-3 mr-1" />
          Message
        </Button>
      ) : (
        <Button size="sm" onClick={handleAccept} disabled={loading}>
          {loading ? 'Adding...' : 'Accept'}
        </Button>
      )}
    </div>
  );
}

interface PublicMessageBubbleProps {
  message: StoredMessage;
  isSent: boolean;
  senderName: string;
  onUserClick: () => void;
}

function PublicMessageBubble({ message, isSent, senderName, onUserClick }: PublicMessageBubbleProps) {
  const time = new Date(message.timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className={cn('flex', isSent ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[75%] space-y-1')}>
        {!isSent && (
          <button 
            onClick={onUserClick}
            className="text-xs font-medium text-primary ml-2 hover:underline cursor-pointer"
          >
            {senderName}
          </button>
        )}
        <div className={isSent ? 'chat-bubble-sent' : 'chat-bubble-received'}>
          {message.type === MessageType.IMAGE && message.imageData ? (
            <img 
              src={message.imageData} 
              alt="Shared image" 
              className="max-w-full rounded-lg max-h-64 object-contain"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}
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
