import { ChatProvider, useChatContext } from '@/contexts/ChatContext';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { ContactList } from '@/components/ContactList';
import { ChatView } from '@/components/ChatView';
import { Loader2, Shield } from 'lucide-react';

function ChatApp() {
  const { initialized, identity, serverConfig, connected } = useChatContext();

  // Loading state
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
            <Shield className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Initializing secure storage...</p>
        </div>
      </div>
    );
  }

  // Onboarding if no identity
  if (!identity || !serverConfig) {
    return <OnboardingScreen />;
  }

  // Main chat interface
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <ContactList className="w-80 flex-shrink-0" />
      <ChatView className="flex-1" />
    </div>
  );
}

export default function Index() {
  return (
    <ChatProvider>
      <ChatApp />
    </ChatProvider>
  );
}