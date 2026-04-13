import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, History, Wallet, ArrowDownCircle, ArrowUpCircle, Save, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy } from '@/contexts/DairyContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentHistoryEntry {
  id: string;
  transaction_date: string;
  amount_added: number;
  amount_paid: number;
  balance_after: number;
  notes: string | null;
  created_at: string;
}

const toNumber = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const CustomerHistory: React.FC = () => {
  const { language } = useLanguage();
  const { suppliers, refreshData } = useDairy();
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchCode, setSearchCode] = useState('');
  const [searchType, setSearchType] = useState<'code' | 'name'>('code');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [initialPendingAmount, setInitialPendingAmount] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [history, setHistory] = useState<PaymentHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasInitialBalance, setHasInitialBalance] = useState(false);

  // Find selected supplier
  const selectedSupplier = useMemo(() => {
    if (selectedSupplierId) {
      return suppliers.find(s => s.id === selectedSupplierId);
    }
    if (searchCode.length >= 1) {
      if (searchType === 'code') {
        return suppliers.find(s => s.code === searchCode);
      } else {
        return suppliers.find(s => s.name.toLowerCase().includes(searchCode.toLowerCase()));
      }
    }
    return undefined;
  }, [suppliers, searchCode, selectedSupplierId, searchType]);

  // Filter suppliers for dropdown
  const filteredSuppliers = useMemo(() => {
    if (!searchCode) return suppliers;
    if (searchType === 'code') {
      return suppliers.filter(s => s.code?.includes(searchCode));
    } else {
      return suppliers.filter(s => s.name.toLowerCase().includes(searchCode.toLowerCase()));
    }
  }, [suppliers, searchCode, searchType]);

  // Latest balance from history is the most reliable source of truth.
  // (Supplier list can be stale because it's cached and may not refresh immediately.)
  // Always use the actual pending_balance from suppliers table (source of truth)
  // This ensures owner and supplier always see the same amount.
  const [livePendingBalance, setLivePendingBalance] = useState<number | null>(null);

  // Fetch live pending balance directly from DB whenever supplier changes or data refreshes
  useEffect(() => {
    const fetchLiveBalance = async () => {
      if (!selectedSupplier) {
        setLivePendingBalance(null);
        return;
      }
      const { data } = await supabase
        .from('suppliers')
        .select('pending_balance')
        .eq('id', selectedSupplier.id)
        .single();
      if (data) {
        setLivePendingBalance(toNumber(data.pending_balance));
      }
    };
    fetchLiveBalance();
  }, [selectedSupplier?.id, history.length]);

  const totalPendingBalance = useMemo(() => {
    if (!selectedSupplier) return 0;
    if (livePendingBalance !== null) return livePendingBalance;
    // Fallback to cached context data
    const supplierData = suppliers.find(s => s.id === selectedSupplier.id) ?? selectedSupplier;
    const raw =
      (supplierData as any)?.pendingBalance ??
      (supplierData as any)?.pending_balance ??
      0;
    return toNumber(raw);
  }, [livePendingBalance, selectedSupplier, suppliers]);

  // Calculate remaining after paid amount input
  const remainingAfterPayment = useMemo(() => {
    const paid = parseFloat(paidAmount) || 0;
    return totalPendingBalance - paid;
  }, [totalPendingBalance, paidAmount]);

  // Fetch payment history when supplier is selected
  useEffect(() => {
    if (selectedSupplier) {
      // Reset state immediately so previous customer's values don't flash.
      setHistory([]);
      setHasInitialBalance(false);
      fetchPaymentHistory(selectedSupplier.id);
      setInitialPendingAmount('');
      setPaidAmount('');
    } else {
      setHistory([]);
      setHasInitialBalance(false);
      setInitialPendingAmount('');
    }
  }, [selectedSupplier?.id]);

  // Update hasInitialBalance when history loads
  useEffect(() => {
    // "Initial" means: already started tracking this customer (balance may be negative too)
    setHasInitialBalance(history.length > 0 || totalPendingBalance !== 0);
  }, [history.length, totalPendingBalance]);

  const fetchPaymentHistory = async (supplierId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'हिस्ट्री लोड नहीं हो पाई' : 'Failed to load history',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSupplier = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier?.code) {
      setSearchCode(supplier.code);
    }
  };

  const handleSearchCodeChange = (value: string) => {
    setSearchCode(value);
    setSelectedSupplierId('');
  };

  // Set initial pending balance (one-time)
  const handleSetInitialBalance = async () => {
    if (!selectedSupplier || !user?.dairyId) return;

    const initial = parseFloat(initialPendingAmount) || 0;
    if (initial <= 0) {
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'बकाया राशि दर्ज करें' : 'Enter pending amount',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Update supplier's pending balance
      const { error: supplierError } = await supabase
        .from('suppliers')
        .update({ pending_balance: initial })
        .eq('id', selectedSupplier.id);

      if (supplierError) throw supplierError;

      // Add initial balance entry to history
      const { error: historyError } = await supabase
        .from('payment_history')
        .insert({
          dairy_id: user.dairyId,
          supplier_id: selectedSupplier.id,
          amount_added: initial,
          amount_paid: 0,
          balance_after: initial,
          notes: language === 'hi' ? 'प्रारंभिक बकाया' : 'Initial balance',
        });

      if (historyError) throw historyError;

      setHasInitialBalance(true);
      setInitialPendingAmount('');
      await fetchPaymentHistory(selectedSupplier.id);
      await refreshData();

      toast({
        title: language === 'hi' ? 'सफल' : 'Success',
        description: language === 'hi' ? 'बकाया राशि सेट हुई' : 'Pending amount set',
      });
    } catch (error) {
      console.error('Error setting initial balance:', error);
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'सेव नहीं हो पाया' : 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Add payment to history - payment record is inserted with supplier_confirmed = null
  // It will only appear in supplier's history once they confirm
  const handleAddToHistory = async () => {
    if (!selectedSupplier || !user?.dairyId) return;

    const paid = parseFloat(paidAmount) || 0;
    if (paid <= 0) {
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'भुगतान राशि दर्ज करें' : 'Enter paid amount',
        variant: 'destructive',
      });
      return;
    }

    // Check if supplier is an app user - if yes, need confirmation first
    const { data: supplierRecord } = await supabase
      .from('suppliers')
      .select('user_id')
      .eq('id', selectedSupplier.id)
      .single();

    const supplierIsAppUser = !!supplierRecord?.user_id;

    setIsSaving(true);
    try {
      // For app users: don't subtract yet, balance stays same until confirmed
      // For non-app users: subtract immediately
      const newBalance = supplierIsAppUser ? totalPendingBalance : totalPendingBalance - paid;

      // Insert payment history record
      // If supplier is app user: supplier_confirmed = null (needs confirmation)
      // If not app user: supplier_confirmed = true (auto-confirmed, no one to ask)
      const { error: historyError } = await supabase
        .from('payment_history')
        .insert({
          dairy_id: user.dairyId,
          supplier_id: selectedSupplier.id,
          amount_added: 0,
          amount_paid: paid,
          balance_after: newBalance,
          notes: language === 'hi' ? 'भुगतान किया' : 'Payment made',
          supplier_confirmed: supplierIsAppUser ? null : true,
          confirmed_at: supplierIsAppUser ? null : new Date().toISOString(),
        });

      if (historyError) throw historyError;

      // Only update supplier's pending balance immediately if NOT an app user
      // For app users, balance will be updated when they confirm the payment
      if (!supplierIsAppUser) {
        const { error: supplierError } = await supabase
          .from('suppliers')
          .update({ pending_balance: newBalance })
          .eq('id', selectedSupplier.id);

        if (supplierError) throw supplierError;
      }

      setPaidAmount('');
      await fetchPaymentHistory(selectedSupplier.id);
      await refreshData();

      toast({
        title: language === 'hi' ? 'सफल' : 'Success',
        description: supplierIsAppUser 
          ? (language === 'hi' ? 'भुगतान की पुष्टि के लिए ग्राहक को भेजा गया' : 'Sent to customer for payment confirmation')
          : (language === 'hi' ? 'हिस्ट्री में जोड़ा गया' : 'Added to history'),
      });
    } catch (error) {
      console.error('Error adding to history:', error);
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'सेव नहीं हो पाया' : 'Failed to save',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const labels = {
    title: language === 'hi' ? 'ग्राहक हिस्ट्री' : language === 'gu' ? 'ગ્રાહક હિસ્ટ્રી' : 'Customer History',
    searchByCode: language === 'hi' ? 'कोड' : language === 'gu' ? 'કોડ' : 'Code',
    searchByName: language === 'hi' ? 'नाम' : language === 'gu' ? 'નામ' : 'Name',
    selectFromList: language === 'hi' ? 'सूची से चुनें' : language === 'gu' ? 'યાદીમાંથી પસંદ કરો' : 'Select from list',
    bakayaRashi: language === 'hi' ? 'बकाया राशि (एक बार)' : language === 'gu' ? 'બાકી રકમ (એકવાર)' : 'Pending Amount (One-time)',
    paidAmount: language === 'hi' ? 'भुगतान राशि' : language === 'gu' ? 'ચુકવણી રકમ' : 'Paid Amount',
    addToHistory: language === 'hi' ? 'हिस्ट्री में जोड़ें' : language === 'gu' ? 'હિસ્ટ્રીમાં ઉમેરો' : 'Add to History',
    setInitialBalance: language === 'hi' ? 'सेट करें' : language === 'gu' ? 'સેટ કરો' : 'Set',
    transactionHistory: language === 'hi' ? 'लेन-देन हिस्ट्री' : language === 'gu' ? 'વ્યવહાર હિસ્ટ્રી' : 'Transaction History',
    date: language === 'hi' ? 'तारीख' : language === 'gu' ? 'તારીખ' : 'Date',
    added: language === 'hi' ? 'जोड़ा' : language === 'gu' ? 'ઉમેર્યું' : 'Added',
    paid: language === 'hi' ? 'भुगतान' : language === 'gu' ? 'ચુકવણી' : 'Paid',
    balance: language === 'hi' ? 'शेष' : language === 'gu' ? 'બાકી' : 'Balance',
    noHistory: language === 'hi' ? 'कोई हिस्ट्री नहीं' : language === 'gu' ? 'કોઈ હિસ્ટ્રી નથી' : 'No history',
    selectCustomer: language === 'hi' ? 'ग्राहक चुनें' : language === 'gu' ? 'ગ્રાહક પસંદ કરો' : 'Select a customer',
    totalPending: language === 'hi' ? 'कुल बकाया' : language === 'gu' ? 'કુલ બાકી' : 'Total Pending',
    remainingBalance: language === 'hi' ? 'बची हुई राशि' : language === 'gu' ? 'બાકી રકમ' : 'Remaining Balance',
    enterInitialFirst: language === 'hi' ? 'पहले बकाया राशि दर्ज करें' : language === 'gu' ? 'પહેલા બાકી રકમ દાખલ કરો' : 'Enter initial pending first',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-24">
      <Header />

      <main className="px-3 py-4 max-w-lg mx-auto">
        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <History className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{labels.title}</h1>
        </div>

        {/* Search Card */}
        <div className="bg-card rounded-2xl shadow-lg border border-border/50 p-4 mb-4 animate-fade-in">
          {/* Search Type Toggle */}
          <div className="flex bg-muted rounded-full p-0.5 mb-3">
            <button
              onClick={() => setSearchType('code')}
              className={cn(
                "flex-1 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200",
                searchType === 'code'
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {labels.searchByCode}
            </button>
            <button
              onClick={() => setSearchType('name')}
              className={cn(
                "flex-1 px-3 py-2 rounded-full text-sm font-medium transition-all duration-200",
                searchType === 'name'
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {labels.searchByName}
            </button>
          </div>

          {/* Search Input */}
          <div className="relative mb-3">
            <Input
              type="text"
              inputMode={searchType === 'code' ? 'numeric' : 'text'}
              placeholder={searchType === 'code' ? '1234' : labels.searchByName}
              value={searchCode}
              onChange={e => handleSearchCodeChange(e.target.value)}
              className="h-12 text-lg font-semibold text-center rounded-xl border-2 border-border/60 focus:border-primary bg-background pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          </div>

          {/* Dropdown List */}
          <Select value={selectedSupplierId} onValueChange={handleSelectSupplier}>
            <SelectTrigger className="w-full h-11 rounded-xl text-sm">
              <SelectValue placeholder={labels.selectFromList} />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {filteredSuppliers.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="font-semibold">{s.code}</span>
                  <span className="text-muted-foreground ml-2">• {s.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Selected Customer Display */}
          {selectedSupplier && (
            <div className="mt-3 py-2 px-3 bg-primary/10 rounded-xl text-center">
              <p className="font-semibold text-primary">#{selectedSupplier.code} - {selectedSupplier.name}</p>
            </div>
          )}
        </div>

        {/* Customer History Section */}
        {selectedSupplier ? (
          <div className="space-y-4 animate-fade-in">
            {/* Initial Pending Amount (One-time) - Show only if no balance set */}
            {!hasInitialBalance && (
              <div className="bg-card rounded-2xl shadow-lg border border-amber-200 dark:border-amber-800 p-4 bg-amber-50/50 dark:bg-amber-900/20">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">{labels.bakayaRashi}</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={initialPendingAmount}
                      onChange={e => setInitialPendingAmount(e.target.value)}
                      className="h-12 text-lg font-semibold pl-8 rounded-xl"
                      placeholder="0"
                    />
                  </div>
                  <Button
                    onClick={handleSetInitialBalance}
                    disabled={isSaving || !initialPendingAmount}
                    className="h-12 px-6 rounded-xl bg-amber-600 hover:bg-amber-700"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {labels.setInitialBalance}
                  </Button>
                </div>
              </div>
            )}

            {/* Main Balance Dashboard - Shows real-time calculation */}
            {hasInitialBalance && (
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl shadow-lg border border-primary/20 p-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">{labels.totalPending}</p>
                  <p className="text-3xl font-bold text-primary">₹{remainingAfterPayment.toFixed(0)}</p>
                  {parseFloat(paidAmount) > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      (₹{totalPendingBalance.toFixed(0)} - ₹{parseFloat(paidAmount).toFixed(0)})
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Payment Input Section */}
            {hasInitialBalance && (
              <div className="bg-card rounded-2xl shadow-lg border border-border/50 p-4">
                {/* Paid Amount Input */}
                <div className="mb-4">
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">{labels.paidAmount}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={paidAmount}
                      onChange={e => setPaidAmount(e.target.value)}
                      className="h-12 text-lg font-semibold pl-8 rounded-xl"
                      placeholder="0"
                    />
                  </div>
                </div>


                {/* Print Receipt Button */}
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selectedSupplier) return;
                    const bhugtanFields = JSON.parse(localStorage.getItem('bhugtanReceiptFields') || '{}');
                    const paid = parseFloat(paidAmount) || 0;
                    let rows = '';
                    if (bhugtanFields.showCode !== false) rows += `<div class="row"><span>कोड:</span><span>#${selectedSupplier.code}</span></div>`;
                    if (bhugtanFields.showName !== false) rows += `<div class="row"><span>नाम:</span><span><b>${selectedSupplier.name}</b></span></div>`;
                    if (bhugtanFields.showDates !== false) rows += `<div class="row"><span>तारीख:</span><span>${new Date().toLocaleDateString('en-IN')}</span></div>`;
                    if (bhugtanFields.showAmount !== false) rows += `<div class="total">कुल बकाया: ₹${totalPendingBalance.toFixed(0)}</div>`;
                    if (paid > 0 && bhugtanFields.showRakam !== false) {
                      rows += `<div class="row"><span>भुगतान:</span><span>₹${paid.toFixed(0)}</span></div>`;
                      rows += `<div class="total">शेष: ₹${remainingAfterPayment.toFixed(0)}</div>`;
                    }
                    const printContent = `<html><head><title>Receipt</title><style>body{font-family:sans-serif;padding:20px;max-width:300px;margin:0 auto}h2{text-align:center;margin-bottom:4px}p{margin:4px 0;font-size:14px}.total{font-size:20px;font-weight:bold;text-align:center;margin-top:12px;padding:8px;border-top:2px dashed #000}.row{display:flex;justify-content:space-between;padding:2px 0}</style></head><body><h2>भुगतान रसीद</h2><hr/>${rows}<hr/><p style="text-align:center;font-size:11px;color:#666">Dairy Manager</p></body></html>`;
                    const win = window.open('', '_blank', 'width=350,height=500');
                    if (win) { win.document.write(printContent); win.document.close(); win.print(); }
                  }}
                  className="w-full h-10 rounded-xl gap-2 mb-2"
                >
                  <Printer className="h-4 w-4" />
                  {language === 'hi' ? 'रसीद प्रिंट करें' : 'Print Receipt'}
                </Button>

                {/* Add to History Button */}
                <Button
                  onClick={handleAddToHistory}
                  disabled={isSaving || !paidAmount || parseFloat(paidAmount) <= 0}
                  className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {labels.addToHistory}
                </Button>
              </div>
            )}

            {/* Transaction History Card */}
            <div className="bg-card rounded-2xl shadow-lg border border-border/50 p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <History className="h-4 w-4" />
                {labels.transactionHistory}
              </h3>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {hasInitialBalance ? labels.noHistory : labels.enterInitialFirst}
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {history.map((entry) => {
                    const isPaidEntry = (entry.amount_paid || 0) > 0;
                    const isPending = isPaidEntry && (entry as any).supplier_confirmed === null;
                    const isRejected = isPaidEntry && (entry as any).supplier_confirmed === false;
                    
                    return (
                    <div
                      key={entry.id}
                      className={cn(
                        "p-3 bg-muted/50 rounded-xl border border-border/30",
                        isPending && "border-amber-300 bg-amber-50/50 dark:bg-amber-900/10",
                        isRejected && "border-red-300 bg-red-50/50 dark:bg-red-900/10 opacity-60"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(entry.transaction_date), 'dd/MM/yyyy')}
                          {isPending && <span className="ml-1 text-amber-600 font-medium">⏳ {language === 'hi' ? 'पुष्टि बाकी' : 'Pending'}</span>}
                          {isRejected && <span className="ml-1 text-red-600 font-medium">❌ {language === 'hi' ? 'अस्वीकृत' : 'Rejected'}</span>}
                        </span>
                        <span className={cn(
                          "text-sm font-bold",
                          entry.balance_after >= 0 ? "text-amber-600" : "text-green-600"
                        )}>
                          ₹{entry.balance_after.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        {entry.amount_added > 0 && (
                          <div className="flex items-center gap-1 text-red-500">
                            <ArrowUpCircle className="h-4 w-4" />
                            <span>+₹{entry.amount_added.toFixed(0)}</span>
                          </div>
                        )}
                        {entry.amount_paid > 0 && (
                          <div className="flex items-center gap-1 text-green-500">
                            <ArrowDownCircle className="h-4 w-4" />
                            <span>-₹{entry.amount_paid.toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{labels.selectCustomer}</p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default CustomerHistory;
