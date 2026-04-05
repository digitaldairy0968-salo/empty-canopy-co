import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Printer, CalendarIcon, Calculator, ChevronDown, ChevronUp, Mic, MicOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy, MilkEntry as MilkEntryType } from '@/contexts/DairyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import MilkReceipt from '@/components/MilkReceipt';
import { supabase } from '@/integrations/supabase/client';
import ReportReceipt from '@/components/ReportReceipt';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useVoiceEntry, getVoiceSettings, VoiceField } from '@/hooks/useVoiceEntry';
import { useFatSnfRateSettings } from '@/hooks/useFatSnfRateSettings';
import { calculateFatSnfEntry } from '@/utils/fatSnfCalculation';
import { useOwnerSettings } from '@/hooks/useOwnerSettings';

const MilkEntry: React.FC = () => {
  const { t, language } = useLanguage();
  const { suppliers, addMilkEntry, rateSettings } = useDairy();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // FAT/SNF rate settings
  const { settings: fatSnfSettings } = useFatSnfRateSettings();
  const { settings: ownerSettings } = useOwnerSettings();

  // Check if entry_settings feature is enabled (advance feature)
  const [entrySettingsEnabled, setEntrySettingsEnabled] = useState(false);
  useEffect(() => {
    const checkFeature = async () => {
      if (!user?.dairyId) return;
      const { data } = await supabase
        .from('dairy_features')
        .select('is_enabled')
        .eq('dairy_id', user.dairyId)
        .eq('feature_key', 'entry_settings')
        .maybeSingle();
      setEntrySettingsEnabled(data?.is_enabled ?? false);
    };
    checkFeature();
  }, [user?.dairyId]);

  // Check if selected supplier is a buyer (uses rate per liter, no fat input)
  const isBuyer = (supplier: typeof suppliers[0] | undefined) => supplier?.animalType === 'buyer';

  // Auto-detect shift based on time (morning before 12 PM, evening after)
  const getAutoShift = (): 'morning' | 'evening' => {
    const hour = new Date().getHours();
    return hour < 12 ? 'morning' : 'evening';
  };

  // Entry form state
  const [supplierCode, setSupplierCode] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [shift, setShift] = useState<'morning' | 'evening'>(getAutoShift());
  const [milkQty, setMilkQty] = useState('');
  const [fatValue, setFatValue] = useState('');
  const [snfValue, setSnfValue] = useState('');
  const [lrValue, setLrValue] = useState('');
  const [buyerPrice, setBuyerPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Voice entry settings
  const [voiceSettings] = useState(getVoiceSettings);
  
  // Input refs for focus management
  const milkInputRef = useRef<HTMLInputElement>(null);
  const fatInputRef = useRef<HTMLInputElement>(null);
  const snfInputRef = useRef<HTMLInputElement>(null);
  const lrInputRef = useRef<HTMLInputElement>(null);

  // Voice value detected handler - only for milk
  const handleVoiceValueDetected = useCallback((field: VoiceField, value: number) => {
    setMilkQty(value.toString());
    
    // Repeat number after 0.5s delay if enabled
    if (localStorage.getItem('voiceRepeatEnabled') === 'true') {
      setTimeout(() => {
        try {
          speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(value.toString());
          utterance.lang = language === 'hi' ? 'hi-IN' : language === 'gu' ? 'gu-IN' : 'en-IN';
          utterance.rate = 1.1;
          utterance.volume = 0.8;
          speechSynthesis.speak(utterance);
        } catch (e) {}
      }, 500);
    }
  }, [language]);

  // Voice field change handler - focus the appropriate input
  const handleVoiceFieldChange = useCallback((field: VoiceField) => {
    switch (field) {
      case 'milk':
        milkInputRef.current?.focus();
        break;
      case 'fat':
        fatInputRef.current?.focus();
        break;
      case 'snf':
        snfInputRef.current?.focus();
        break;
      case 'lr':
        lrInputRef.current?.focus();
        break;
    }
  }, []);

  // Voice entry hook
  const voiceEntry = useVoiceEntry({
    settings: voiceSettings,
    onValueDetected: handleVoiceValueDetected,
    onFieldChange: handleVoiceFieldChange,
    language,
  });

  // Show receipt toggle - persisted in localStorage
  const [showReceiptEnabled, setShowReceiptEnabled] = useState(() => {
    const saved = localStorage.getItem('showReceiptEnabled');
    return saved !== null ? saved === 'true' : true;
  });

  // Custom rate for entry section
  const [customRate, setCustomRate] = useState<string>('');

  // Receipt dialog state
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [savedEntryData, setSavedEntryData] = useState<{
    date: string;
    timeOfDay: 'morning' | 'evening';
    quantity: number;
    fat: number | null;
    snf: number | null;
    lr: number | null;
    supplierId: string;
    supplierName: string;
  } | null>(null);

  // Report/Calculation section state
  const [showReportSection, setShowReportSection] = useState(false);
  const [reportSupplierCode, setReportSupplierCode] = useState('');
  const [reportSupplierId, setReportSupplierId] = useState<string>('');
  const [reportSearchType, setReportSearchType] = useState<'code' | 'name'>('code');
  const [reportShiftFilter, setReportShiftFilter] = useState<'both' | 'morning' | 'evening'>('both');
  
  // Report receipt toggle - persisted in localStorage
  const [reportReceiptEnabled, setReportReceiptEnabled] = useState(() => {
    const saved = localStorage.getItem('reportReceiptEnabled');
    return saved !== null ? saved === 'true' : false;
  });
  
  // Report receipt dialog state
  const [showReportReceiptDialog, setShowReportReceiptDialog] = useState(false);
  
  // Persist custom dates in localStorage
  const [reportStartDate, setReportStartDate] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem('reportStartDate');
    return saved ? new Date(saved) : undefined;
  });
  const [reportEndDate, setReportEndDate] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem('reportEndDate');
    return saved ? new Date(saved) : undefined;
  });
  const [reportCustomRate, setReportCustomRate] = useState<string>('');

  // Default rate from settings
  const defaultRate = rateSettings.fatRate;

  // Current rate for entry section (custom if set, otherwise default)
  const rate = customRate ? parseFloat(customRate) : defaultRate;

  // Current rate for report section (custom if set, otherwise default)
  const reportRate = reportCustomRate ? parseFloat(reportCustomRate) : defaultRate;

  // Save showReceiptEnabled to localStorage
  useEffect(() => {
    localStorage.setItem('showReceiptEnabled', showReceiptEnabled.toString());
  }, [showReceiptEnabled]);

  // Save reportReceiptEnabled to localStorage
  useEffect(() => {
    localStorage.setItem('reportReceiptEnabled', reportReceiptEnabled.toString());
  }, [reportReceiptEnabled]);

  // Initialize custom rate with default rate
  useEffect(() => {
    if (!customRate && defaultRate) {
      setCustomRate(defaultRate.toString());
    }
    if (!reportCustomRate && defaultRate) {
      setReportCustomRate(defaultRate.toString());
    }
  }, [defaultRate]);

  // Find supplier by code
  const selectedSupplier = useMemo(() => {
    if (selectedSupplierId) {
      return suppliers.find(s => s.id === selectedSupplierId);
    }
    if (supplierCode.length >= 1) {
      return suppliers.find(s => s.code === supplierCode);
    }
    return undefined;
  }, [suppliers, supplierCode, selectedSupplierId]);

  // Find supplier for report by code or name
  const reportSupplier = useMemo(() => {
    if (reportSupplierId) {
      return suppliers.find(s => s.id === reportSupplierId);
    }
    if (reportSupplierCode.length >= 1) {
      if (reportSearchType === 'code') {
        return suppliers.find(s => s.code === reportSupplierCode);
      } else {
        return suppliers.find(s => s.name.toLowerCase().includes(reportSupplierCode.toLowerCase()));
      }
    }
    return undefined;
  }, [suppliers, reportSupplierCode, reportSupplierId, reportSearchType]);

  // Filter suppliers for report dropdown based on search type
  const filteredReportSuppliers = useMemo(() => {
    if (!reportSupplierCode) return suppliers;
    if (reportSearchType === 'code') {
      return suppliers.filter(s => s.code?.includes(reportSupplierCode));
    } else {
      return suppliers.filter(s => s.name.toLowerCase().includes(reportSupplierCode.toLowerCase()));
    }
  }, [suppliers, reportSupplierCode, reportSearchType]);

  // Save dates to localStorage when they change
  useEffect(() => {
    if (reportStartDate) {
      localStorage.setItem('reportStartDate', reportStartDate.toISOString());
    }
  }, [reportStartDate]);

  useEffect(() => {
    if (reportEndDate) {
      localStorage.setItem('reportEndDate', reportEndDate.toISOString());
    }
  }, [reportEndDate]);

  // Filter suppliers for dropdown based on code input
  const filteredSuppliers = useMemo(() => {
    if (!supplierCode) return suppliers;
    return suppliers.filter(s => 
      s.code?.includes(supplierCode) || 
      s.name.toLowerCase().includes(supplierCode.toLowerCase())
    );
  }, [suppliers, supplierCode]);

  // Sort suppliers by code for navigation
  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      const codeA = parseInt(a.code) || 0;
      const codeB = parseInt(b.code) || 0;
      return codeA - codeB;
    });
  }, [suppliers]);

  // Get auto-fill quantity only if last 2 entries for the shift have same quantity
  const getAutoFillQuantity = (supplier: typeof suppliers[0] | undefined, currentShift: 'morning' | 'evening') => {
    if (!supplier || !supplier.entries || supplier.entries.length === 0) return '';
    
    // Sort entries by date descending to get the most recent
    const sortedEntries = [...supplier.entries].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    // Find the last 2 entries that have quantity for the current shift
    const shiftQuantities: number[] = [];
    for (const entry of sortedEntries) {
      if (shiftQuantities.length >= 2) break;
      
      if (currentShift === 'morning' && entry.morningMilk !== null && entry.morningMilk !== undefined && entry.morningMilk > 0) {
        shiftQuantities.push(entry.morningMilk);
      }
      if (currentShift === 'evening' && entry.eveningMilk !== null && entry.eveningMilk !== undefined && entry.eveningMilk > 0) {
        shiftQuantities.push(entry.eveningMilk);
      }
    }
    
    // Only auto-fill if we have exactly 2 entries with the same quantity
    if (shiftQuantities.length === 2 && shiftQuantities[0] === shiftQuantities[1]) {
      return shiftQuantities[0].toString();
    }
    
    return '';
  };

  // Auto-fill milk quantity when supplier or shift changes (only if predict milk enabled AND last 2 entries match)
  // Also prefill fat/snf/lr if enabled in owner settings
  useEffect(() => {
    if (selectedSupplier) {
      // Only auto-fill milk if predictMilkEnabled AND entry_settings feature is enabled
      if (entrySettingsEnabled && ownerSettings.predictMilkEnabled !== false) {
        const autoQty = getAutoFillQuantity(selectedSupplier, shift);
        setMilkQty(autoQty);
      } else {
        setMilkQty('');
      }
      
      // Prefill fat/snf/lr from owner settings if enabled AND entry_settings feature is enabled
      if (entrySettingsEnabled && ownerSettings.prefillEnabled) {
        if (ownerSettings.prefillFat !== null) setFatValue(ownerSettings.prefillFat.toString());
        if (ownerSettings.prefillSnf !== null) setSnfValue(ownerSettings.prefillSnf.toString());
        if (ownerSettings.prefillLr !== null) setLrValue(ownerSettings.prefillLr.toString());
      }
    }
  }, [selectedSupplier?.id, shift, entrySettingsEnabled]);

  const handleSupplierCodeChange = (value: string) => {
    setSupplierCode(value);
    setSelectedSupplierId('');
  };

  const handleSelectSupplier = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier?.code) {
      setSupplierCode(supplier.code);
    }
  };

  // Navigate to next/previous supplier in entry section
  const navigateEntrySupplier = (direction: 'up' | 'down') => {
    const currentCode = parseInt(supplierCode) || 0;
    const sortedCodes = sortedSuppliers.map(s => parseInt(s.code) || 0).filter(c => c > 0);
    
    if (sortedCodes.length === 0) return;
    
    let targetCode: number;
    if (direction === 'up') {
      // Find previous code (smaller than current)
      const prevCodes = sortedCodes.filter(c => c < currentCode);
      targetCode = prevCodes.length > 0 ? prevCodes[prevCodes.length - 1] : sortedCodes[sortedCodes.length - 1];
    } else {
      // Find next code (larger than current)
      const nextCodes = sortedCodes.filter(c => c > currentCode);
      targetCode = nextCodes.length > 0 ? nextCodes[0] : sortedCodes[0];
    }
    
    const targetSupplier = sortedSuppliers.find(s => parseInt(s.code) === targetCode);
    if (targetSupplier) {
      setSupplierCode(targetSupplier.code);
      setSelectedSupplierId(targetSupplier.id);
    }
  };

  // Auto-select next/prev supplier after save based on code direction
  const selectNextEntrySupplier = () => {
    const currentCode = parseInt(supplierCode) || 0;
    const sortedCodes = sortedSuppliers.map(s => parseInt(s.code) || 0).filter(c => c > 0);
    
    if (sortedCodes.length === 0) return;
    
    if (ownerSettings.codeDirection === 'reverse') {
      // Find previous code (smaller)
      const prevCodes = sortedCodes.filter(c => c < currentCode);
      const targetCode = prevCodes.length > 0 ? prevCodes[prevCodes.length - 1] : sortedCodes[sortedCodes.length - 1];
      const targetSupplier = sortedSuppliers.find(s => parseInt(s.code) === targetCode);
      if (targetSupplier) {
        setSupplierCode(targetSupplier.code);
        setSelectedSupplierId(targetSupplier.id);
      }
    } else {
      // Find next code (larger)
      const nextCodes = sortedCodes.filter(c => c > currentCode);
      const targetCode = nextCodes.length > 0 ? nextCodes[0] : sortedCodes[0];
      const targetSupplier = sortedSuppliers.find(s => parseInt(s.code) === targetCode);
      if (targetSupplier) {
        setSupplierCode(targetSupplier.code);
        setSelectedSupplierId(targetSupplier.id);
      }
    }
  };

  const handleReportSupplierCodeChange = (value: string) => {
    setReportSupplierCode(value);
    setReportSupplierId('');
  };

  const handleSelectReportSupplier = (supplierId: string) => {
    setReportSupplierId(supplierId);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier?.code) {
      setReportSupplierCode(supplier.code);
    }
  };

  // Navigate to next/previous supplier in report section
  const navigateReportSupplier = (direction: 'up' | 'down') => {
    const currentCode = parseInt(reportSupplierCode) || 0;
    const sortedCodes = sortedSuppliers.map(s => parseInt(s.code) || 0).filter(c => c > 0);
    
    if (sortedCodes.length === 0) return;
    
    let targetCode: number;
    if (direction === 'up') {
      const prevCodes = sortedCodes.filter(c => c < currentCode);
      targetCode = prevCodes.length > 0 ? prevCodes[prevCodes.length - 1] : sortedCodes[sortedCodes.length - 1];
    } else {
      const nextCodes = sortedCodes.filter(c => c > currentCode);
      targetCode = nextCodes.length > 0 ? nextCodes[0] : sortedCodes[0];
    }
    
    const targetSupplier = sortedSuppliers.find(s => parseInt(s.code) === targetCode);
    if (targetSupplier) {
      setReportSupplierCode(targetSupplier.code);
      setReportSupplierId(targetSupplier.id);
    }
  };

  // Handle "हो गया" in report section - show receipt if enabled and move to next supplier
  const handleReportDone = () => {
    // Show receipt if enabled and we have data
    if (reportReceiptEnabled && reportSupplier && reportStats) {
      setShowReportReceiptDialog(true);
    }
    
    const currentCode = parseInt(reportSupplierCode) || 0;
    const sortedCodes = sortedSuppliers.map(s => parseInt(s.code) || 0).filter(c => c > 0);
    
    if (sortedCodes.length === 0) return;
    
    const nextCodes = sortedCodes.filter(c => c > currentCode);
    const targetCode = nextCodes.length > 0 ? nextCodes[0] : sortedCodes[0];
    
    const targetSupplier = sortedSuppliers.find(s => parseInt(s.code) === targetCode);
    if (targetSupplier) {
      setReportSupplierCode(targetSupplier.code);
      setReportSupplierId(targetSupplier.id);
    }
  };

  const handleSaveEntry = async () => {
    if (!selectedSupplier) {
      toast({ title: t('error'), description: 'कृपया सप्लायर कोड दर्ज करें / Please enter supplier code', variant: 'destructive' });
      return;
    }

    // For buyers, either milk or price must be provided
    const isBuyerSupplier = isBuyer(selectedSupplier);
    if (isBuyerSupplier) {
      if ((!milkQty || parseFloat(milkQty) <= 0) && (!buyerPrice || parseFloat(buyerPrice) <= 0)) {
        toast({ title: t('error'), description: 'कृपया दूध की मात्रा या रकम दर्ज करें / Please enter milk quantity or price', variant: 'destructive' });
        return;
      }
    } else {
      if (!milkQty || parseFloat(milkQty) <= 0) {
        toast({ title: t('error'), description: 'कृपया दूध की मात्रा दर्ज करें / Please enter milk quantity', variant: 'destructive' });
        return;
      }
    }

    // Validation for FAT/SNF system
    if (fatSnfSettings.isEnabled && !isBuyer(selectedSupplier)) {
      if (!fatValue || parseFloat(fatValue) <= 0) {
        toast({ 
          title: t('error'), 
          description: language === 'hi' ? 'FAT/SNF सिस्टम में FAT जरूरी है' : 'FAT is required for FAT/SNF system', 
          variant: 'destructive' 
        });
        return;
      }
      if (!snfValue || parseFloat(snfValue) <= 0) {
        toast({ 
          title: t('error'), 
          description: language === 'hi' ? 'FAT/SNF सिस्टम में SNF जरूरी है' : 'SNF is required for FAT/SNF system', 
          variant: 'destructive' 
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const existingEntry = selectedSupplier.entries.find(e => e.date === today);

      // Check if this is an EDIT (existing entry has data for this shift)
      const isEdit = existingEntry && (
        (shift === 'morning' && existingEntry.morningMilk !== null && existingEntry.morningMilk > 0) ||
        (shift === 'evening' && existingEntry.eveningMilk !== null && existingEntry.eveningMilk > 0)
      );

      // If editing, check if supplier is an app user (has user_id)
      if (isEdit && user?.dairyId) {
        const { data: supplierRecord } = await supabase
          .from('suppliers')
          .select('user_id')
          .eq('id', selectedSupplier.id)
          .single();

        if (supplierRecord?.user_id) {
          // Supplier uses the app - need to create edit request instead
          const changes: Record<string, any> = {};
          if (shift === 'morning') {
            changes.morningMilk = parseFloat(milkQty);
            if (fatValue) changes.morningFat = parseFloat(fatValue);
            if (snfValue) changes.morningSNF = parseFloat(snfValue);
            if (lrValue) changes.morningLR = parseFloat(lrValue);
          } else {
            changes.eveningMilk = parseFloat(milkQty);
            if (fatValue) changes.eveningFat = parseFloat(fatValue);
            if (snfValue) changes.eveningSNF = parseFloat(snfValue);
            if (lrValue) changes.eveningLR = parseFloat(lrValue);
          }

          // Find the milk_entry id for this date+shift
          const { data: entryRecord } = await supabase
            .from('milk_entries')
            .select('id')
            .eq('supplier_id', selectedSupplier.id)
            .eq('date', today)
            .eq('time_of_day', shift)
            .single();

          if (entryRecord) {
            await supabase.from('entry_edit_requests').insert({
              dairy_id: user.dairyId,
              supplier_id: selectedSupplier.id,
              entry_id: entryRecord.id,
              requested_by: (await supabase.auth.getUser()).data.user?.id || '',
              changes: changes,
              reason: language === 'hi' ? 'मालिक द्वारा एंट्री अपडेट' : 'Entry update by owner',
            });

            toast({
              title: language === 'hi' ? 'अनुरोध भेजा गया' : 'Request Sent',
              description: language === 'hi'
                ? `${selectedSupplier.name} को एंट्री बदलने की अनुमति भेजी गई। वो अपनी Settings से approve करेंगे।`
                : `Edit permission request sent to ${selectedSupplier.name}. They will approve from Settings.`,
            });

            setMilkQty('');
            setFatValue('');
            setSnfValue('');
            setLrValue('');
            setBuyerPrice('');
            selectNextEntrySupplier();
            setIsLoading(false);
            return;
          }
        }
      }

      const parsedMilk = milkQty ? parseFloat(milkQty) : null;
      const parsedPrice = buyerPrice ? parseFloat(buyerPrice) : null;
      
      const newEntry: MilkEntryType = {
        date: today,
        morningMilk: shift === 'morning' ? (parsedMilk && parsedMilk > 0 ? parsedMilk : null) : (existingEntry?.morningMilk ?? null),
        morningFat: shift === 'morning' ? (fatValue ? parseFloat(fatValue) : null) : (existingEntry?.morningFat ?? null),
        morningSNF: shift === 'morning' ? (snfValue ? parseFloat(snfValue) : null) : (existingEntry?.morningSNF ?? null),
        morningLR: shift === 'morning' ? (lrValue ? parseFloat(lrValue) : null) : (existingEntry?.morningLR ?? null),
        morningPrice: shift === 'morning' ? (parsedPrice && parsedPrice > 0 ? parsedPrice : null) : (existingEntry?.morningPrice ?? null),
        eveningMilk: shift === 'evening' ? (parsedMilk && parsedMilk > 0 ? parsedMilk : null) : (existingEntry?.eveningMilk ?? null),
        eveningFat: shift === 'evening' ? (fatValue ? parseFloat(fatValue) : null) : (existingEntry?.eveningFat ?? null),
        eveningSNF: shift === 'evening' ? (snfValue ? parseFloat(snfValue) : null) : (existingEntry?.eveningSNF ?? null),
        eveningLR: shift === 'evening' ? (lrValue ? parseFloat(lrValue) : null) : (existingEntry?.eveningLR ?? null),
        eveningPrice: shift === 'evening' ? (parsedPrice && parsedPrice > 0 ? parsedPrice : null) : (existingEntry?.eveningPrice ?? null),
      };

      await addMilkEntry(selectedSupplier.id, newEntry);

      // Store saved entry data for receipt
      setSavedEntryData({
        date: today,
        timeOfDay: shift,
        quantity: parseFloat(milkQty),
        fat: fatValue ? parseFloat(fatValue) : null,
        snf: snfValue ? parseFloat(snfValue) : null,
        lr: lrValue ? parseFloat(lrValue) : null,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
      });

      toast({ title: t('success'), description: 'एंट्री सेव हो गई! / Entry saved!' });

      // Reset form for next entry but keep supplier for auto-increment
      const prevCode = supplierCode;
      setMilkQty('');
      setFatValue('');
      setSnfValue('');
      setLrValue('');
      setBuyerPrice('');

      // Show receipt dialog: always show if printer connected (for auto-print) or if receipt enabled
      if (ownerSettings.bluetoothPrinterConnected && ownerSettings.autoPrintEnabled) {
        // Auto print mode: show dialog which will auto-trigger print
        setShowReceiptDialog(true);
      } else if (showReceiptEnabled) {
        setShowReceiptDialog(true);
      }
      
      // Auto-select next supplier
      selectNextEntrySupplier();
    } catch (error) {
      toast({ title: t('error'), description: 'एंट्री सेव करने में विफल / Failed to save entry', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate report stats
  const reportStats = useMemo(() => {
    if (!reportSupplier || !reportStartDate || !reportEndDate) return null;

    const startStr = format(reportStartDate, 'yyyy-MM-dd');
    const endStr = format(reportEndDate, 'yyyy-MM-dd');

    const filteredEntries = reportSupplier.entries.filter(e => {
      return e.date >= startStr && e.date <= endStr;
    });

    let totalMilk = 0;
    let totalFat = 0;
    let totalSnf = 0;
    let fatCount = 0;
    let snfCount = 0;
    let totalAmount = 0;

    // Check if we should use FAT/SNF system for this supplier
    const useFatSnfSystem = fatSnfSettings.isEnabled && reportSupplier.animalType !== 'buyer';

    filteredEntries.forEach(entry => {
      // Morning
      if ((reportShiftFilter === 'both' || reportShiftFilter === 'morning') &&
          entry.morningMilk !== null && entry.morningMilk !== undefined && entry.morningMilk > 0) {
        const milk = entry.morningMilk;
        totalMilk += milk;
        
        const fat = entry.morningFat ?? 0;
        const snf = entry.morningSNF ?? 0;
        
        if (fat > 0) {
          totalFat += fat;
          fatCount++;
        }
        if (snf > 0) {
          totalSnf += snf;
          snfCount++;
        }
        
        if (reportSupplier.animalType === 'buyer') {
          const price = entry.morningPrice;
          if (price !== null && price !== undefined && price > 0) {
            totalAmount += price;
          } else {
            totalAmount += milk * (rateSettings.literRate || 50);
          }
        } else if (useFatSnfSystem && fat > 0 && snf > 0) {
          const result = calculateFatSnfEntry(fatSnfSettings, milk, fat, snf);
          totalAmount += result.totalAmount;
        } else if (fat > 0) {
          totalAmount += fat * milk * reportRate;
        }
      } else if ((reportShiftFilter === 'both' || reportShiftFilter === 'morning') && 
                 reportSupplier.animalType === 'buyer' &&
                 entry.morningPrice !== null && entry.morningPrice !== undefined && entry.morningPrice > 0) {
        totalAmount += entry.morningPrice;
      }
      
      // Evening
      if ((reportShiftFilter === 'both' || reportShiftFilter === 'evening') &&
          entry.eveningMilk !== null && entry.eveningMilk !== undefined && entry.eveningMilk > 0) {
        const milk = entry.eveningMilk;
        totalMilk += milk;
        
        const fat = entry.eveningFat ?? 0;
        const snf = entry.eveningSNF ?? 0;
        
        if (fat > 0) {
          totalFat += fat;
          fatCount++;
        }
        if (snf > 0) {
          totalSnf += snf;
          snfCount++;
        }
        
        if (reportSupplier.animalType === 'buyer') {
          const price = entry.eveningPrice;
          if (price !== null && price !== undefined && price > 0) {
            totalAmount += price;
          } else {
            totalAmount += milk * (rateSettings.literRate || 50);
          }
        } else if (useFatSnfSystem && fat > 0 && snf > 0) {
          const result = calculateFatSnfEntry(fatSnfSettings, milk, fat, snf);
          totalAmount += result.totalAmount;
        } else if (fat > 0) {
          totalAmount += fat * milk * reportRate;
        }
      } else if ((reportShiftFilter === 'both' || reportShiftFilter === 'evening') && 
                 reportSupplier.animalType === 'buyer' &&
                 entry.eveningPrice !== null && entry.eveningPrice !== undefined && entry.eveningPrice > 0) {
        totalAmount += entry.eveningPrice;
      }
    });

    const avgFat = fatCount > 0 ? totalFat / fatCount : 0;
    const avgSnf = snfCount > 0 ? totalSnf / snfCount : 0;
    
    // Fallback calculation if no per-entry calculation was done
    if (totalAmount === 0 && avgFat > 0 && totalMilk > 0) {
      totalAmount = avgFat * totalMilk * reportRate;
    }

    return { totalMilk, avgFat, avgSnf, totalAmount, entryCount: filteredEntries.length, useFatSnfSystem };
  }, [reportSupplier, reportStartDate, reportEndDate, reportRate, reportShiftFilter, fatSnfSettings]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-20">
      <Header />

      <main className="px-3 py-3 max-w-lg mx-auto space-y-3">
        {/* Entry Card - Compact for mobile */}
        <div className="bg-card rounded-2xl shadow-lg border border-border/50 p-3 animate-fade-in">
          {/* FAT/SNF System Indicator */}
          {fatSnfSettings.isEnabled && (
            <div className="mb-2 flex items-center gap-2 px-2 py-1 bg-primary/10 rounded-lg">
              <span className="text-xs font-medium text-primary">
                {language === 'hi' ? '📊 FAT/SNF रेट सिस्टम सक्रिय' : '📊 FAT/SNF Rate System Active'}
              </span>
            </div>
          )}
          
          {/* Header with shift toggle - Compact */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-foreground">
              {language === 'hi' ? 'दूध एंट्री' : language === 'gu' ? 'દૂધ એન્ટ્રી' : 'Milk Entry'}
            </h2>
            <div className="flex bg-muted rounded-full p-0.5">
              <button
                onClick={() => setShift('morning')}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                  shift === 'morning' 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                🌅 {t('morning')}
              </button>
              <button
                onClick={() => setShift('evening')}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                  shift === 'evening' 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                🌙 {t('evening')}
              </button>
            </div>
          </div>

          {/* Supplier Code Input with Navigation - Compact */}
          <div className="mb-2 space-y-2">
            {/* Select by Code Row */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => navigateEntrySupplier('up')}
                className="h-10 w-10 rounded-lg shrink-0"
              >
                <ChevronUp className="h-5 w-5" />
              </Button>
              <div className="relative flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder={language === 'hi' ? 'कोड...' : language === 'gu' ? 'કોડ...' : 'Code...'}
                  value={supplierCode}
                  onChange={e => handleSupplierCodeChange(e.target.value)}
                  className="h-10 text-lg font-bold text-center rounded-xl border-2 border-border/60 focus:border-primary bg-background pl-8"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => navigateEntrySupplier('down')}
                className="h-10 w-10 rounded-lg shrink-0"
              >
                <ChevronDown className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Select by Name Row */}
            <Select value={selectedSupplierId} onValueChange={handleSelectSupplier}>
              <SelectTrigger className="w-full h-10 rounded-lg border border-border/60 bg-background text-sm">
                <SelectValue placeholder={language === 'hi' ? '👤 नाम से चुनें' : language === 'gu' ? '👤 નામથી પસંદ કરો' : '👤 Select by Name'} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {filteredSuppliers.map(s => (
                  <SelectItem key={s.id} value={s.id} className="py-2">
                    <span className="font-semibold">{s.code}</span>
                    <span className="text-muted-foreground ml-1 text-xs">• {s.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Supplier Badge - Compact */}
          {selectedSupplier && (
            <div className="mb-3 p-2 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20 animate-scale-in">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm">👤</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-foreground">{selectedSupplier.name}</p>
                  <p className="text-xs text-muted-foreground">
                    #{selectedSupplier.code} {selectedSupplier.villageName && `• ${selectedSupplier.villageName}`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Voice Entry Microphone Toggle - Only for milk */}
          {voiceEntry.isSupported && (
            <div className="mb-3 p-3 bg-muted/30 rounded-xl border border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {voiceEntry.isListening ? (
                    <Mic className="h-5 w-5 text-destructive animate-pulse" />
                  ) : (
                    <MicOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {language === 'hi' ? '🎤 दूध मात्रा बोलें' : '🎤 Speak Milk Qty'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {language === 'hi' 
                        ? 'सिर्फ नंबर बोलें: 6.4, 5.3, 10' 
                        : 'Speak numbers only: 6.4, 5.3, 10'}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={voiceEntry.isListening}
                  onCheckedChange={(checked) => {
                    speechSynthesis.cancel();
                    if (checked) {
                      voiceEntry.startListening();
                    } else {
                      voiceEntry.stopListening();
                    }
                  }}
                  className="transition-all duration-300 data-[state=checked]:bg-destructive"
                />
              </div>
              
              {/* Number ko vapis bole toggle */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
                <span className="text-xs text-muted-foreground">
                  {language === 'hi' ? '🔊 नंबर को वापिस बोले' : '🔊 Repeat number'}
                </span>
                <Switch
                  checked={localStorage.getItem('voiceRepeatEnabled') === 'true'}
                  onCheckedChange={(checked) => {
                    speechSynthesis.cancel();
                    localStorage.setItem('voiceRepeatEnabled', checked.toString());
                  }}
                  className="scale-75 transition-all duration-300"
                />
              </div>
              
              {/* Transcript display */}
              {voiceEntry.isListening && voiceEntry.transcript && (
                <div className="mt-2 p-2 bg-background/80 rounded-lg text-center text-sm text-foreground border border-border/30">
                  🎙️ "{voiceEntry.transcript}"
                </div>
              )}
              
              {/* Error display */}
              {voiceEntry.error && (
                <div className="mt-2 p-2 bg-destructive/10 rounded-lg text-center text-xs text-destructive">
                  {voiceEntry.error}
                </div>
              )}
            </div>
          )}

          {/* Milk & Fat on top, SNF & LR on bottom - 2x2 grid (buyers get milk + price) */}
          <div className={cn("grid gap-2 mb-3", isBuyer(selectedSupplier) ? "grid-cols-2" : "grid-cols-2")}>
            <div className="space-y-0.5">
              <label className={cn(
                "text-[10px] font-medium block text-center",
                voiceEntry.isListening && voiceEntry.currentField === 'milk' ? "text-accent font-bold" : "text-muted-foreground"
              )}>
                {t('quantity')} * {voiceEntry.isListening && voiceEntry.currentField === 'milk' && '🎤'}
              </label>
              <Input
                ref={milkInputRef}
                type="number"
                inputMode="decimal"
                placeholder="0.0"
                value={milkQty}
                onChange={e => setMilkQty(e.target.value)}
                className={cn(
                  "h-11 text-lg font-bold text-center rounded-lg border-2 bg-background",
                  voiceEntry.isListening && voiceEntry.currentField === 'milk' 
                    ? "border-accent ring-2 ring-accent/30" 
                    : "border-primary/30 focus:border-primary"
                )}
              />
            </div>
            {isBuyer(selectedSupplier) && (
              <div className="space-y-0.5">
                <label className="text-[10px] font-medium block text-center text-muted-foreground">
                  {language === 'hi' ? 'रकम (₹)' : 'Price (₹)'}
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={buyerPrice}
                  onChange={e => setBuyerPrice(e.target.value)}
                  className="h-11 text-lg font-bold text-center rounded-lg border-2 border-primary/30 focus:border-primary bg-background"
                />
              </div>
            )}
            {!isBuyer(selectedSupplier) && (
              <>
                <div className="space-y-0.5">
                  <label className={cn(
                    "text-[10px] font-medium block text-center",
                    voiceEntry.isListening && voiceEntry.currentField === 'fat' ? "text-accent font-bold" : "text-muted-foreground"
                  )}>
                    {t('fat')} {voiceEntry.isListening && voiceEntry.currentField === 'fat' && '🎤'}
                  </label>
                  <Input
                    ref={fatInputRef}
                    type="number"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={fatValue}
                    onChange={e => setFatValue(e.target.value)}
                    className={cn(
                      "h-11 text-lg font-bold text-center rounded-lg border-2",
                      voiceEntry.isListening && voiceEntry.currentField === 'fat' 
                        ? "border-accent ring-2 ring-accent/30" 
                        : ""
                    )}
                  />
                </div>
                <div className="space-y-0.5">
                  <label className={cn(
                    "text-[10px] font-medium block text-center",
                    voiceEntry.isListening && voiceEntry.currentField === 'snf' ? "text-accent font-bold" : "text-muted-foreground"
                  )}>
                    {t('snf')} {voiceEntry.isListening && voiceEntry.currentField === 'snf' && '🎤'}
                  </label>
                  <Input
                    ref={snfInputRef}
                    type="number"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={snfValue}
                    onChange={e => setSnfValue(e.target.value)}
                    className={cn(
                      "h-11 text-lg font-bold text-center rounded-lg border-2",
                      voiceEntry.isListening && voiceEntry.currentField === 'snf' 
                        ? "border-accent ring-2 ring-accent/30" 
                        : ""
                    )}
                  />
                </div>
                <div className="space-y-0.5">
                  <label className={cn(
                    "text-[10px] font-medium block text-center",
                    voiceEntry.isListening && voiceEntry.currentField === 'lr' ? "text-accent font-bold" : "text-muted-foreground"
                  )}>
                    {t('lr')} {voiceEntry.isListening && voiceEntry.currentField === 'lr' && '🎤'}
                  </label>
                  <Input
                    ref={lrInputRef}
                    type="number"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={lrValue}
                    onChange={e => setLrValue(e.target.value)}
                    className={cn(
                      "h-11 text-lg font-bold text-center rounded-lg border-2",
                      voiceEntry.isListening && voiceEntry.currentField === 'lr' 
                        ? "border-accent ring-2 ring-accent/30" 
                        : ""
                    )}
                  />
                </div>
              </>
            )}
          </div>

          {/* Amount Preview - Compact inline (different calculation for buyers) */}
          {(milkQty || buyerPrice) && (isBuyer(selectedSupplier) || fatValue) && (() => {
            const milk = parseFloat(milkQty) || 0;
            const fat = parseFloat(fatValue) || 0;
            const snf = parseFloat(snfValue) || 0;
            const priceEntered = parseFloat(buyerPrice) || 0;
            
            // Use FAT/SNF system if enabled and SNF value is provided
            const useFatSnfSystem = fatSnfSettings.isEnabled && !isBuyer(selectedSupplier) && snf > 0;
            
            let calculatedAmount = 0;
            let ratePerLiter = 0;
            let warning: string | undefined;
            
            if (isBuyer(selectedSupplier)) {
              // If price is entered directly, use that; otherwise calculate from liter rate
              if (priceEntered > 0) {
                calculatedAmount = priceEntered;
              } else if (milk > 0) {
                calculatedAmount = milk * (rateSettings.literRate || 50);
              }
            } else if (useFatSnfSystem) {
              const result = calculateFatSnfEntry(fatSnfSettings, milk, fat, snf);
              calculatedAmount = result.totalAmount;
              ratePerLiter = result.ratePerLiter;
              warning = result.warning;
            } else {
              calculatedAmount = fat * milk * rate;
            }
            
            return (
              <div className="mb-3 p-2 bg-gradient-to-r from-secondary to-secondary/60 rounded-xl animate-fade-in">
                {warning && (
                  <div className="flex items-center gap-1 text-destructive text-xs mb-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{warning}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  {isBuyer(selectedSupplier) ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {priceEntered > 0 
                          ? (language === 'hi' ? 'सीधी रकम' : 'Direct price')
                          : `${milkQty}L × ₹${rateSettings.literRate || 50}/L`
                        }
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        ₹{calculatedAmount.toFixed(0)}
                      </p>
                    </>
                  ) : useFatSnfSystem ? (
                    <>
                      <div className="text-xs text-muted-foreground">
                        <span>FAT/SNF: </span>
                        <span className="font-medium">{milkQty}L × ₹{ratePerLiter.toFixed(2)}/L</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        ₹{calculatedAmount.toFixed(0)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {fatValue} × {milkQty}L × ₹{rate}
                      </p>
                      <p className="text-2xl font-bold text-foreground">
                        ₹{calculatedAmount.toFixed(0)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Save Button */}
          <Button
            onClick={handleSaveEntry}
            disabled={isLoading || !selectedSupplier || (!milkQty && !buyerPrice)}
            className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg transition-all duration-200 active:scale-[0.98] mb-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              language === 'hi' ? '✓ एंट्री सेव करें' : 
              language === 'gu' ? '✓ એન્ટ્રી સાચવો' : 
              '✓ Save Entry'
            )}
          </Button>

          {/* Rate */}
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-1 flex-1">
              <span className="text-xs text-muted-foreground">₹/फैट:</span>
              <Input
                type="number"
                inputMode="decimal"
                value={customRate}
                onChange={e => setCustomRate(e.target.value)}
                className="w-14 h-7 text-sm font-semibold text-center rounded-md border"
                placeholder={defaultRate.toString()}
              />
            </div>
          </div>
        </div>

      </main>

      <BottomNav />

      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              {t('printReceipt')}
            </DialogTitle>
          </DialogHeader>
          {savedEntryData && (
            <MilkReceipt
              data={{
                date: savedEntryData.date,
                supplierName: savedEntryData.supplierName,
                supplierId: savedEntryData.supplierId,
                supplierCode: suppliers.find(s => s.id === savedEntryData.supplierId)?.code,
                villageName: suppliers.find(s => s.id === savedEntryData.supplierId)?.villageName,
                animalType: suppliers.find(s => s.id === savedEntryData.supplierId)?.animalType,
                timeOfDay: savedEntryData.timeOfDay,
                quantity: savedEntryData.quantity,
                fat: savedEntryData.fat,
                snf: savedEntryData.snf,
                lr: savedEntryData.lr,
                rate: rate,
                dairyName: user?.dairyName,
              }}
              onClose={() => setShowReceiptDialog(false)}
              autoPrint={ownerSettings.bluetoothPrinterConnected && ownerSettings.autoPrintEnabled}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MilkEntry;