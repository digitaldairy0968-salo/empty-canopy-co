import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { showNotification, requestNotificationPermission } from '@/utils/notifications';

export interface MilkEntry {
  date: string;
  morningMilk: number | null;
  morningFat: number | null;
  morningSNF: number | null;
  morningLR: number | null;
  eveningMilk: number | null;
  eveningFat: number | null;
  eveningSNF: number | null;
  eveningLR: number | null;
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
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (user?.dairyId) {
        fetchData();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user?.dairyId]);

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

      // Fetch ALL milk entries using pagination to bypass 1000-row limit
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
              morningMilk: null,
              morningFat: null,
              morningSNF: null,
              morningLR: null,
              eveningMilk: null,
              eveningFat: null,
              eveningSNF: null,
              eveningLR: null,
            };
          }
          if (e.time_of_day === 'morning') {
            entriesByDate[date].morningMilk = e.quantity;
            entriesByDate[date].morningFat = e.fat;
            entriesByDate[date].morningSNF = e.snf;
            entriesByDate[date].morningLR = e.lr;
          } else {
            entriesByDate[date].eveningMilk = e.quantity;
            entriesByDate[date].eveningFat = e.fat;
            entriesByDate[date].eveningSNF = e.snf;
            entriesByDate[date].eveningLR = e.lr;
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

      setSuppliers(mappedSuppliers);
      localStorage.setItem(CACHE_KEY_SUPPLIERS, JSON.stringify(mappedSuppliers));

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
  }, [user?.dairyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addSupplier = async (supplier: Omit<Supplier, 'id' | 'dairyId' | 'entries' | 'createdAt'>) => {
    if (!user?.dairyId) return;

    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        dairy_id: user.dairyId,
        name: supplier.name,
        phone: supplier.phone,
        animal_type: supplier.animalType,
        village_name: supplier.villageName,
        address: supplier.address,
        code: supplier.code || '',
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Error adding supplier:', error);
      throw error;
    }

    await fetchData();
  };

  const updateSupplier = async (id: string, updates: Partial<Supplier>) => {
    if (!user?.dairyId) {
      throw new Error('No dairy ID');
    }

    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.phone) updateData.phone = updates.phone;
    if (updates.code !== undefined) updateData.code = updates.code;
    if (updates.animalType) updateData.animal_type = updates.animalType;
    if (updates.villageName !== undefined) updateData.village_name = updates.villageName;
    if (updates.address !== undefined) updateData.address = updates.address;

    const { error } = await supabase
      .from('suppliers')
      .update(updateData)
      .eq('id', id)
      .eq('dairy_id', user.dairyId);

    if (error) {
      console.error('Error updating supplier:', error);
      throw error;
    }

    await fetchData();
  };

  const deleteSupplier = async (id: string) => {
    if (!user?.dairyId) {
      throw new Error('No dairy ID');
    }

    const { error: entriesError } = await supabase
      .from('milk_entries')
      .delete()
      .eq('supplier_id', id)
      .eq('dairy_id', user.dairyId);

    if (entriesError) {
      console.error('Error deleting milk entries:', entriesError);
    }

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)
      .eq('dairy_id', user.dairyId);

    if (error) {
      console.error('Error deleting supplier:', error);
      throw error;
    }

    await fetchData();
  };

  const addMilkEntry = async (supplierId: string, entry: MilkEntry) => {
    if (!user?.dairyId) return;

    setSuppliers(prev => prev.map(supplier => {
      if (supplier.id === supplierId) {
        const existingEntryIndex = supplier.entries.findIndex(e => e.date === entry.date);
        if (existingEntryIndex >= 0) {
          const updatedEntries = [...supplier.entries];
          updatedEntries[existingEntryIndex] = {
            ...updatedEntries[existingEntryIndex],
            ...entry
          };
          return { ...supplier, entries: updatedEntries };
        } else {
          return { ...supplier, entries: [...supplier.entries, entry] };
        }
      }
      return supplier;
    }));

    const entries = [];

    if (entry.morningMilk !== null || entry.morningFat !== null) {
      entries.push({
        supplier_id: supplierId,
        dairy_id: user.dairyId,
        date: entry.date,
        time_of_day: 'morning',
        quantity: entry.morningMilk,
        fat: entry.morningFat,
        snf: entry.morningSNF,
        lr: entry.morningLR,
      });
    }

    if (entry.eveningMilk !== null || entry.eveningFat !== null) {
      entries.push({
        supplier_id: supplierId,
        dairy_id: user.dairyId,
        date: entry.date,
        time_of_day: 'evening',
        quantity: entry.eveningMilk,
        fat: entry.eveningFat,
        snf: entry.eveningSNF,
        lr: entry.eveningLR,
      });
    }

    Promise.all(
      entries.map(entryData =>
        supabase
          .from('milk_entries')
          .upsert(entryData, { onConflict: 'supplier_id,date,time_of_day' })
      )
    ).then(results => {
      const hasError = results.some(r => r.error);
      if (hasError) {
        console.error('Error saving milk entries:', results.filter(r => r.error));
        fetchData();
      }
    }).catch(error => {
      console.error('Error adding milk entries:', error);
      fetchData();
    });
  };

  const updateMilkEntry = async (supplierId: string, date: string, entry: Partial<MilkEntry>) => {
    if (!user?.dairyId) return;

    if (entry.morningMilk !== undefined || entry.morningFat !== undefined) {
      const { error } = await supabase
        .from('milk_entries')
        .upsert({
          supplier_id: supplierId,
          dairy_id: user.dairyId,
          date,
          time_of_day: 'morning',
          quantity: entry.morningMilk,
          fat: entry.morningFat,
          snf: entry.morningSNF,
          lr: entry.morningLR,
        }, {
          onConflict: 'supplier_id,date,time_of_day',
        });

      if (error) {
        console.error('Error updating milk entry:', error);
        throw error;
      }
    }

    if (entry.eveningMilk !== undefined || entry.eveningFat !== undefined) {
      const { error } = await supabase
        .from('milk_entries')
        .upsert({
          supplier_id: supplierId,
          dairy_id: user.dairyId,
          date,
          time_of_day: 'evening',
          quantity: entry.eveningMilk,
          fat: entry.eveningFat,
          snf: entry.eveningSNF,
          lr: entry.eveningLR,
        }, {
          onConflict: 'supplier_id,date,time_of_day',
        });

      if (error) {
        console.error('Error updating milk entry:', error);
        throw error;
      }
    }

    await fetchData();
  };

  const updateRateSettings = async (settings: Partial<RateSettings>) => {
    const newSettings = { ...rateSettings, ...settings };
    setRateSettings(newSettings);

    if (user?.dairyId) {
      const { error } = await supabase
        .from('rate_settings')
        .upsert({
          dairy_id: user.dairyId,
          rate_value: newSettings.fatRate,
          liter_rate: newSettings.literRate,
          show_calculations_to_suppliers: newSettings.showCalculationsToSuppliers,
          calculation_method: newSettings.calculationMethod,
        } as any, {
          onConflict: 'dairy_id',
        });

      if (error) {
        console.error('Error updating rate settings:', error);
      }
    }
  };

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
    
    // For buyers, use liter rate
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
        if (todayEntry.morningMilk) {
          morningMilk += todayEntry.morningMilk;
          totalMilk += todayEntry.morningMilk;
          hasData = true;
        }
        if (todayEntry.eveningMilk) {
          eveningMilk += todayEntry.eveningMilk;
          totalMilk += todayEntry.eveningMilk;
          hasData = true;
        }
        if (todayEntry.morningFat) {
          morningFatSum += todayEntry.morningFat;
          morningFatCount++;
          totalFat += todayEntry.morningFat;
        }
        if (todayEntry.eveningFat) {
          eveningFatSum += todayEntry.eveningFat;
          eveningFatCount++;
          totalFat += todayEntry.eveningFat;
        }
        if (hasData) activeSuppliers++;
      }
    });

    const fatCount = morningFatCount + eveningFatCount;
    const avgFat = fatCount > 0 ? totalFat / fatCount : 0;
    const morningAvgFat = morningFatCount > 0 ? morningFatSum / morningFatCount : 0;
    const eveningAvgFat = eveningFatCount > 0 ? eveningFatSum / eveningFatCount : 0;

    return {
      totalMilk,
      totalFat,
      avgFat,
      morningMilk,
      eveningMilk,
      morningAvgFat,
      eveningAvgFat,
      suppliers: activeSuppliers,
    };
  };

  const getSupplierByPhone = (phone: string) => {
    return suppliers.find(s => s.phone === phone);
  };

  const addAnnouncement = async (message: string) => {
    if (!user?.dairyId) return;

    const { error } = await supabase
      .from('announcements')
      .insert({
        dairy_id: user.dairyId,
        message,
      });

    if (error) {
      console.error('Error adding announcement:', error);
      throw error;
    }

    await fetchData();
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting announcement:', error);
      throw error;
    }

    await fetchData();
  };

  const updateDairy = async (name: string) => {
    if (!user?.dairyId) return false;

    const { error } = await supabase
      .from('dairies')
      .update({ name })
      .eq('id', user.dairyId);

    if (error) {
      console.error('Error updating dairy:', error);
      return false;
    }

    return true;
  };

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
    suppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addMilkEntry,
    updateMilkEntry,
    rateSettings,
    updateRateSettings,
    getSupplierStats,
    getTodayStats,
    getSupplierByPhone,
    announcements,
    addAnnouncement,
    deleteAnnouncement,
    updateDairy,
    loading,
    isOnline,
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
