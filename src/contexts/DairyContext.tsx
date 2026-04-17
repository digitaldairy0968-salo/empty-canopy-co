import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { showNotification, requestNotificationPermission } from '@/utils/notifications';
import { addToSyncQueue, processSyncQueue, getSyncQueueCount, getSyncQueue } from '@/utils/offlineSyncQueue';

export interface MilkEntry {
  date: string;
  morningMilk: number | null;
  morningFat: number | null;
  morningSNF: number | null;
  morningLR: number | null;
  morningPrice: number | null;
  eveningMilk: number | null;
  eveningFat: number | null;
  eveningSNF: number | null;
  eveningLR: number | null;
  eveningPrice: number | null;
}

export interface Supplier {
  id: string;
  dairyId: string;
  name: string;
  phone: string;
  code?: string;
  animalType: 'cow' | 'buffalo' | 'goat' | 'buyer';
  animalName?: string;
  villageName?: string;
  address?: string;
  entries: MilkEntry[];
  createdAt: string;
  pendingBalance?: number;
  canSeeCalculations?: boolean;
}

export interface Announcement {
  id: string;
  dairyId: string;
  message: string;
  createdAt: string;
}

interface RateSettings {
  fatRate: number;
  literRate: number;
  showCalculationsToSuppliers: boolean;
  calculationMethod: 'avg_fat' | 'daily_total';
}

interface DairyContextType {
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'dairyId' | 'entries' | 'createdAt'>) => Promise<void>;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  addMilkEntry: (supplierId: string, entry: MilkEntry) => Promise<void>;
  updateMilkEntry: (supplierId: string, date: string, entry: Partial<MilkEntry>) => Promise<void>;
  rateSettings: RateSettings;
  updateRateSettings: (settings: Partial<RateSettings>) => Promise<void>;
  getSupplierStats: (supplierId: string, days: number) => {
    totalMilk: number;
    totalFat: number;
    avgFat: number;
    totalAmount: number;
    fatEntryCount: number;
  };
  getTodayStats: () => {
    totalMilk: number;
    totalFat: number;
    avgFat: number;
    morningMilk: number;
    eveningMilk: number;
    morningAvgFat: number;
    eveningAvgFat: number;
    suppliers: number;
  };
  getSupplierByPhone: (phone: string) => Supplier | undefined;
  announcements: Announcement[];
  addAnnouncement: (message: string) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;
  updateDairy: (name: string) => Promise<boolean>;
  loading: boolean;
  isOnline: boolean;
  pendingSyncCount: number;
  refreshData: () => Promise<void>;
  enableNotifications: () => Promise<boolean>;
}

const DairyContext = createContext<DairyContextType | undefined>(undefined);

// Cache keys
const CACHE_KEY_SUPPLIERS = 'dairy_app_suppliers_cache';
const CACHE_KEY_ANNOUNCEMENTS = 'dairy_app_announcements_cache';
const CACHE_KEY_RATES = 'dairy_app_rates_cache';
const CACHE_KEY_TIMESTAMP = 'dairy_app_cache_timestamp';

// Helper to fetch all rows from a table, bypassing the 1000-row limit
async function fetchAllRows(query: any) {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error('Error fetching paginated data:', error);
      break;
    }
    if (data) {
      allData = allData.concat(data);
    }
    if (!data || data.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      from += PAGE_SIZE;
    }
  }

  return allData;
}

export const DairyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, authUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const cached = localStorage.getItem(CACHE_KEY_SUPPLIERS);
    return cached ? JSON.parse(cached) : [];
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    const cached = localStorage.getItem(CACHE_KEY_ANNOUNCEMENTS);
    return cached ? JSON.parse(cached) : [];
  });
  const [rateSettings, setRateSettings] = useState<RateSettings>(() => {
    const cached = localStorage.getItem(CACHE_KEY_RATES);
    return cached ? JSON.parse(cached) : { fatRate: 8, literRate: 50, showCalculationsToSuppliers: true, calculationMethod: 'avg_fat' };
  });
  const [loading, setLoading] = useState(() => {
    const cached = localStorage.getItem(CACHE_KEY_SUPPLIERS);
    return !cached;
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const syncInFlightRef = useRef(false);
  const fetchDataRef = useRef<(() => void) | null>(null);

  const applyPendingSupplierQueue = useCallback(async (baseSuppliers: Supplier[]) => {
    if (!user?.dairyId) return baseSuppliers;

    try {
      const queue = await getSyncQueue();
      const supplierMap = new Map(baseSuppliers.map(supplier => [supplier.id, supplier]));

      for (const action of queue) {
        if (action.table !== 'suppliers') continue;

        const data = (action.data ?? {}) as Record<string, any>;

        if (action.type === 'insert' || action.type === 'upsert') {
          if (data.dairy_id !== user.dairyId || !data.id) continue;

          const existing = supplierMap.get(data.id);
          supplierMap.set(data.id, {
            id: data.id,
            dairyId: data.dairy_id,
            name: data.name ?? existing?.name ?? '',
            phone: data.phone ?? existing?.phone ?? '',
            code: data.code ? String(data.code) : existing?.code,
            animalType: (data.animal_type as Supplier['animalType']) ?? existing?.animalType ?? 'cow',
            animalName: data.animal_name ?? existing?.animalName,
            villageName: data.village_name ?? existing?.villageName,
            address: data.address ?? existing?.address,
            entries: existing?.entries ?? [],
            createdAt: data.created_at ?? existing?.createdAt ?? new Date().toISOString(),
            pendingBalance: Number(data.pending_balance ?? existing?.pendingBalance ?? 0),
            canSeeCalculations: data.can_see_calculations ?? existing?.canSeeCalculations ?? true,
          });
          continue;
        }

        const targetId = action.matchColumn === 'id' ? action.matchValue : undefined;
        if (!targetId) continue;

        if (action.type === 'delete') {
          supplierMap.delete(targetId);
          continue;
        }

        if (action.type === 'update') {
          const existing = supplierMap.get(targetId);
          if (!existing) continue;

          supplierMap.set(targetId, {
            ...existing,
            name: data.name ?? existing.name,
            phone: data.phone ?? existing.phone,
            code: data.code !== undefined ? (data.code || undefined) : existing.code,
            animalType: (data.animal_type as Supplier['animalType']) ?? existing.animalType,
            animalName: data.animal_name !== undefined ? data.animal_name || undefined : existing.animalName,
            villageName: data.village_name !== undefined ? data.village_name || undefined : existing.villageName,
            address: data.address !== undefined ? data.address || undefined : existing.address,
            pendingBalance: data.pending_balance !== undefined ? Number(data.pending_balance) : existing.pendingBalance,
            canSeeCalculations: data.can_see_calculations ?? existing.canSeeCalculations,
          });
        }
      }

      return Array.from(supplierMap.values());
    } catch {
      return baseSuppliers;
    }
  }, [user?.dairyId]);

  // Monitor online status + external sync refreshes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setIsOnline(navigator.onLine);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for sync-complete events from OfflineIndicator
    const handleSyncComplete = () => {
      if (user?.dairyId) fetchDataRef.current?.();
    };
    window.addEventListener('sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('sync-complete', handleSyncComplete);
    };
  }, [user?.dairyId]);

  // Track pending sync count
  useEffect(() => {
    const updateCount = async () => {
      try {
        const count = await getSyncQueueCount();
        setPendingSyncCount(count);
      } catch { /* ignore */ }
    };
    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Save to cache whenever data changes
  useEffect(() => {
    if (suppliers.length > 0) {
      localStorage.setItem(CACHE_KEY_SUPPLIERS, JSON.stringify(suppliers));
    }
  }, [suppliers]);

  useEffect(() => {
    if (announcements.length > 0) {
      localStorage.setItem(CACHE_KEY_ANNOUNCEMENTS, JSON.stringify(announcements));
    }
  }, [announcements]);

  useEffect(() => {
    localStorage.setItem(CACHE_KEY_RATES, JSON.stringify(rateSettings));
  }, [rateSettings]);

  const fetchData = useCallback(async () => {
    if (!user?.dairyId) {
      setSuppliers([]);
      setAnnouncements([]);
      setLoading(false);
      return;
    }

    if (!navigator.onLine) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Fetch suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('dairy_id', user.dairyId);

      if (suppliersError) {
        console.error('Error fetching suppliers:', suppliersError);
      }

      // Fetch ALL milk entries using pagination
      const supplierIds = suppliersData?.map(s => s.id) || [];
      let entriesData: any[] = [];
      
      if (supplierIds.length > 0) {
        entriesData = await fetchAllRows(
          supabase
            .from('milk_entries')
            .select('*')
            .in('supplier_id', supplierIds)
            .order('date', { ascending: true })
        );
      }

      // Map suppliers with their entries
      const mappedSuppliers: Supplier[] = (suppliersData || []).map(s => {
        const supplierEntries = entriesData.filter(e => e.supplier_id === s.id);
        
        const entriesByDate: { [date: string]: MilkEntry } = {};
        supplierEntries.forEach(e => {
          const date = e.date;
          if (!entriesByDate[date]) {
            entriesByDate[date] = {
              date,
              morningMilk: null, morningFat: null, morningSNF: null, morningLR: null, morningPrice: null,
              eveningMilk: null, eveningFat: null, eveningSNF: null, eveningLR: null, eveningPrice: null,
            };
          }
          if (e.time_of_day === 'morning') {
            entriesByDate[date].morningMilk = e.quantity;
            entriesByDate[date].morningFat = e.fat;
            entriesByDate[date].morningSNF = e.snf;
            entriesByDate[date].morningLR = e.lr;
            entriesByDate[date].morningPrice = (e as any).price;
          } else {
            entriesByDate[date].eveningMilk = e.quantity;
            entriesByDate[date].eveningFat = e.fat;
            entriesByDate[date].eveningSNF = e.snf;
            entriesByDate[date].eveningLR = e.lr;
            entriesByDate[date].eveningPrice = (e as any).price;
          }
        });

        return {
          id: s.id,
          dairyId: s.dairy_id,
          name: s.name,
          phone: s.phone,
          code: s.code || undefined,
          animalType: (s.animal_type as 'cow' | 'buffalo' | 'goat' | 'buyer') || 'cow',
          villageName: s.village_name || undefined,
          address: s.address || undefined,
          entries: Object.values(entriesByDate),
          createdAt: s.created_at,
          pendingBalance: Number((s as any).pending_balance) || 0,
          canSeeCalculations: (s as any).can_see_calculations ?? true,
        };
      });

      const mergedSuppliers = await applyPendingSupplierQueue(mappedSuppliers);

      setSuppliers(mergedSuppliers);
      localStorage.setItem(CACHE_KEY_SUPPLIERS, JSON.stringify(mergedSuppliers));

      // Fetch announcements
      const { data: announcementsData, error: announcementsError } = await supabase
        .from('announcements')
        .select('*')
        .eq('dairy_id', user.dairyId)
        .order('created_at', { ascending: false });

      if (announcementsError) {
        console.error('Error fetching announcements:', announcementsError);
      }

      const mappedAnnouncements = (announcementsData || []).map(a => ({
        id: a.id,
        dairyId: a.dairy_id,
        message: a.message,
        createdAt: a.created_at,
      }));
      setAnnouncements(mappedAnnouncements);
      localStorage.setItem(CACHE_KEY_ANNOUNCEMENTS, JSON.stringify(mappedAnnouncements));

      // Fetch rate settings
      const { data: rateData, error: rateError } = await supabase
        .from('rate_settings')
        .select('*')
        .eq('dairy_id', user.dairyId)
        .maybeSingle();

      if (rateError) {
        console.error('Error fetching rate settings:', rateError);
      }

      if (rateData) {
        const cachedRates = localStorage.getItem(CACHE_KEY_RATES);
        const existingRates = cachedRates ? JSON.parse(cachedRates) : { literRate: 50, showCalculationsToSuppliers: true, calculationMethod: 'avg_fat' };
        const newRates = { 
          fatRate: Number(rateData.rate_value) || 8,
          literRate: Number((rateData as any).liter_rate) || existingRates.literRate || 50,
          showCalculationsToSuppliers: (rateData as any).show_calculations_to_suppliers ?? existingRates.showCalculationsToSuppliers ?? true,
          calculationMethod: ((rateData as any).calculation_method as 'avg_fat' | 'daily_total') || existingRates.calculationMethod || 'avg_fat'
        };
        setRateSettings(newRates);
        localStorage.setItem(CACHE_KEY_RATES, JSON.stringify(newRates));
      }

      localStorage.setItem(CACHE_KEY_TIMESTAMP, new Date().toISOString());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [applyPendingSupplierQueue, user?.dairyId]);

  const syncPendingChanges = useCallback(async () => {
    if (!user?.dairyId || !navigator.onLine || syncInFlightRef.current) return;

    try {
      const queuedBeforeSync = await getSyncQueueCount();
      setPendingSyncCount(queuedBeforeSync);

      if (queuedBeforeSync === 0) return;

      syncInFlightRef.current = true;
      const result = await processSyncQueue();
      const remaining = await getSyncQueueCount();

      setPendingSyncCount(remaining);

      if (result.synced > 0 || remaining !== queuedBeforeSync) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error syncing offline changes:', error);
      try {
        const remaining = await getSyncQueueCount();
        setPendingSyncCount(remaining);
      } catch {
        // ignore count refresh failure
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, [fetchData, user?.dairyId]);

  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isOnline) {
      syncPendingChanges();
    }
  }, [isOnline, syncPendingChanges]);

  useEffect(() => {
    if (!isOnline || pendingSyncCount === 0) return;

    const retryTimeout = window.setTimeout(() => {
      syncPendingChanges();
    }, 1200);

    const retryInterval = window.setInterval(() => {
      syncPendingChanges();
    }, 5000);

    return () => {
      window.clearTimeout(retryTimeout);
      window.clearInterval(retryInterval);
    };
  }, [isOnline, pendingSyncCount, syncPendingChanges]);

  // ==================== OFFLINE-FIRST MUTATIONS ====================

  const addSupplier = async (supplier: Omit<Supplier, 'id' | 'dairyId' | 'entries' | 'createdAt'>) => {
    if (!user?.dairyId) return;

    const tempId = crypto.randomUUID();
    const newSupplier: Supplier = {
      id: tempId,
      dairyId: user.dairyId,
      name: supplier.name,
      phone: supplier.phone,
      code: supplier.code,
      animalType: supplier.animalType,
      villageName: supplier.villageName,
      address: supplier.address,
      entries: [],
      createdAt: new Date().toISOString(),
      pendingBalance: 0,
      canSeeCalculations: true,
    };

    // Update local state immediately
    setSuppliers(prev => [...prev, newSupplier]);

    const dbData = {
      id: tempId,
      dairy_id: user.dairyId,
      name: supplier.name,
      phone: supplier.phone,
      animal_type: supplier.animalType,
      village_name: supplier.villageName || null,
      address: supplier.address || null,
      code: supplier.code || '',
    };

    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .insert(dbData as any)
          .select()
          .single();

        if (error) {
          console.error('Error adding supplier:', error);
          // Queue for later sync
          await addToSyncQueue({ type: 'insert', table: 'suppliers', data: dbData });
          setPendingSyncCount(prev => prev + 1);
        } else if (data) {
          // Update with real server data
          setSuppliers(prev => prev.map(s => s.id === tempId ? {
            ...s,
            id: data.id,
            createdAt: data.created_at,
          } : s));
        }
      } catch {
        await addToSyncQueue({ type: 'insert', table: 'suppliers', data: dbData });
        setPendingSyncCount(prev => prev + 1);
      }
    } else {
      await addToSyncQueue({ type: 'insert', table: 'suppliers', data: dbData });
      setPendingSyncCount(prev => prev + 1);
    }
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    if (!user?.dairyId) throw new Error('No dairy ID');

    // Update local state immediately
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.phone) updateData.phone = updates.phone;
    if (updates.code !== undefined) updateData.code = updates.code;
    if (updates.animalType) updateData.animal_type = updates.animalType;
    if (updates.villageName !== undefined) updateData.village_name = updates.villageName;
    if (updates.address !== undefined) updateData.address = updates.address;

    if (navigator.onLine) {
      const { error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', id)
        .eq('dairy_id', user.dairyId);

      if (error) {
        console.error('Error updating supplier:', error);
        await addToSyncQueue({
          type: 'update', table: 'suppliers', data: updateData,
          matchColumn: 'id', matchValue: id,
          matchColumn2: 'dairy_id', matchValue2: user.dairyId,
        });
        setPendingSyncCount(prev => prev + 1);
      }
    } else {
      await addToSyncQueue({
        type: 'update', table: 'suppliers', data: updateData,
        matchColumn: 'id', matchValue: id,
        matchColumn2: 'dairy_id', matchValue2: user.dairyId,
      });
      setPendingSyncCount(prev => prev + 1);
    }
  };

  const deleteSupplier = async (id: string) => {
    if (!user?.dairyId) throw new Error('No dairy ID');

    // Update local state immediately
    setSuppliers(prev => prev.filter(s => s.id !== id));

    if (navigator.onLine) {
      await supabase.from('milk_entries').delete().eq('supplier_id', id).eq('dairy_id', user.dairyId);
      const { error } = await supabase.from('suppliers').delete().eq('id', id).eq('dairy_id', user.dairyId);

      if (error) {
        console.error('Error deleting supplier:', error);
        await addToSyncQueue({
          type: 'delete', table: 'suppliers',
          matchColumn: 'id', matchValue: id,
          matchColumn2: 'dairy_id', matchValue2: user.dairyId,
          prerequisiteActions: [{
            id: '', timestamp: 0,
            type: 'delete', table: 'milk_entries',
            data: null,
            matchColumn: 'supplier_id', matchValue: id,
            matchColumn2: 'dairy_id', matchValue2: user.dairyId,
          }],
        });
        setPendingSyncCount(prev => prev + 1);
      }
    } else {
      await addToSyncQueue({
        type: 'delete', table: 'suppliers',
        matchColumn: 'id', matchValue: id,
        matchColumn2: 'dairy_id', matchValue2: user.dairyId,
        prerequisiteActions: [{
          id: '', timestamp: 0,
          type: 'delete', table: 'milk_entries',
          data: null,
          matchColumn: 'supplier_id', matchValue: id,
          matchColumn2: 'dairy_id', matchValue2: user.dairyId,
        }],
      });
      setPendingSyncCount(prev => prev + 1);
    }
  };

  const addMilkEntry = async (supplierId: string, entry: MilkEntry) => {
    if (!user?.dairyId) return;

    // Update local state immediately
    setSuppliers(prev => prev.map(supplier => {
      if (supplier.id === supplierId) {
        const existingEntryIndex = supplier.entries.findIndex(e => e.date === entry.date);
        if (existingEntryIndex >= 0) {
          const updatedEntries = [...supplier.entries];
          updatedEntries[existingEntryIndex] = { ...updatedEntries[existingEntryIndex], ...entry };
          return { ...supplier, entries: updatedEntries };
        } else {
          return { ...supplier, entries: [...supplier.entries, entry] };
        }
      }
      return supplier;
    }));

    const entries = [];

    if (entry.morningMilk !== null || entry.morningFat !== null || entry.morningPrice !== null) {
      entries.push({
        supplier_id: supplierId,
        dairy_id: user.dairyId,
        date: entry.date,
        time_of_day: 'morning',
        quantity: entry.morningMilk,
        fat: entry.morningFat,
        snf: entry.morningSNF,
        lr: entry.morningLR,
        price: entry.morningPrice,
      });
    }

    if (entry.eveningMilk !== null || entry.eveningFat !== null || entry.eveningPrice !== null) {
      entries.push({
        supplier_id: supplierId,
        dairy_id: user.dairyId,
        date: entry.date,
        time_of_day: 'evening',
        quantity: entry.eveningMilk,
        fat: entry.eveningFat,
        snf: entry.eveningSNF,
        lr: entry.eveningLR,
        price: entry.eveningPrice,
      });
    }

    if (navigator.onLine) {
      // Try online, queue on failure
      Promise.all(
        entries.map(entryData =>
          supabase.from('milk_entries').upsert(entryData, { onConflict: 'supplier_id,date,time_of_day' })
        )
      ).then(async results => {
        const hasError = results.some(r => r.error);
        if (hasError) {
          console.error('Error saving milk entries:', results.filter(r => r.error));
          // Queue failed entries
          for (const entryData of entries) {
            await addToSyncQueue({
              type: 'upsert', table: 'milk_entries',
              data: entryData, onConflict: 'supplier_id,date,time_of_day',
            });
          }
          setPendingSyncCount(prev => prev + entries.length);
        }
      }).catch(async () => {
        for (const entryData of entries) {
          await addToSyncQueue({
            type: 'upsert', table: 'milk_entries',
            data: entryData, onConflict: 'supplier_id,date,time_of_day',
          });
        }
        setPendingSyncCount(prev => prev + entries.length);
      });
    } else {
      // Queue all entries for sync
      for (const entryData of entries) {
        await addToSyncQueue({
          type: 'upsert', table: 'milk_entries',
          data: entryData, onConflict: 'supplier_id,date,time_of_day',
        });
      }
      setPendingSyncCount(prev => prev + entries.length);
    }
  };

  const updateMilkEntry = async (supplierId: string, date: string, entry: Partial<MilkEntry>) => {
    if (!user?.dairyId) return;

    // Update local state immediately
    setSuppliers(prev => prev.map(supplier => {
      if (supplier.id === supplierId) {
        const existingEntryIndex = supplier.entries.findIndex(e => e.date === date);
        if (existingEntryIndex >= 0) {
          const updatedEntries = [...supplier.entries];
          updatedEntries[existingEntryIndex] = { ...updatedEntries[existingEntryIndex], ...entry };
          return { ...supplier, entries: updatedEntries };
        }
      }
      return supplier;
    }));

    const upsertAndQueue = async (timeOfDay: string, data: any) => {
      if (navigator.onLine) {
        const { error } = await supabase
          .from('milk_entries')
          .upsert(data, { onConflict: 'supplier_id,date,time_of_day' });
        if (error) {
          console.error('Error updating milk entry:', error);
          await addToSyncQueue({ type: 'upsert', table: 'milk_entries', data, onConflict: 'supplier_id,date,time_of_day' });
          setPendingSyncCount(prev => prev + 1);
        }
      } else {
        await addToSyncQueue({ type: 'upsert', table: 'milk_entries', data, onConflict: 'supplier_id,date,time_of_day' });
        setPendingSyncCount(prev => prev + 1);
      }
    };

    if (entry.morningMilk !== undefined || entry.morningFat !== undefined) {
      await upsertAndQueue('morning', {
        supplier_id: supplierId, dairy_id: user.dairyId, date,
        time_of_day: 'morning',
        quantity: entry.morningMilk, fat: entry.morningFat,
        snf: entry.morningSNF, lr: entry.morningLR,
      });
    }

    if (entry.eveningMilk !== undefined || entry.eveningFat !== undefined) {
      await upsertAndQueue('evening', {
        supplier_id: supplierId, dairy_id: user.dairyId, date,
        time_of_day: 'evening',
        quantity: entry.eveningMilk, fat: entry.eveningFat,
        snf: entry.eveningSNF, lr: entry.eveningLR,
      });
    }
  };

  const updateRateSettings = async (settings: Partial<RateSettings>) => {
    const newSettings = { ...rateSettings, ...settings };
    setRateSettings(newSettings);

    if (!user?.dairyId) return;

    const dbData = {
      dairy_id: user.dairyId,
      rate_value: newSettings.fatRate,
      liter_rate: newSettings.literRate,
      show_calculations_to_suppliers: newSettings.showCalculationsToSuppliers,
      calculation_method: newSettings.calculationMethod,
    };

    if (navigator.onLine) {
      const { error } = await supabase
        .from('rate_settings')
        .upsert(dbData as any, { onConflict: 'dairy_id' });

      if (error) {
        console.error('Error updating rate settings:', error);
        await addToSyncQueue({ type: 'upsert', table: 'rate_settings', data: dbData, onConflict: 'dairy_id' });
        setPendingSyncCount(prev => prev + 1);
      }
    } else {
      await addToSyncQueue({ type: 'upsert', table: 'rate_settings', data: dbData, onConflict: 'dairy_id' });
      setPendingSyncCount(prev => prev + 1);
    }
  };

  const addAnnouncement = async (message: string) => {
    if (!user?.dairyId) return;

    const tempId = crypto.randomUUID();
    const newAnnouncement: Announcement = {
      id: tempId,
      dairyId: user.dairyId,
      message,
      createdAt: new Date().toISOString(),
    };

    // Update local state immediately
    setAnnouncements(prev => [newAnnouncement, ...prev]);

    const dbData = { id: tempId, dairy_id: user.dairyId, message };

    if (navigator.onLine) {
      const { error } = await supabase.from('announcements').insert(dbData);
      if (error) {
        console.error('Error adding announcement:', error);
        await addToSyncQueue({ type: 'insert', table: 'announcements', data: dbData });
        setPendingSyncCount(prev => prev + 1);
      }
    } else {
      await addToSyncQueue({ type: 'insert', table: 'announcements', data: dbData });
      setPendingSyncCount(prev => prev + 1);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    // Update local state immediately
    setAnnouncements(prev => prev.filter(a => a.id !== id));

    if (navigator.onLine) {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) {
        console.error('Error deleting announcement:', error);
        await addToSyncQueue({ type: 'delete', table: 'announcements', matchColumn: 'id', matchValue: id });
        setPendingSyncCount(prev => prev + 1);
      }
    } else {
      await addToSyncQueue({ type: 'delete', table: 'announcements', matchColumn: 'id', matchValue: id });
      setPendingSyncCount(prev => prev + 1);
    }
  };

  const updateDairy = async (name: string) => {
    if (!user?.dairyId) return false;

    if (navigator.onLine) {
      const { error } = await supabase.from('dairies').update({ name }).eq('id', user.dairyId);
      if (error) {
        console.error('Error updating dairy:', error);
        await addToSyncQueue({ type: 'update', table: 'dairies', data: { name }, matchColumn: 'id', matchValue: user.dairyId });
        setPendingSyncCount(prev => prev + 1);
        return true; // Optimistic
      }
    } else {
      await addToSyncQueue({ type: 'update', table: 'dairies', data: { name }, matchColumn: 'id', matchValue: user.dairyId });
      setPendingSyncCount(prev => prev + 1);
    }

    return true;
  };

  // ==================== READ-ONLY COMPUTED DATA ====================

  const getSupplierStats = (supplierId: string, days: number) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return { totalMilk: 0, totalFat: 0, avgFat: 0, totalAmount: 0, fatEntryCount: 0 };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const recentEntries = supplier.entries.filter(e => e.date >= cutoffStr);
    
    let totalMilk = 0;
    let totalFat = 0;
    let fatEntryCount = 0;

    recentEntries.forEach(entry => {
      if (entry.morningMilk) totalMilk += entry.morningMilk;
      if (entry.eveningMilk) totalMilk += entry.eveningMilk;
      if (entry.morningFat) { totalFat += entry.morningFat; fatEntryCount++; }
      if (entry.eveningFat) { totalFat += entry.eveningFat; fatEntryCount++; }
    });

    const avgFat = fatEntryCount > 0 ? totalFat / fatEntryCount : 0;
    const isBuyer = supplier.animalType === 'buyer';
    const totalAmount = isBuyer 
      ? totalMilk * (rateSettings.literRate || 50)
      : avgFat * totalMilk * rateSettings.fatRate;

    return { totalMilk, totalFat, avgFat, totalAmount, fatEntryCount };
  };

  const getTodayStats = () => {
    const today = new Date().toISOString().split('T')[0];
    
    let totalMilk = 0;
    let totalFat = 0;
    let morningMilk = 0;
    let eveningMilk = 0;
    let morningFatSum = 0;
    let eveningFatSum = 0;
    let morningFatCount = 0;
    let eveningFatCount = 0;
    let activeSuppliers = 0;

    suppliers.forEach(supplier => {
      const todayEntry = supplier.entries.find(e => e.date === today);
      if (todayEntry) {
        let hasData = false;
        if (todayEntry.morningMilk) { morningMilk += todayEntry.morningMilk; totalMilk += todayEntry.morningMilk; hasData = true; }
        if (todayEntry.eveningMilk) { eveningMilk += todayEntry.eveningMilk; totalMilk += todayEntry.eveningMilk; hasData = true; }
        if (todayEntry.morningFat) { morningFatSum += todayEntry.morningFat; morningFatCount++; totalFat += todayEntry.morningFat; }
        if (todayEntry.eveningFat) { eveningFatSum += todayEntry.eveningFat; eveningFatCount++; totalFat += todayEntry.eveningFat; }
        if (hasData) activeSuppliers++;
      }
    });

    const fatCount = morningFatCount + eveningFatCount;
    return {
      totalMilk, totalFat,
      avgFat: fatCount > 0 ? totalFat / fatCount : 0,
      morningMilk, eveningMilk,
      morningAvgFat: morningFatCount > 0 ? morningFatSum / morningFatCount : 0,
      eveningAvgFat: eveningFatCount > 0 ? eveningFatSum / eveningFatCount : 0,
      suppliers: activeSuppliers,
    };
  };

  const getSupplierByPhone = (phone: string) => suppliers.find(s => s.phone === phone);

  const enableNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      showNotification('Notifications Enabled', {
        body: 'You will now receive notifications for important events.',
      });
    }
    return granted;
  };

  const value: DairyContextType = {
    suppliers, addSupplier, updateSupplier, deleteSupplier,
    addMilkEntry, updateMilkEntry,
    rateSettings, updateRateSettings,
    getSupplierStats, getTodayStats, getSupplierByPhone,
    announcements, addAnnouncement, deleteAnnouncement,
    updateDairy,
    loading, isOnline, pendingSyncCount,
    refreshData: fetchData,
    enableNotifications,
  };

  return (
    <DairyContext.Provider value={value}>
      {children}
    </DairyContext.Provider>
  );
};

export const useDairy = () => {
  const context = useContext(DairyContext);
  if (context === undefined) {
    throw new Error('useDairy must be used within a DairyProvider');
  }
  return context;
};
