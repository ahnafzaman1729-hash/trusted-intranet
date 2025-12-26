import { Shield, ShieldCheck, ShieldAlert, Wifi, WifiOff, Check, Clock, AlertCircle, Send } from 'lucide-react';
import { MessageStatus } from '@/lib/protocol';
import { cn } from '@/lib/utils';

interface SecurityBadgeProps {
  verified: boolean;
  className?: string;
}

export function SecurityBadge({ verified, className }: SecurityBadgeProps) {
  return (
    <span 
      className={cn(
        'security-badge',
        verified 
          ? 'bg-verified/20 text-verified' 
          : 'bg-warning/20 text-warning',
        className
      )}
    >
      {verified ? (
        <>
          <ShieldCheck className="w-3 h-3" />
          <span>Verified</span>
        </>
      ) : (
        <>
          <ShieldAlert className="w-3 h-3" />
          <span>Unverified</span>
        </>
      )}
    </span>
  );
}

interface ConnectionBadgeProps {
  connected: boolean;
  className?: string;
}

export function ConnectionBadge({ connected, className }: ConnectionBadgeProps) {
  return (
    <span 
      className={cn(
        'security-badge',
        connected 
          ? 'bg-online/20 text-online' 
          : 'bg-offline/20 text-offline',
        className
      )}
    >
      {connected ? (
        <>
          <Wifi className="w-3 h-3" />
          <span>Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3" />
          <span>Offline</span>
        </>
      )}
    </span>
  );
}

interface StatusIndicatorProps {
  online: boolean;
  className?: string;
}

export function StatusIndicator({ online, className }: StatusIndicatorProps) {
  return (
    <span 
      className={cn(
        'status-indicator',
        online ? 'status-online' : 'status-offline',
        className
      )} 
    />
  );
}

interface MessageStatusIconProps {
  status: MessageStatus;
  className?: string;
}

export function MessageStatusIcon({ status, className }: MessageStatusIconProps) {
  const iconClass = cn('w-3 h-3', className);
  
  switch (status) {
    case MessageStatus.QUEUED:
      return <Clock className={cn(iconClass, 'text-muted-foreground')} />;
    case MessageStatus.SENT:
      return <Send className={cn(iconClass, 'text-muted-foreground')} />;
    case MessageStatus.DELIVERED:
      return <Check className={cn(iconClass, 'text-primary')} />;
    case MessageStatus.READ:
      return (
        <div className="flex -space-x-1">
          <Check className={cn(iconClass, 'text-primary')} />
          <Check className={cn(iconClass, 'text-primary')} />
        </div>
      );
    case MessageStatus.FAILED:
      return <AlertCircle className={cn(iconClass, 'text-destructive')} />;
    default:
      return null;
  }
}

interface EncryptionBadgeProps {
  className?: string;
}

export function EncryptionBadge({ className }: EncryptionBadgeProps) {
  return (
    <span className={cn('security-badge bg-secure/20 text-secure', className)}>
      <Shield className="w-3 h-3" />
      <span>E2EE</span>
    </span>
  );
}