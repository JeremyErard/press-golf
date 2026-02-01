/**
 * Offline Score Queue Utility
 *
 * Provides methods to queue scores for offline storage and sync them
 * when connectivity is restored. Uses the service worker's IndexedDB
 * storage for persistence.
 */

interface QueuedScore {
  roundId: string;
  holeNumber: number;
  strokes?: number;
  putts?: number;
  playerId?: string;
  url: string;
  authHeader: string;
  body: {
    holeNumber: number;
    strokes?: number;
    putts?: number;
    playerId?: string;
  };
}

/**
 * Queue a score update for offline sync
 * Call this when a score update fails due to network issues
 */
export async function queueScoreForSync(
  roundId: string,
  scoreData: {
    holeNumber: number;
    strokes?: number;
    putts?: number;
    playerId?: string;
  },
  token: string
): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[OfflineScores] Service worker not available');
    return false;
  }

  const registration = await navigator.serviceWorker.ready;

  if (!registration.active) {
    console.warn('[OfflineScores] No active service worker');
    return false;
  }

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://press-api.onrender.com/api";

  const queuedScore: QueuedScore = {
    roundId,
    holeNumber: scoreData.holeNumber,
    strokes: scoreData.strokes,
    putts: scoreData.putts,
    playerId: scoreData.playerId,
    url: `${API_URL}/rounds/${roundId}/scores`,
    authHeader: `Bearer ${token}`,
    body: scoreData,
  };

  registration.active.postMessage({
    type: 'QUEUE_SCORE',
    scoreData: queuedScore,
  });

  // Request background sync when online
  if ('sync' in registration) {
    try {
      await (registration as ServiceWorkerRegistration & { sync: SyncManager }).sync.register('sync-scores');
      console.log('[OfflineScores] Background sync registered');
    } catch (error) {
      console.warn('[OfflineScores] Background sync not supported:', error);
    }
  }

  return true;
}

/**
 * Manually trigger score sync (useful when coming back online)
 */
export async function syncScoresNow(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;

  if (registration.active) {
    registration.active.postMessage({ type: 'SYNC_NOW' });
  }
}

/**
 * Listen for synced scores from the service worker
 */
export function onScoreSynced(callback: (data: { holeNumber: number; strokes?: number; putts?: number }) => void): () => void {
  if (!('serviceWorker' in navigator)) {
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'SCORE_SYNCED') {
      callback(event.data.data);
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);

  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Listen for online/offline status changes
 */
export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
