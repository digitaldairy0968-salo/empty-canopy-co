import React, { useState, useEffect } from 'react';
import { Globe, LogOut, Shield, CheckCircle, XCircle, Bell, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useDairy } from '@/contexts/DairyContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

type Language = 'hi' | 'gu' | 'en';

interface EditRequest {
  id: string;
  entry_id: string;
  changes: Record<string, any>;
  reason: string | null;
  status: string;
  created_at: string;
  entry_date?: string;
  entry_shift?: string;
}

interface PendingPayment {
  id: string;
  amount_added: number;
  amount_paid: number;
  notes: string | null;
  transaction_date: string;
  supplier_confirmed: boolean | null;
}

const SupplierSettings: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { logout, user } = useAuth();
  const { refreshData } = useDairy();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [editRequests, setEditRequests] = useState<EditRequest[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const languages: { code: Language; name: string; nativeName: string }[] = [
    { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
    { code: 'en', name: 'English', nativeName: 'English' },
  ];

  // Fetch edit requests and pending payments
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        // Fetch pending edit requests for this supplier
        const { data: requests } = await supabase
          .from('entry_edit_requests')
          .select('*, milk_entries!entry_edit_requests_entry_id_fkey(date, time_of_day)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (requests) {
          const mapped = (requests as any[]).map(r => ({
            ...r,
            entry_date: r.milk_entries?.date,
            entry_shift: r.milk_entries?.time_of_day,
          }));
          setEditRequests(mapped);
        }

        // Fetch payments needing confirmation
        const { data: payments } = await supabase
          .from('payment_history')
          .select('*')
          .is('supplier_confirmed', null)
          .order('transaction_date', { ascending: false });

        if (payments) {
          // Only show notifications for actual bhugtan (amount_paid > 0), not bakaya additions
          setPendingPayments((payments as any[]).filter(p => (p.amount_paid || 0) > 0));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleApproveEdit = async (requestId: string) => {
    try {
      // Just update status to 'approved' — the DB trigger (apply_approved_edit_request)
      // automatically applies the changes to milk_entries
      const { error } = await supabase
        .from('entry_edit_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (error) {
        console.error('Error approving edit:', error);
        toast({ title: t('error'), description: language === 'hi' ? 'एंट्री अपडेट नहीं हो पाई' : 'Failed to update entry', variant: 'destructive' });
        return;
      }

      setEditRequests(prev => prev.filter(r => r.id !== requestId));
      
      // Refresh dairy context so supplier dashboard/card shows updated data
      await refreshData();
      
      toast({
        title: language === 'hi' ? '✅ स्वीकृत' : '✅ Approved',
        description: language === 'hi' ? 'एंट्री सफलतापूर्वक अपडेट हो गई' : 'Entry updated successfully',
      });
    } catch (error) {
      console.error('Error approving edit:', error);
      toast({ title: t('error'), description: 'Failed to approve', variant: 'destructive' });
    }
  };

  const handleRejectEdit = async (requestId: string) => {
    try {
      await supabase
        .from('entry_edit_requests')
        .update({ status: 'rejected', responded_at: new Date().toISOString() })
        .eq('id', requestId);

      setEditRequests(prev => prev.filter(r => r.id !== requestId));
      toast({
        title: language === 'hi' ? 'अस्वीकृत' : 'Rejected',
        description: language === 'hi' ? 'एंट्री बदलाव अस्वीकार किया गया' : 'Entry change rejected',
      });
    } catch (error) {
      console.error('Error rejecting edit:', error);
    }
  };

  const handleConfirmPayment = async (paymentId: string, confirmed: boolean) => {
    try {
      const payment = pendingPayments.find(p => p.id === paymentId);
      
      await supabase
        .from('payment_history')
        .update({ 
          supplier_confirmed: confirmed, 
          confirmed_at: new Date().toISOString() 
        } as any)
        .eq('id', paymentId);

      // If confirmed (हां), NOW deduct the amount from supplier's pending_balance
      if (confirmed && payment && (payment.amount_paid || 0) > 0) {
        const { data: paymentData } = await supabase
          .from('payment_history')
          .select('supplier_id')
          .eq('id', paymentId)
          .single();
        
        if (paymentData) {
          const { data: supplierRecord } = await supabase
            .from('suppliers')
            .select('pending_balance')
            .eq('id', paymentData.supplier_id)
            .single();
          
          if (supplierRecord) {
            await supabase
              .from('suppliers')
              .update({ pending_balance: (supplierRecord.pending_balance || 0) - (payment.amount_paid || 0) })
              .eq('id', paymentData.supplier_id);
          }
        }
      }
      // If rejected (नहीं), do nothing - balance was never deducted

      setPendingPayments(prev => prev.filter(p => p.id !== paymentId));
      await refreshData();
      toast({
        title: confirmed 
          ? (language === 'hi' ? '✅ पुष्टि की गई' : '✅ Confirmed')
          : (language === 'hi' ? '❌ अस्वीकृत' : '❌ Denied'),
        description: confirmed
          ? (language === 'hi' ? 'भुगतान प्राप्ति की पुष्टि हो गई, राशि शेष से काटी गई' : 'Payment confirmed, amount deducted from balance')
          : (language === 'hi' ? 'भुगतान अस्वीकार किया, कोई राशि नहीं काटी गई' : 'Payment denied, no amount deducted'),
      });
    } catch (error) {
      console.error('Error confirming payment:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const formatChanges = (changes: Record<string, any>) => {
    const labels: Record<string, string> = {
      morningMilk: language === 'hi' ? 'सुबह दूध' : 'Morning Milk',
      morningFat: language === 'hi' ? 'सुबह FAT' : 'Morning FAT',
      morningSNF: language === 'hi' ? 'सुबह SNF' : 'Morning SNF',
      morningLR: language === 'hi' ? 'सुबह LR' : 'Morning LR',
      eveningMilk: language === 'hi' ? 'शाम दूध' : 'Evening Milk',
      eveningFat: language === 'hi' ? 'शाम FAT' : 'Evening FAT',
      eveningSNF: language === 'hi' ? 'शाम SNF' : 'Evening SNF',
      eveningLR: language === 'hi' ? 'शाम LR' : 'Evening LR',
    };
    return Object.entries(changes).map(([key, value]) => (
      <span key={key} className="inline-block bg-primary/10 px-2 py-0.5 rounded text-xs mr-1 mb-1">
        {labels[key] || key}: <strong>{value}</strong>
      </span>
    ));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        <h2 className="text-xl font-bold">{t('settings')}</h2>

        {/* Dairy Info */}
        {user?.dairyName && (
          <div className="dairy-card animate-fade-in">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🏭</span>
              <div>
                <p className="font-semibold">{user.dairyName}</p>
                <p className="text-sm text-muted-foreground">
                  कोड: {user.dairyCode}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Payment Confirmation Notifications */}
        {pendingPayments.length > 0 && (
          <div className="dairy-card animate-fade-in border-2 border-amber-300 dark:border-amber-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                <Banknote className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {language === 'hi' ? '💰 भुगतान पुष्टि' : '💰 Payment Confirmation'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'hi' ? 'क्या आपने पैसे प्राप्त किए?' : 'Did you receive the money?'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {pendingPayments.map(payment => (
                <div key={payment.id} className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                    <p className="font-bold text-lg text-amber-700 dark:text-amber-400">
                        ₹{(payment.amount_paid || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(payment.transaction_date), 'dd/MM/yyyy')}
                        {payment.notes && ` • ${payment.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleConfirmPayment(payment.id, true)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {language === 'hi' ? 'हां, मिल गए' : 'Yes, received'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleConfirmPayment(payment.id, false)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      {language === 'hi' ? 'नहीं मिले' : 'Not received'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit Requests */}
        {editRequests.length > 0 && (
          <div className="dairy-card animate-fade-in border-2 border-primary/30">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {language === 'hi' ? '📝 एंट्री बदलाव अनुरोध' : '📝 Entry Edit Requests'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {language === 'hi' ? 'मालिक आपकी एंट्री बदलना चाहते हैं' : 'Owner wants to change your entries'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {editRequests.map(request => (
                <div key={request.id} className="p-3 bg-muted/50 rounded-xl border">
                  <div className="mb-2">
                    {request.entry_date && (
                      <div className="flex items-center gap-2 mb-2 p-2 bg-primary/10 rounded-lg">
                        <span className="text-lg">{request.entry_shift === 'morning' ? '🌅' : '🌙'}</span>
                        <span className="font-semibold text-sm">
                          {format(new Date(request.entry_date + 'T00:00:00'), 'dd/MM/yyyy')} — {request.entry_shift === 'morning' ? (language === 'hi' ? 'सुबह' : 'Morning') : (language === 'hi' ? 'शाम' : 'Evening')}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mb-1">
                      {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                    {request.reason && (
                      <p className="text-sm mb-1">{request.reason}</p>
                    )}
                    <div className="flex flex-wrap">
                      {formatChanges(request.changes)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleApproveEdit(request.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      {language === 'hi' ? 'स्वीकार' : 'Approve'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleRejectEdit(request.id)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      {language === 'hi' ? 'अस्वीकार' : 'Reject'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Language Settings */}
        <div className="dairy-card animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">{t('language')}</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={cn(
                  'py-4 px-3 rounded-xl border-2 transition-all duration-200 text-center',
                  language === lang.code
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <p className="font-semibold text-lg">{lang.nativeName}</p>
                <p className="text-sm text-muted-foreground">{lang.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Logout */}
        <Button
          variant="destructive"
          className="w-full py-6 text-lg animate-fade-in"
          style={{ animationDelay: '100ms' }}
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-5 w-5" />
          {t('logout')}
        </Button>
      </main>

      <BottomNav />
    </div>
  );
};

export default SupplierSettings;
