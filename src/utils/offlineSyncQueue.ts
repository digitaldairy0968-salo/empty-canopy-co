/**
 * Offline Sync Queue
 * 
 * Queues all write operations (add/update/delete) in IndexedDB when offline.
 * When online, processes the queue in order against Supabase.
 */

import { supabase } from '@/integrations/supabase/client';

export interface SyncAction {
  id: string;
  timestamp: number;
  type: 'insert' | 'upsert' | 'update' | 'delete';
  table: string;
  data?: any;
  // For updates/deletes
  matchColumn?: string;
  matchValue?: string;
  // For upserts
  onConflict?: string;
  // For delete-then-insert patterns (e.g., deleteSupplier deletes entries first)
  prerequisiteActions?: SyncAction[];
  // Second match for compound conditions
  matchColumn2?: string;
  matchValue2?: string;
}

const DB_NAME = 'dairy_offline_db';
const DB_VERSION = 1;
const QUEUE_STORE = 'sync_queue';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };
    
    request.onerror = () => reject(request.error);
  });
}

// Notify listeners (UI badges) when queue changes — replaces polling
function emitQueueChanged() {
  try { window.dispatchEvent(new CustomEvent('sync-queue-changed')); } catch { /* ignore */ }
}

export async function addToSyncQueue(action: Omit<SyncAction, 'id' | 'timestamp'>): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const syncAction: SyncAction = {
    ...action,
    id,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(syncAction);
    tx.oncomplete = () => { emitQueueChanged(); resolve(id); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSyncQueue(): Promise<SyncAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const request = tx.objectStore(QUEUE_STORE).getAll();
    request.onsuccess = () => {
      const items = request.result as SyncAction[];
      // Sort by timestamp to process in order
      items.sort((a, b) => a.timestamp - b.timestamp);
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => { emitQueueChanged(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const request = tx.objectStore(QUEUE_STORE).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearSyncQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function executeSyncAction(action: SyncAction): Promise<boolean> {
  try {
    // Execute prerequisites first (e.g., delete entries before deleting supplier)
    if (action.prerequisiteActions) {
      for (const preAction of action.prerequisiteActions) {
        await executeSyncAction(preAction);
      }
    }

    let result: { error: any };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    switch (action.type) {
      case 'insert':
        result = await db.from(action.table).insert(action.data);
        break;
      
      case 'upsert':
        result = await db.from(action.table).upsert(action.data, {
          onConflict: action.onConflict || '',
        });
        break;
      
      case 'update': {
        let q = db.from(action.table).update(action.data);
        if (action.matchColumn && action.matchValue) q = q.eq(action.matchColumn, action.matchValue);
        if (action.matchColumn2 && action.matchValue2) q = q.eq(action.matchColumn2, action.matchValue2);
        result = await q;
        break;
      }
      
      case 'delete': {
        let q = db.from(action.table).delete();
        if (action.matchColumn && action.matchValue) q = q.eq(action.matchColumn, action.matchValue);
        if (action.matchColumn2 && action.matchValue2) q = q.eq(action.matchColumn2, action.matchValue2);
        result = await q;
        break;
      }
      
      default:
        return false;
    }

    if (result.error) {
      console.error(`[Sync] Failed to execute ${action.type} on ${action.table}:`, result.error);
      if (result.error.code === '23505' || result.error.message?.includes('duplicate')) {
        return true;
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Sync] Error executing action:`, err);
    return false;
  }
}

/**
 * Process the entire sync queue. Returns the number of successfully synced items.
 */
export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const queue = await getSyncQueue();
  let synced = 0;
  let failed = 0;

  for (const action of queue) {
    const success = await executeSyncAction(action);
    if (success) {
      await removeFromSyncQueue(action.id);
      synced++;
    } else {
      failed++;
      // Stop processing on first failure to maintain order
      break;
    }
  }

  return { synced, failed };
}
