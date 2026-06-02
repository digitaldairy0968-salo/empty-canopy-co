import React, { useState, useEffect } from 'react';
import { Globe, DollarSign, LogOut, Palette, Percent, Building2, Eye, EyeOff, Edit3, Users, Check, Grid3X3, ChevronRight, ChevronDown, Calculator, Printer, Bluetooth, FileText, Clock, Receipt, CreditCard, QrCode, MessageCircle, Phone, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDairy } from '@/contexts/DairyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useFatSnfRateSettings } from '@/hooks/useFatSnfRateSettings';
import { useOwnerSettings } from '@/hooks/useOwnerSettings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type Language = 'hi' | 'gu' | 'en';

// Subscription info component - cache-first
const SubscriptionInfo: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const [daysLeft, setDaysLeft] = useState<number | null>(() => {
    const cached = localStorage.getItem('cached_days_left');
    return cached ? parseInt(cached) : null;
  });
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchSub = async () => {
      if (!user?.dairyId) return;
      const { data } = await supabase
        .from('subscriptions')
        .select('expires_at')
        .eq('dairy_id', user.dairyId)
        .eq('status', 'active')
        .maybeSingle();
      if (data?.expires_at) {
        const diff = Math.ceil((new Date(data.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const d = Math.max(0, diff);
        setDaysLeft(d);
        localStorage.setItem('cached_days_left', d.toString());
      }
    };
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('subscription_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      setSettings(data);
    };
    const fetchPlans = async () => {
      const { data } = await supabase
        .from('payment_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      setPlans(data || []);
    };
    fetchSub();
    fetchSettings();
    fetchPlans();
  }, [user?.dairyId]);

  const copyUPI = async () => {
    if (settings?.upi_id) {
      try {
        await navigator.clipboard.writeText(settings.upi_id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = settings.upi_id;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const openWhatsApp = () => {
    if (settings?.admin_phone) {
      const message = language === 'hi'
        ? `नमस्ते, मैंने भुगतान किया है। कृपया मेरी सब्सक्रिप्शन बढ़ाएं।`
        : `Hello, I have made payment. Please extend my subscription.`;
      window.open(`https://wa.me/${settings.admin_phone}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  if (daysLeft === null) return null;

  return (
    <>
      <button
        onClick={() => navigate('/subscription-renewal')}
        className="w-full dairy-card animate-fade-in text-left hover:shadow-lg transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="icon-badge-sm bg-accent/10">
            <Clock className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">
              {language === 'hi' ? 'सब्सक्रिप्शन' : 'Subscription'}
            </p>
            <p className={cn("text-sm font-bold", daysLeft <= 7 ? "text-destructive" : "text-primary")}>
              {daysLeft} {language === 'hi' ? 'दिन बचे हैं' : 'days remaining'}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </button>

      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="rounded-2xl max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              {language === 'hi' ? 'सब्सक्रिप्शन बढ़ाएं' : 'Extend Subscription'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center p-4 bg-primary/10 rounded-xl">
              <p className={cn("text-3xl font-bold", daysLeft <= 7 ? "text-destructive" : "text-primary")}>
                {daysLeft} {language === 'hi' ? 'दिन' : 'days'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'hi' ? 'बचे हैं' : 'remaining'}
              </p>
            </div>

            {/* Payment Plans */}
             {plans.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">
                  {language === 'hi' ? '💳 प्लान चुनें' : '💳 Choose a Plan'}
                </p>
                {plans.map((plan: any) => (
                  <div key={plan.id} className="flex items-center justify-between p-3 border-2 border-border rounded-xl">
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
                      {plan.description && <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>}
                    </div>
                    <p className="text-lg font-bold text-primary">₹{plan.price}</p>
                  </div>
                ))}
              </div>
            )}

            {settings?.qr_code_url && (
              <div className="text-center">
                <p className="text-sm font-semibold mb-2 flex items-center justify-center gap-2">
                  <QrCode className="h-4 w-4" />
                  {language === 'hi' ? 'QR कोड स्कैन करें' : 'Scan QR Code'}
                </p>
                <img src={settings.qr_code_url} alt="QR" className="w-48 h-48 mx-auto border rounded-lg" />
              </div>
            )}

            {settings?.upi_id && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                <span className="text-sm font-medium flex-1 truncate">{settings.upi_id}</span>
                <Button variant="outline" size="icon" onClick={copyUPI} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}

            {settings?.admin_phone && (
              <Button variant="outline" onClick={openWhatsApp} className="w-full gap-2">
                <MessageCircle className="h-4 w-4" />
                <Phone className="h-4 w-4" />
                {language === 'hi' ? 'WhatsApp पर स्क्रीनशॉट भेजें' : 'Send screenshot on WhatsApp'}
              </Button>
            )}

            <p className="text-xs text-muted-foreground text-center">
              {language === 'hi'
                ? 'एडमिन को एडवांस पेमेंट करें और स्क्रीनशॉट भेजें, एडमिन आपकी एक्सपायरी बढ़ा देगा'
                : 'Make advance payment to admin and send screenshot, admin will extend your subscription'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Receipt Customization Component
const ReceiptCustomization: React.FC<{ language: string }> = ({ language }) => {
  const [entryReceiptFields, setEntryReceiptFields] = useState(() => {
    const saved = localStorage.getItem('entryReceiptFields');
    return saved ? JSON.parse(saved) : {
      showDate: true, showTime: true, showCode: true, showName: true,
      showMilkType: true, showQuantity: true, showFat: true, showSnf: true,
      showLr: true, showRate: true, showAmount: true, showPaymentMode: true,
    };
  });

  const [bhugtanReceiptFields, setBhugtanReceiptFields] = useState(() => {
    const saved = localStorage.getItem('bhugtanReceiptFields');
    return saved ? JSON.parse(saved) : {
      showCode: true, showName: true, showDates: true,
      showTotalMilk: true, showTotalFat: true, showAvgFat: true,
      showRate: true, showAmount: true, showRakam: true, showEntryTable: true,
      showMorning: true, showEvening: true,
    };
  });

  const updateEntryField = (field: string, value: boolean) => {
    const updated = { ...entryReceiptFields, [field]: value };
    setEntryReceiptFields(updated);
    localStorage.setItem('entryReceiptFields', JSON.stringify(updated));
  };

  const updateBhugtanField = (field: string, value: boolean) => {
    const updated = { ...bhugtanReceiptFields, [field]: value };
    setBhugtanReceiptFields(updated);
    localStorage.setItem('bhugtanReceiptFields', JSON.stringify(updated));
  };

  const entryFields = [
    { key: 'showDate', label: language === 'hi' ? 'तारीख' : 'Date' },
    { key: 'showTime', label: language === 'hi' ? 'समय' : 'Time' },
    { key: 'showCode', label: language === 'hi' ? 'कोड' : 'Code' },
    { key: 'showName', label: language === 'hi' ? 'नाम' : 'Name' },
    { key: 'showMilkType', label: language === 'hi' ? 'दूध प्रकार' : 'Milk Type' },
    { key: 'showQuantity', label: language === 'hi' ? 'मात्रा' : 'Quantity' },
    { key: 'showFat', label: 'FAT' },
    { key: 'showSnf', label: 'SNF' },
    { key: 'showLr', label: 'LR' },
    { key: 'showRate', label: language === 'hi' ? 'रेट' : 'Rate' },
    { key: 'showAmount', label: language === 'hi' ? 'राशि' : 'Amount' },
    { key: 'showPaymentMode', label: language === 'hi' ? 'भुगतान मोड' : 'Payment Mode' },
  ];

  const bhugtanFields = [
    { key: 'showCode', label: language === 'hi' ? 'कोड' : 'Code' },
    { key: 'showName', label: language === 'hi' ? 'नाम' : 'Name' },
    { key: 'showDates', label: language === 'hi' ? 'तारीखें' : 'Dates' },
    { key: 'showTotalMilk', label: language === 'hi' ? 'कुल दूध' : 'Total Milk' },
    { key: 'showTotalFat', label: language === 'hi' ? 'कुल FAT' : 'Total FAT' },
    { key: 'showAvgFat', label: language === 'hi' ? 'एवरेज FAT' : 'Avg FAT' },
    { key: 'showRate', label: language === 'hi' ? 'रेट' : 'Rate' },
    { key: 'showAmount', label: language === 'hi' ? 'राशि' : 'Amount' },
    { key: 'showRakam', label: language === 'hi' ? 'रकम' : 'Rakam' },
    { key: 'showEntryTable', label: language === 'hi' ? 'एंट्री टेबल' : 'Entry Table' },
    { key: 'showMorning', label: language === 'hi' ? 'सुबह' : 'Morning' },
    { key: 'showEvening', label: language === 'hi' ? 'शाम' : 'Evening' },
  ];

  return (
    <div className="space-y-4">
      {/* Entry Receipt Fields */}
      <div>
        <p className="text-sm font-semibold mb-2 flex items-center gap-2">
          🥛 {language === 'hi' ? 'एंट्री रसीद' : 'Entry Receipt'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {entryFields.map(f => (
            <div key={f.key} className="flex items-center gap-1.5 p-2 bg-muted/50 rounded-lg">
              <Checkbox
                checked={entryReceiptFields[f.key]}
                onCheckedChange={(checked) => updateEntryField(f.key, !!checked)}
                id={`entry-${f.key}`}
              />
              <label htmlFor={`entry-${f.key}`} className="text-[11px] font-medium cursor-pointer">{f.label}</label>
            </div>
          ))}
        </div>
      </div>

      {/* Bhugtan Receipt Fields */}
      <div>
        <p className="text-sm font-semibold mb-2 flex items-center gap-2">
          📋 {language === 'hi' ? 'भुगतान रसीद' : 'Bhugtan Receipt'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {bhugtanFields.map(f => (
            <div key={f.key} className="flex items-center gap-1.5 p-2 bg-muted/50 rounded-lg">
              <Checkbox
                checked={bhugtanReceiptFields[f.key]}
                onCheckedChange={(checked) => updateBhugtanField(f.key, !!checked)}
                id={`bhugtan-${f.key}`}
              />
              <label htmlFor={`bhugtan-${f.key}`} className="text-[11px] font-medium cursor-pointer">{f.label}</label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Referral Code Display - cache-first
const ReferralCodeDisplay: React.FC<{ language: string }> = ({ language }) => {
  const [referralCode, setReferralCode] = useState<string | null>(() => {
    return localStorage.getItem('cached_referral_code') || null;
  });
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const fetch = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('user_id', user.id)
        .maybeSingle();
      const code = (data as any)?.referral_code || null;
      setReferralCode(code);
      if (code) localStorage.setItem('cached_referral_code', code);
    };
    fetch();
  }, [user?.id]);

  if (!referralCode) return null;

  return (
    <div className="dairy-card animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="icon-badge-sm bg-accent/10">
          <span className="text-lg">🎁</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold">
            {language === 'hi' ? 'रेफरल कोड' : 'Referral Code'}
          </p>
          <p className="text-xs text-muted-foreground">
            {language === 'hi' ? 'दोस्तों को शेयर करें - हर रेफरल पर 100 डिजिटल कॉइन पाएं!' : 'Share with friends - earn 100 digital coins per referral!'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <code className="flex-1 bg-muted px-4 py-3 rounded-xl text-center text-lg font-bold tracking-widest">{referralCode}</code>
        <Button variant="outline" size="icon" className="rounded-xl" onClick={async () => {
          try { await navigator.clipboard.writeText(referralCode); } catch { /* fallback */ }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}>
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

// Digital Coins Balance Display - cache-first
const CoinBalanceDisplay: React.FC<{ language: string; dairyId?: string }> = ({ language, dairyId }) => {
  const [balance, setBalance] = useState<number>(() => {
    const cached = localStorage.getItem('cached_coin_balance');
    return cached ? parseInt(cached) || 0 : 0;
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetch = async () => {
      if (!dairyId) return;
      const { data } = await supabase
        .from('digital_coins')
        .select('balance')
        .eq('dairy_id', dairyId)
        .maybeSingle();
      const b = (data as any)?.balance || 0;
      setBalance(b);
      localStorage.setItem('cached_coin_balance', b.toString());
    };
    fetch();
  }, [dairyId]);

  return (
    <button
      onClick={() => navigate('/subscription-renewal')}
      className="w-full dairy-card animate-fade-in text-left hover:shadow-lg transition-shadow border-2 border-amber-200 dark:border-amber-800"
    >
      <div className="flex items-center gap-3">
        <div className="icon-badge-sm bg-amber-100 dark:bg-amber-900/30">
          <span className="text-lg">🪙</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold">
            {language === 'hi' ? 'डिजिटल कॉइन' : 'Digital Coins'}
          </p>
          <p className="text-xs text-muted-foreground">
            {language === 'hi' ? '1 कॉइन = ₹1 • प्लान खरीदने में उपयोग करें' : '1 coin = ₹1 • Use to buy plans'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{balance}</p>
          <p className="text-[10px] text-muted-foreground">{language === 'hi' ? 'कॉइन' : 'coins'}</p>
        </div>
      </div>
    </button>
  );
};

// Dairy Customer Code Display (only if admin enabled) - cache-first
const DairyCodeDisplay: React.FC<{ language: string; dairyId?: string }> = ({ language, dairyId }) => {
  const [dairyCode, setDairyCode] = useState<string | null>(() => {
    return localStorage.getItem('cached_dairy_code') || null;
  });
  const [featureEnabled, setFeatureEnabled] = useState(() => {
    return localStorage.getItem('cached_dairy_code_feature') === 'true';
  });

  useEffect(() => {
    const fetch = async () => {
      if (!dairyId) return;
      // Check if feature is enabled
      const { data: feat } = await supabase
        .from('dairy_features')
        .select('is_enabled')
        .eq('dairy_id', dairyId)
        .eq('feature_key', 'customer_code')
        .maybeSingle();
      
      const enabled = (feat as any)?.is_enabled || false;
      setFeatureEnabled(enabled);
      localStorage.setItem('cached_dairy_code_feature', enabled.toString());

      if (enabled) {
        const { data: dairy } = await supabase
          .from('dairies')
          .select('code')
          .eq('id', dairyId)
          .single();
        const code = dairy?.code || null;
        setDairyCode(code);
        if (code) localStorage.setItem('cached_dairy_code', code);
      }
    };
    fetch();
  }, [dairyId]);

  if (!featureEnabled || !dairyCode) return null;

  return (
    <div className="dairy-card animate-fade-in border-2 border-primary/20">
      <div className="flex items-center gap-3">
        <div className="icon-badge-sm bg-primary/10">
          <span className="text-lg">🔗</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold">
            {language === 'hi' ? 'ग्राहक कोड (12 अंक)' : 'Customer Code (12 digit)'}
          </p>
          <p className="text-xs text-muted-foreground">
            {language === 'hi' ? 'ग्राहकों को यह कोड दें ताकि वे अपना कार्ड देख सकें' : 'Share this code with customers to view their card'}
          </p>
        </div>
      </div>
      <div className="mt-3 bg-muted px-4 py-3 rounded-xl text-center">
        <p className="text-2xl font-bold font-mono tracking-widest">{dairyCode}</p>
      </div>
    </div>
  );
};

// Collapsible section wrapper
const SettingsSection: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  delay?: string;
}> = ({ icon, title, subtitle, children, defaultOpen = false, delay = '0ms' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="dairy-card animate-fade-in" style={{ animationDelay: delay }}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-3 w-full text-left">
            <div className="icon-badge-sm bg-primary/10">
              {icon}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold">{title}</h3>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
            <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// Entry Settings Section - checks admin feature control
const EntrySettingsSection: React.FC<{
  language: string;
  dairyId?: string;
  ownerSettings: any;
  updateOwnerSettings: (updates: any) => void;
  savingOwnerSettings: boolean;
}> = ({ language, dairyId, ownerSettings, updateOwnerSettings, savingOwnerSettings }) => {
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFeature = async () => {
      if (!dairyId) { setLoading(false); return; }
      const { data } = await supabase
        .from('dairy_features')
        .select('is_enabled')
        .eq('dairy_id', dairyId)
        .eq('feature_key', 'entry_settings')
        .maybeSingle();
      const enabled = (data as any)?.is_enabled || false;
      setFeatureEnabled(enabled);
      setLoading(false);

      // Auto-disable pro toggles when admin locks advance settings
      if (!enabled) {
        const disableUpdates: any = {};
        if (ownerSettings.predictMilkEnabled) disableUpdates.predictMilkEnabled = false;
        if (ownerSettings.codeDirection !== 'off') disableUpdates.codeDirection = 'off';
        if (ownerSettings.prefillEnabled) disableUpdates.prefillEnabled = false;
        if (Object.keys(disableUpdates).length > 0) {
          updateOwnerSettings(disableUpdates);
        }
      }
    };
    checkFeature();
  }, [dairyId]);

  if (loading) return null;
  
  const isLocked = !featureEnabled;

  return (
    <SettingsSection
      icon={<span className="text-lg">🔢</span>}
      title={`${language === 'hi' ? 'एंट्री सेटिंग्स (एडवांस)' : 'Entry Settings (Advanced)'} ${isLocked ? '' : '⭐ Pro'}`}
      subtitle={isLocked ? (language === 'hi' ? '🔒 एडमिन द्वारा लॉक है • ⭐ Pro' : '🔒 Locked by admin • ⭐ Pro') : undefined}
      delay="160ms"
    >
      {/* Predict Milk Toggle */}
      <div className={cn("flex items-center justify-between p-3 bg-muted/50 rounded-xl mb-3", isLocked && "opacity-50 pointer-events-none")}>
        <div>
          <span className="font-medium">{language === 'hi' ? 'दूध भविष्यवाणी (Predict Milk)' : 'Predict Milk'} <span className="text-xs text-primary">⭐ Pro</span></span>
          <p className="text-xs text-muted-foreground">{language === 'hi' ? 'पिछली 2 बार समान दूध हो तो ऑटो भरें' : 'Auto-fill if last 2 entries have same quantity'}</p>
        </div>
        <Switch checked={ownerSettings.predictMilkEnabled ?? false} onCheckedChange={(checked) => updateOwnerSettings({ predictMilkEnabled: checked })} disabled={savingOwnerSettings || isLocked} />
      </div>

      {/* Auto Code Change Toggle */}
      <div className={cn("flex items-center justify-between p-3 bg-muted/50 rounded-xl mb-3", isLocked && "opacity-50 pointer-events-none")}>
        <div>
          <span className="font-medium">{language === 'hi' ? 'ऑटो कोड चेंज' : 'Auto Code Change'} <span className="text-xs text-primary">⭐ Pro</span></span>
          <p className="text-xs text-muted-foreground">
            {language === 'hi' ? 'सेव के बाद अगला/पिछला कोड ऑटो सेलेक्ट हो' : 'Auto-select next/prev code after save'}
          </p>
        </div>
        <Switch 
          checked={ownerSettings.codeDirection !== 'off'} 
          onCheckedChange={(checked) => updateOwnerSettings({ codeDirection: checked ? 'forward' : 'off' })} 
          disabled={savingOwnerSettings || isLocked} 
        />
      </div>

      {/* Direction selector - only when auto code change is ON */}
      {ownerSettings.codeDirection !== 'off' && !isLocked && (
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl mb-3">
          <span className="text-sm font-medium">{language === 'hi' ? 'दिशा' : 'Direction'}</span>
          <div className="flex bg-muted rounded-full p-0.5">
            <button
              onClick={() => updateOwnerSettings({ codeDirection: 'forward' })}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all", ownerSettings.codeDirection === 'forward' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >⬆️ {language === 'hi' ? 'आगे' : 'Up'}</button>
            <button
              onClick={() => updateOwnerSettings({ codeDirection: 'reverse' })}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all", ownerSettings.codeDirection === 'reverse' ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >⬇️ {language === 'hi' ? 'पीछे' : 'Down'}</button>
          </div>
        </div>
      )}

      {/* Default Prefill Toggle */}
      <div className={cn("flex items-center justify-between p-3 bg-muted/50 rounded-xl mb-3", isLocked && "opacity-50 pointer-events-none")}>
        <div>
          <span className="font-medium">{language === 'hi' ? 'Already Filled: FAT, SNF, LR' : 'Prefill: FAT, SNF, LR'}</span>
          <p className="text-xs text-muted-foreground">{language === 'hi' ? 'एंट्री में ये वैल्यू ऑटो भरें' : 'Auto-fill these values in entry'}</p>
        </div>
        <Switch checked={ownerSettings.prefillEnabled} onCheckedChange={(checked) => updateOwnerSettings({ prefillEnabled: checked })} disabled={savingOwnerSettings || isLocked} />
      </div>

      {ownerSettings.prefillEnabled && !isLocked && (
        <div className="grid grid-cols-3 gap-2 p-3 bg-primary/5 rounded-xl">
          <div>
            <label className="text-[10px] text-muted-foreground block text-center">FAT</label>
            <Input type="number" inputMode="decimal" value={ownerSettings.prefillFat ?? ''} onChange={e => updateOwnerSettings({ prefillFat: e.target.value ? parseFloat(e.target.value) : null })} className="h-9 text-center text-sm font-semibold" placeholder="0.0" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block text-center">SNF</label>
            <Input type="number" inputMode="decimal" value={ownerSettings.prefillSnf ?? ''} onChange={e => updateOwnerSettings({ prefillSnf: e.target.value ? parseFloat(e.target.value) : null })} className="h-9 text-center text-sm font-semibold" placeholder="0.0" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground block text-center">LR</label>
            <Input type="number" inputMode="decimal" value={ownerSettings.prefillLr ?? ''} onChange={e => updateOwnerSettings({ prefillLr: e.target.value ? parseFloat(e.target.value) : null })} className="h-9 text-center text-sm font-semibold" placeholder="0.0" />
          </div>
        </div>
      )}

      {isLocked && (
        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg mt-2">
          {language === 'hi' ? '🔒 यह फीचर एडमिन द्वारा लॉक है। एडमिन से संपर्क करें।' : '🔒 This feature is locked by admin. Contact admin.'}
        </p>
      )}
    </SettingsSection>
  );
};

// FAT/SNF Machine Connect - admin feature controlled
const FatMachineConnect: React.FC<{
  language: string;
  dairyId?: string;
  ownerSettings: any;
  updateOwnerSettings: (updates: any) => void;
  toast: any;
}> = ({ language, dairyId, ownerSettings, updateOwnerSettings, toast }) => {
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFeature = async () => {
      if (!dairyId) { setLoading(false); return; }
      const { data } = await supabase
        .from('dairy_features')
        .select('is_enabled')
        .eq('dairy_id', dairyId)
        .eq('feature_key', 'connect_fat_machine')
        .maybeSingle();
      setFeatureEnabled((data as any)?.is_enabled || false);
      setLoading(false);
    };
    checkFeature();
  }, [dairyId]);

  if (loading) return null;
  const isLocked = !featureEnabled;

  return (
    <div className={cn("flex items-center justify-between p-3 bg-muted/50 rounded-xl", isLocked && "opacity-50")}>
      <div className="flex items-center gap-3">
        <Bluetooth className="h-5 w-5 text-blue-500" />
        <div>
          <span className="font-medium">{language === 'hi' ? 'FAT/SNF मशीन' : 'FAT/SNF Machine'} <span className="text-xs text-primary">⭐ Pro</span></span>
          <p className="text-xs text-muted-foreground">
            {isLocked 
              ? (language === 'hi' ? '🔒 एडमिन द्वारा लॉक है' : '🔒 Locked by admin')
              : (language === 'hi' ? 'ब्लूटूथ से कनेक्ट करें' : 'Connect via Bluetooth')}
          </p>
        </div>
      </div>
      <Button
        variant={ownerSettings.bluetoothFatMachineConnected ? "default" : "outline"}
        size="sm"
        className="rounded-xl"
        disabled={isLocked}
        onClick={async () => {
          if (isLocked) return;
          try {
            if (!(navigator as any).bluetooth) {
              toast({ title: language === 'hi' ? 'सपोर्ट नहीं है' : 'Not Supported', description: language === 'hi' ? 'Chrome ब्राउज़र उपयोग करें।' : 'Use Chrome browser.', variant: 'destructive' });
              return;
            }
            const device = await (navigator as any).bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['battery_service'] });
            if (device) {
              updateOwnerSettings({ bluetoothFatMachineConnected: true });
              toast({ title: language === 'hi' ? 'कनेक्ट हो गया!' : 'Connected!' });
            }
          } catch (err: any) {
            if (err.name !== 'NotFoundError') {
              toast({ title: language === 'hi' ? 'कनेक्ट नहीं हुआ' : 'Connection Failed', variant: 'destructive' });
            }
          }
        }}
      >
        {ownerSettings.bluetoothFatMachineConnected ? (language === 'hi' ? 'कनेक्टेड' : 'Connected') : (language === 'hi' ? 'कनेक्ट करें' : 'Connect')}
      </Button>
    </div>
  );
};

const PrinterConnect: React.FC<{
  language: string;
  ownerSettings: any;
  updateOwnerSettings: (updates: any) => void;
  toast: any;
}> = ({ language, ownerSettings, updateOwnerSettings, toast }) => {
  const [live, setLive] = useState<{ paired: boolean; ready: boolean; name: string | null }>(
    { paired: false, ready: false, name: null }
  );

  const refresh = async () => {
    const { isPrinterPaired, isPrinterReady, getStoredPrinterName } = await import('@/lib/thermalPrinter');
    setLive({ paired: isPrinterPaired(), ready: isPrinterReady(), name: getStoredPrinterName() });
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  // Reconcile DB flag with reality: if app says "connected" but actually disconnected, clear flag
  useEffect(() => {
    if (ownerSettings.bluetoothPrinterConnected && !live.ready && !live.paired) {
      updateOwnerSettings({ bluetoothPrinterConnected: false });
    }
  }, [live.ready, live.paired, ownerSettings.bluetoothPrinterConnected]);

  const status = live.ready
    ? (language === 'hi' ? 'कनेक्टेड' : 'Connected')
    : live.paired
      ? (language === 'hi' ? 'ऑफलाइन' : 'Offline')
      : (language === 'hi' ? 'कनेक्ट करें' : 'Connect');

  const handleConnect = async () => {
    const { connectThermalPrinter } = await import('@/lib/thermalPrinter');
    const res = await connectThermalPrinter();
    if (res.ok) {
      updateOwnerSettings({ bluetoothPrinterConnected: true });
      toast({ title: language === 'hi' ? 'कनेक्ट हो गया!' : 'Connected!', description: res.name });
      refresh();
    } else if (res.error === 'bluetooth_unsupported') {
      toast({ title: language === 'hi' ? 'सपोर्ट नहीं है' : 'Not Supported', description: language === 'hi' ? 'Chrome ब्राउज़र या published app उपयोग करें।' : 'Use Chrome or the published app.', variant: 'destructive' });
    } else if (res.error === 'no_writable_characteristic') {
      toast({ title: language === 'hi' ? 'प्रिंटर असंगत' : 'Incompatible Printer', description: language === 'hi' ? 'यह डिवाइस BLE थर्मल प्रिंटर नहीं है। Classic Bluetooth (SPP) प्रिंटर ब्राउज़र में नहीं दिखते।' : 'Not a BLE thermal printer. Classic Bluetooth (SPP) printers do not appear in the browser.', variant: 'destructive' });
    } else if (res.error !== 'cancelled') {
      toast({ title: language === 'hi' ? 'कनेक्ट नहीं हुआ' : 'Connection Failed', description: res.error, variant: 'destructive' });
    }
  };

  const handleDisconnect = async () => {
    const { forgetPrinter } = await import('@/lib/thermalPrinter');
    forgetPrinter();
    updateOwnerSettings({ bluetoothPrinterConnected: false });
    toast({ title: language === 'hi' ? 'डिस्कनेक्ट हो गया' : 'Disconnected' });
    refresh();
  };

  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
      <div className="flex items-center gap-3 min-w-0">
        <Bluetooth className={cn("h-5 w-5", live.ready ? "text-green-500" : "text-blue-500")} />
        <div className="min-w-0">
          <span className="font-medium">{language === 'hi' ? 'ब्लूटूथ प्रिंटर' : 'Bluetooth Printer'}</span>
          <p className="text-xs text-muted-foreground truncate">
            {live.ready
              ? (live.name || 'Printer') + ' • ' + (language === 'hi' ? 'तैयार' : 'ready')
              : live.paired
                ? (language === 'hi' ? 'पेयर्ड पर ऑफलाइन — दोबारा कनेक्ट करें' : 'Paired but offline — reconnect')
                : (language === 'hi' ? 'थर्मल प्रिंटर से कनेक्ट करें (BLE only)' : 'Connect thermal printer (BLE only)')}
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        {(live.paired || live.ready) && (
          <Button variant="outline" size="sm" className="rounded-xl" onClick={handleDisconnect}>
            {language === 'hi' ? 'भूलें' : 'Forget'}
          </Button>
        )}
        <Button
          variant={live.ready ? "default" : "outline"}
          size="sm"
          className="rounded-xl"
          onClick={handleConnect}
        >
          {status}
        </Button>
      </div>
    </div>
  );
};

const Settings: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { rateSettings, updateRateSettings, updateDairy, suppliers } = useDairy();
  const { logout, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Edit dairy dialog state
  const [showEditDairy, setShowEditDairy] = useState(false);
  const [editDairyName, setEditDairyName] = useState('');
  
  const [isSavingDairy, setIsSavingDairy] = useState(false);
  
  // Customer calculation visibility state
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [customerVisibility, setCustomerVisibility] = useState<Record<string, boolean>>({});
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);

  // FAT/SNF rate settings
  const { settings: fatSnfSettings, toggleEnabled: toggleFatSnfEnabled, saving: savingFatSnf } = useFatSnfRateSettings();
   
  // Owner settings
  const { settings: ownerSettings, updateSettings: updateOwnerSettings, saving: savingOwnerSettings } = useOwnerSettings();

  // Load customer visibility settings — only fill missing keys, preserve user's in-progress toggles
  useEffect(() => {
    if (suppliers.length > 0) {
      setCustomerVisibility(prev => {
        const next = { ...prev };
        suppliers.forEach(s => {
          if (!(s.id in next)) {
            next[s.id] = s.canSeeCalculations ?? true;
          }
        });
        return next;
      });
    }
  }, [suppliers]);

  const handleToggleCustomerVisibility = (supplierId: string) => {
    setCustomerVisibility(prev => ({
      ...prev,
      [supplierId]: !prev[supplierId]
    }));
  };

  const handleSaveVisibilitySettings = async () => {
    setIsSavingVisibility(true);
    try {
      const updates = Object.entries(customerVisibility).map(([id, canSee]) => 
        supabase
          .from('suppliers')
          .update({ can_see_calculations: canSee } as any)
          .eq('id', id)
      );
      
      await Promise.all(updates);
      
      toast({
        title: t('success'),
        description: language === 'hi' ? 'सेटिंग्स सेव हो गई' : 'Settings saved'
      });
      setShowCustomerSelector(false);
    } catch (error) {
      toast({
        title: t('error'),
        description: language === 'hi' ? 'सेव करने में त्रुटि' : 'Failed to save',
        variant: 'destructive'
      });
    } finally {
      setIsSavingVisibility(false);
    }
  };

  const languages: { code: Language; name: string; nativeName: string; flag: string }[] = [
    { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
    { code: 'en', name: 'English', nativeName: 'English', flag: '🌐' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleOpenEditDairy = () => {
    setEditDairyName(user?.dairyName || '');
    setShowEditDairy(true);
  };

  const handleSaveDairy = async () => {
    if (!editDairyName.trim()) {
      toast({ 
        title: t('error'), 
        description: language === 'hi' ? 'डेयरी का नाम आवश्यक है' : 'Dairy name is required', 
        variant: 'destructive' 
      });
      return;
    }

    setIsSavingDairy(true);
    try {
      const success = await updateDairy(editDairyName.trim());
      if (success) {
        await refreshProfile();
        toast({ 
          title: t('success'), 
          description: language === 'hi' ? 'डेयरी अपडेट हो गई' : 'Dairy updated' 
        });
        setShowEditDairy(false);
      } else {
        toast({ 
          title: t('error'), 
          description: language === 'hi' ? 'यह कोड पहले से मौजूद है' : 'This code already exists', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      toast({ 
        title: t('error'), 
        description: language === 'hi' ? 'अपडेट विफल' : 'Update failed', 
        variant: 'destructive' 
      });
    } finally {
      setIsSavingDairy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <Header />

      <main className="px-4 py-6 max-w-4xl mx-auto space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" />
          {t('settings')}
        </h2>

        {/* Subscription Info - On TOP for Owners */}
        {user?.role === 'owner' && <SubscriptionInfo />}

        {/* Referral Code */}
        {user?.role === 'owner' && <ReferralCodeDisplay language={language} />}

        {/* Digital Coins Balance */}
        {user?.role === 'owner' && <CoinBalanceDisplay language={language} dairyId={user?.dairyId} />}

        {/* Dairy Customer Code */}
        {user?.role === 'owner' && <DairyCodeDisplay language={language} dairyId={user?.dairyId} />}

        {/* Dairy Settings - Only for Owners */}
        {user?.role === 'owner' && user?.dairyName && (
          <SettingsSection
            icon={<Building2 className="h-5 w-5 text-primary" />}
            title={t('dairySettings')}
            defaultOpen={false}
            delay="40ms"
          >
            <div className="p-4 bg-muted/50 rounded-2xl mb-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold text-lg">{user.dairyName}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenEditDairy} className="rounded-xl">
                  <Edit3 className="h-4 w-4 mr-1" />
                  {language === 'hi' ? 'बदलें' : 'Edit'}
                </Button>
              </div>
            </div>

            {/* Show Calculations - Customer Selector */}
            <div className="p-4 bg-accent/10 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-accent" />
                  <div>
                    <p className="font-semibold">{t('showCalculations')}</p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'hi' 
                        ? 'चुनें कौन से ग्राहक कैलकुलेशन देख सकते हैं' 
                        : 'Select which customers can see calculations'}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCustomerSelector(true)} className="rounded-xl">
                  <Users className="h-4 w-4 mr-1" />
                  {language === 'hi' ? 'चुनें' : 'Select'}
                </Button>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">
                {Object.values(customerVisibility).filter(Boolean).length} / {suppliers.length} {language === 'hi' ? 'ग्राहक देख सकते हैं' : 'customers can view'}
              </div>
            </div>
          </SettingsSection>
        )}

        {/* Language Settings */}
        <SettingsSection
          icon={<Globe className="h-5 w-5 text-primary" />}
          title={t('language')}
          defaultOpen={false}
          delay="60ms"
        >
          <div className="grid grid-cols-3 gap-3">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={cn(
                  'py-4 px-3 rounded-2xl border-2 transition-all duration-300 text-center',
                  language === lang.code
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-muted/50'
                )}
              >
                <p className="text-2xl mb-1">{lang.flag}</p>
                <p className="font-bold text-base">{lang.nativeName}</p>
                <p className="text-xs text-muted-foreground">{lang.name}</p>
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* Rate Settings - Only for Owners */}
        {user?.role === 'owner' && (
          <SettingsSection
            icon={<DollarSign className="h-5 w-5 text-accent" />}
            title={t('rateSettings')}
            delay="80ms"
          >
            {/* Fat Rate - For Suppliers */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl mb-3">
              <div className="icon-badge bg-primary/15">
                <Percent className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">
                  {language === 'hi' ? 'प्रति फैट रेट' : 'Rate per Fat'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === 'hi' ? 'सप्लायर के लिए' : 'For Suppliers'}
                </p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                <Input
                  type="number"
                  value={rateSettings.fatRate}
                  onChange={e => updateRateSettings({ fatRate: parseFloat(e.target.value) || 0 })}
                  className="w-24 text-center text-lg font-bold pl-7 rounded-xl border-2"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl mb-4">
              {language === 'hi' 
                ? `उदाहरण: फैट 6.5 × दूध 10L × ₹${rateSettings.fatRate} = ₹${(6.5 * 10 * rateSettings.fatRate).toFixed(0)}`
                : `Example: Fat 6.5 × Milk 10L × ₹${rateSettings.fatRate} = ₹${(6.5 * 10 * rateSettings.fatRate).toFixed(0)}`
              }
            </p>

            {/* Liter Rate - For Buyers */}
            <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl mb-3">
              <div className="icon-badge bg-accent/15">
                <DollarSign className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">
                  {language === 'hi' ? 'प्रति लीटर रेट' : 'Rate per Liter'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {language === 'hi' ? 'खरीदार के लिए' : 'For Buyers'}
                </p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">₹</span>
                <Input
                  type="number"
                  value={rateSettings.literRate || 50}
                  onChange={e => updateRateSettings({ literRate: parseFloat(e.target.value) || 0 })}
                  className="w-24 text-center text-lg font-bold pl-7 rounded-xl border-2"
                />
              </div>
            </div>

            {/* FAT / SNF Rate System */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-br from-secondary/50 to-muted/50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="icon-badge bg-primary/15">
                    <Grid3X3 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {language === 'hi' ? 'FAT / SNF रेट सिस्टम' : 'FAT / SNF Rate System'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fatSnfSettings.isEnabled ? (language === 'hi' ? 'सक्रिय' : 'Active') : (language === 'hi' ? 'निष्क्रिय' : 'Inactive')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={fatSnfSettings.isEnabled} onCheckedChange={toggleFatSnfEnabled} disabled={savingFatSnf} />
                  {fatSnfSettings.isEnabled && (
                    <Button variant="ghost" size="sm" onClick={() => navigate('/fat-snf-rate-setup')} className="rounded-xl">
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
              
              {fatSnfSettings.isEnabled && (
                <div className="mt-3 p-3 bg-primary/5 rounded-xl">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{language === 'hi' ? 'बेस फैट रेट' : 'Base FAT Rate'}</span>
                    <span className="font-semibold">₹{fatSnfSettings.baseFatRate}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-muted-foreground">{language === 'hi' ? 'बेस SNF' : 'Base SNF'}</span>
                    <span className="font-semibold">{fatSnfSettings.baseSNF}</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-3 rounded-xl" onClick={() => navigate('/fat-snf-rate-setup')}>
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    {language === 'hi' ? 'रेट चार्ट सेटअप' : 'Rate Chart Setup'}
                  </Button>
                </div>
              )}
            </div>

            {/* Calculation Method for Bhugtan */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="icon-badge-sm bg-accent/10">
                  <Calculator className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold">
                    {language === 'hi' ? 'भुगतान कैलकुलेशन' : 'Payment Calculation'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => updateRateSettings({ calculationMethod: 'avg_fat' })}
                  className={cn(
                    "w-full p-3 rounded-xl border-2 text-left transition-all",
                    rateSettings.calculationMethod === 'avg_fat' ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{language === 'hi' ? 'एवरेज फैट से' : 'By Average FAT'}</p>
                      <p className="text-xs text-muted-foreground">{language === 'hi' ? 'कुल दूध × एवरेज फैट × रेट' : 'Total Milk × Avg FAT × Rate'}</p>
                    </div>
                    {rateSettings.calculationMethod === 'avg_fat' && <Check className="h-5 w-5 text-primary" />}
                  </div>
                </button>

                <button
                  onClick={() => updateRateSettings({ calculationMethod: 'daily_total' })}
                  className={cn(
                    "w-full p-3 rounded-xl border-2 text-left transition-all",
                    rateSettings.calculationMethod === 'daily_total' ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{language === 'hi' ? 'रोज़ का जोड़' : 'Daily Total'}</p>
                      <p className="text-xs text-muted-foreground">{language === 'hi' ? 'हर दिन का कैलकुलेशन जोड़कर' : 'Sum of each day\'s amount'}</p>
                    </div>
                    {rateSettings.calculationMethod === 'daily_total' && <Check className="h-5 w-5 text-primary" />}
                  </div>
                </button>
              </div>
            </div>
          </SettingsSection>
        )}

        {/* Printer & Device Settings - Only for Owners */}
        {user?.role === 'owner' && (
          <SettingsSection
            icon={<Printer className="h-5 w-5 text-accent" />}
            title={language === 'hi' ? 'प्रिंटर और डिवाइस' : 'Printer & Devices'}
            subtitle={language === 'hi' ? 'प्रिंटर और ब्लूटूथ सेटिंग्स' : 'Printer and Bluetooth settings'}
            delay="100ms"
          >
            <div className="space-y-3">
              {/* Printer Usage Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Printer className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{language === 'hi' ? 'प्रिंटर उपयोग' : 'Use Printer'}</span>
                    <p className="text-xs text-muted-foreground">{language === 'hi' ? 'रसीद प्रिंट करें' : 'Print receipts'}</p>
                  </div>
                </div>
                <Switch checked={ownerSettings.usesPrinter} onCheckedChange={(checked) => updateOwnerSettings({ usesPrinter: checked })} disabled={savingOwnerSettings} />
              </div>

              {/* Bluetooth Fat/SNF Machine - admin feature controlled */}
              <FatMachineConnect language={language} dairyId={user?.dairyId} ownerSettings={ownerSettings} updateOwnerSettings={updateOwnerSettings} toast={toast} />

              {/* Bluetooth Printer */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Bluetooth className="h-5 w-5 text-blue-500" />
                  <div>
                    <span className="font-medium">{language === 'hi' ? 'ब्लूटूथ प्रिंटर' : 'Bluetooth Printer'}</span>
                    <p className="text-xs text-muted-foreground">{language === 'hi' ? 'थर्मल प्रिंटर से कनेक्ट करें (साइलेंट प्रिंट)' : 'Connect thermal printer (silent print)'}</p>
                  </div>
                </div>
                <Button
                  variant={ownerSettings.bluetoothPrinterConnected ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl"
                  onClick={async () => {
                    const { connectThermalPrinter } = await import('@/lib/thermalPrinter');
                    const res = await connectThermalPrinter();
                    if (res.ok) {
                      updateOwnerSettings({ bluetoothPrinterConnected: true });
                      toast({ title: language === 'hi' ? 'कनेक्ट हो गया!' : 'Connected!', description: res.name });
                    } else if (res.error === 'bluetooth_unsupported') {
                      toast({ title: language === 'hi' ? 'सपोर्ट नहीं है' : 'Not Supported', description: language === 'hi' ? 'Chrome ब्राउज़र या ऐप का उपयोग करें।' : 'Use Chrome browser or the app.', variant: 'destructive' });
                    } else if (res.error === 'no_writable_characteristic') {
                      toast({ title: language === 'hi' ? 'प्रिंटर असंगत' : 'Incompatible Printer', description: language === 'hi' ? 'यह डिवाइस थर्मल प्रिंटर नहीं है।' : 'This device is not a thermal printer.', variant: 'destructive' });
                    } else if (res.error !== 'cancelled') {
                      toast({ title: language === 'hi' ? 'कनेक्ट नहीं हुआ' : 'Connection Failed', variant: 'destructive' });
                    }
                  }}
                >
                  {ownerSettings.bluetoothPrinterConnected ? (language === 'hi' ? 'कनेक्टेड' : 'Connected') : (language === 'hi' ? 'कनेक्ट करें' : 'Connect')}
                </Button>
              </div>
            </div>
          </SettingsSection>
        )}

        {/* Bhugtan Output Settings - Only for Owners */}
        {user?.role === 'owner' && (
          <SettingsSection
            icon={<FileText className="h-5 w-5 text-foreground" />}
            title={language === 'hi' ? 'भुगतान आउटपुट' : 'Payment Output'}
            subtitle={language === 'hi' ? 'भुगतान समय क्या करना है' : 'What to do at payment time'}
            delay="120ms"
          >
            <div className="space-y-2">
              <button
                onClick={() => updateOwnerSettings({ bhugtanOutputType: 'print' })}
                className={cn("w-full p-3 rounded-xl border-2 text-left transition-all", ownerSettings.bhugtanOutputType === 'print' ? "border-primary bg-primary/10" : "border-border hover:border-primary/40")}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><Printer className="h-4 w-4" /><span className="font-medium">{language === 'hi' ? 'प्रिंट (रसीद)' : 'Print (Receipt)'}</span></div>
                  {ownerSettings.bhugtanOutputType === 'print' && <Check className="h-5 w-5 text-primary" />}
                </div>
              </button>
              <button
                onClick={() => updateOwnerSettings({ bhugtanOutputType: 'pdf' })}
                className={cn("w-full p-3 rounded-xl border-2 text-left transition-all", ownerSettings.bhugtanOutputType === 'pdf' ? "border-primary bg-primary/10" : "border-border hover:border-primary/40")}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><FileText className="h-4 w-4" /><span className="font-medium">{language === 'hi' ? 'PDF (विस्तृत रिपोर्ट)' : 'PDF (Detailed Report)'}</span></div>
                  {ownerSettings.bhugtanOutputType === 'pdf' && <Check className="h-5 w-5 text-primary" />}
                </div>
              </button>
              <button
                onClick={() => updateOwnerSettings({ bhugtanOutputType: 'nothing' })}
                className={cn("w-full p-3 rounded-xl border-2 text-left transition-all", ownerSettings.bhugtanOutputType === 'nothing' ? "border-primary bg-primary/10" : "border-border hover:border-primary/40")}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="text-lg">🚫</span><span className="font-medium">{language === 'hi' ? 'कुछ नहीं' : 'Nothing'}</span></div>
                  {ownerSettings.bhugtanOutputType === 'nothing' && <Check className="h-5 w-5 text-primary" />}
                </div>
              </button>
            </div>
          </SettingsSection>
        )}

        {/* Receipt Customization - Only for Owners */}
        {user?.role === 'owner' && (
          <SettingsSection
            icon={<Receipt className="h-5 w-5 text-primary" />}
            title={language === 'hi' ? 'रसीद सेटिंग्स' : 'Receipt Settings'}
            subtitle={language === 'hi' ? 'रसीद में क्या दिखाना है चुनें' : 'Choose what to show on receipts'}
            delay="140ms"
          >
            <ReceiptCustomization language={language} />
          </SettingsSection>
        )}

        {/* Voice Entry Toggle - Separate, always visible for owners */}
        {user?.role === 'owner' && (
          <div className="dairy-card animate-fade-in" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="icon-badge-sm bg-primary/10">
                  <span className="text-lg">🎤</span>
                </div>
                <div>
                  <p className="font-semibold">{language === 'hi' ? 'आवाज एंट्री दिखाएं' : 'Show Voice Entry'}</p>
                  <p className="text-xs text-muted-foreground">{language === 'hi' ? 'एंट्री सेक्शन में वॉइस टॉगल दिखाएं' : 'Show voice toggle in entry section'}</p>
                </div>
              </div>
              <Switch checked={ownerSettings.showVoiceEntry ?? true} onCheckedChange={(checked) => updateOwnerSettings({ showVoiceEntry: checked })} disabled={savingOwnerSettings} />
            </div>
          </div>
        )}

        {/* Code Direction & Prefill Settings - Only for Owners - Requires admin feature */}
        {user?.role === 'owner' && (
          <EntrySettingsSection language={language} dairyId={user?.dairyId} ownerSettings={ownerSettings} updateOwnerSettings={updateOwnerSettings} savingOwnerSettings={savingOwnerSettings} />
        )}

        {/* Logout */}
        <Button
          variant="destructive"
          className="w-full py-6 text-lg animate-fade-in rounded-2xl font-bold"
          style={{ animationDelay: '180ms' }}
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-5 w-5" />
          {t('logout')}
        </Button>
      </main>

      <BottomNav />

      {/* Edit Dairy Dialog */}
      <Dialog open={showEditDairy} onOpenChange={setShowEditDairy}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {t('dairySettings')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('dairyName')}</label>
              <Input type="text" value={editDairyName} onChange={e => setEditDairyName(e.target.value)} className="dairy-input" placeholder={language === 'hi' ? 'डेयरी का नाम' : 'Dairy Name'} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditDairy(false)} className="rounded-xl" disabled={isSavingDairy}>{t('cancel')}</Button>
            <Button variant="dairy" onClick={handleSaveDairy} className="rounded-xl" disabled={isSavingDairy}>{isSavingDairy ? '...' : t('save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Visibility Selector Dialog */}
      <Dialog open={showCustomerSelector} onOpenChange={setShowCustomerSelector}>
        <DialogContent className="rounded-2xl max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {language === 'hi' ? 'कैलकुलेशन दिखाएं' : 'Show Calculations'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2">
            <p className="text-sm text-muted-foreground mb-4">
              {language === 'hi' 
                ? 'चुनें कौन से ग्राहक अपने कार्ड में रेट और पैसे देख सकते हैं' 
                : 'Select which customers can see rates and amounts on their card'}
            </p>
            
            <div className="flex gap-2 mb-4">
              <Button variant="outline" size="sm" className="rounded-xl flex-1" onClick={() => {
                const all: Record<string, boolean> = {};
                suppliers.forEach(s => { all[s.id] = true; });
                setCustomerVisibility(all);
              }}>
                {language === 'hi' ? 'सभी चुनें' : 'Select All'}
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl flex-1" onClick={() => {
                const none: Record<string, boolean> = {};
                suppliers.forEach(s => { none[s.id] = false; });
                setCustomerVisibility(none);
              }}>
                {language === 'hi' ? 'सभी हटाएं' : 'Deselect All'}
              </Button>
            </div>

            <div className="space-y-2">
              {suppliers.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleToggleCustomerVisibility(s.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                    customerVisibility[s.id] ? "border-primary bg-primary/10" : "border-border"
                  )}
                >
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all", customerVisibility[s.id] ? "bg-primary border-primary" : "border-muted-foreground/30")}>
                    {customerVisibility[s.id] && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div>
                    <span className="font-semibold text-sm">{s.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">#{s.code}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="dairy" onClick={handleSaveVisibilitySettings} disabled={isSavingVisibility} className="w-full rounded-xl">
              {isSavingVisibility ? '...' : (language === 'hi' ? 'सेव करें' : 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
