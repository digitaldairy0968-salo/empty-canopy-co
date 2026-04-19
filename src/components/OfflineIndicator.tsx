import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, CloudOff, RefreshCw } from 'lucide-react';
import { getSyncQueueCount, processSyncQueue } from '@/utils/offlineSyncQueue';
import { useLanguage } from '@/contexts/LanguageContext';

const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { language } = useLanguage();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Event-driven count updates (no polling — saves CPU/battery)
  useEffect(() => {
    const updateCount = async () => {
      try {
        const count = await getSyncQueueCount();
        setPendingCount(count);
      } catch { /* ignore */ }
    };
    updateCount();
    const onQueueChanged = () => updateCount();
    window.addEventListener('sync-queue-changed', onQueueChanged);
    window.addEventListener('focus', onQueueChanged);
    window.addEventListener('online', onQueueChanged);
    return () => {
      window.removeEventListener('sync-queue-changed', onQueueChanged);
      window.removeEventListener('focus', onQueueChanged);
      window.removeEventListener('online', onQueueChanged);
    };
  }, []);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncing) {
      handleSync();
    }
  }, [isOnline, pendingCount]);

  const handleSync = async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      const result = await processSyncQueue();
      const newCount = await getSyncQueueCount();
      setPendingCount(newCount);
      if (result.synced > 0) {
        // Trigger a page-level data refresh
        window.dispatchEvent(new CustomEvent('sync-complete', { detail: result }));
      }
    } catch (err) {
      console.error('[Sync] Error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Don't show anything if online and no pending items
  if (isOnline && pendingCount === 0) return null;

  const offlineText = language === 'hi' ? 'ऑफलाइन' : language === 'gu' ? 'ઑફલાઇન' : 'Offline';
  const pendingText = language === 'hi' 
    ? `${pendingCount} बदलाव सिंक होने बाकी` 
    : language === 'gu' 
    ? `${pendingCount} ફેરફાર સિંક બાકી` 
    : `${pendingCount} changes pending sync`;
  const syncingText = language === 'hi' ? 'सिंक हो रहा है...' : language === 'gu' ? 'સિંક થઈ રહ્યું છે...' : 'Syncing...';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-medium animate-fade-in"
      style={{
        backgroundColor: isOnline ? 'hsl(var(--accent))' : 'hsl(var(--destructive))',
        color: isOnline ? 'hsl(var(--accent-foreground))' : 'hsl(var(--destructive-foreground))',
      }}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span>{offlineText}</span>
          {pendingCount > 0 && (
            <span className="opacity-80">• {pendingText}</span>
          )}
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>{syncingText}</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <CloudOff className="h-3.5 w-3.5" />
          <span>{pendingText}</span>
          <button 
            onClick={handleSync}
            className="ml-1 underline font-bold"
          >
            {language === 'hi' ? 'सिंक करें' : 'Sync now'}
          </button>
        </>
      ) : null}
    </div>
  );
};

export default OfflineIndicator;
