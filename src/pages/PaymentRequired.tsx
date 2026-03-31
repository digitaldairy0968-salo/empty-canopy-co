import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Copy, MessageCircle, Check, ArrowLeft, QrCode, Phone, Download, Play, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SubscriptionSettings {
  monthly_price: number;
  upi_id: string;
  qr_code_url: string | null;
  admin_phone: string;
  default_validity_days: number;
  demo_days?: number;
}

type Step = 'varieties' | 'plans' | 'payment';

interface Variety {
  id: string;
  name: string;
  description: string | null;
  features: string[];
}

interface Plan {
  id: string;
  name: string;
  price: number;
  validity_days: number;
  variety_id: string;
}

const PaymentRequired: React.FC = () => {
  const { language } = useLanguage();
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('varieties');
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [settings, setSettings] = useState<SubscriptionSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedVariety, setSelectedVariety] = useState<Variety | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const [activationCode, setActivationCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [activatingDemo, setActivatingDemo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [vRes, pRes, sRes] = await Promise.all([
          supabase.from('subscription_varieties').select('*').eq('is_active', true).order('created_at', { ascending: true }),
          supabase.from('variety_plans').select('*').eq('is_active', true).order('price', { ascending: true }),
          supabase.from('subscription_settings').select('*').limit(1).maybeSingle(),
        ]);
        const vData = (vRes.data || []).map((v: any) => ({
          ...v,
          features: Array.isArray(v.features) ? v.features : [],
        }));
        setVarieties(vData);
        setPlans(pRes.data || []);
        setSettings(sRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const demoDays = (settings as any)?.demo_days || 9;

  const handleBack = async () => {
    if (step === 'plans') return setStep('varieties');
    if (step === 'payment') return setStep('plans');
    await logout();
    navigate('/auth');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); return true; } catch { return false; } finally { document.body.removeChild(ta); }
    }
  };

  const copyUPI = async () => {
    if (settings?.upi_id) {
      const ok = await copyToClipboard(settings.upi_id);
      if (ok) { setCopied(true); toast.success(language === 'hi' ? 'UPI ID कॉपी हो गई' : 'UPI ID copied'); setTimeout(() => setCopied(false), 2000); }
    }
  };

  const downloadQRCode = async () => {
    if (!settings?.qr_code_url) return;
    try {
      const res = await fetch(settings.qr_code_url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'payment-qr-code.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(language === 'hi' ? 'QR कोड डाउनलोड हो गया' : 'QR code downloaded');
    } catch { toast.error(language === 'hi' ? 'डाउनलोड विफल' : 'Download failed'); }
  };

  const openWhatsApp = () => {
    if (settings?.admin_phone) {
      const planInfo = selectedPlan ? ` (${selectedPlan.name} - ₹${selectedPlan.price})` : '';
      const msg = language === 'hi'
        ? `नमस्ते, मैंने${planInfo} भुगतान किया है। कृपया एक्टिवेशन कोड भेजें।`
        : `Hello, I have paid${planInfo}. Please send activation code.`;
      window.open(`https://wa.me/${settings.admin_phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const activateCode = async () => {
    if (!activationCode.trim()) { toast.error(language === 'hi' ? 'कृपया कोड दर्ज करें' : 'Please enter code'); return; }
    if (!user?.dairyId) { toast.error(language === 'hi' ? 'डेयरी नहीं मिली' : 'Dairy not found'); return; }
    setActivating(true);
    try {
      const code = activationCode.trim().toUpperCase();
      const { error } = await supabase.rpc('activate_subscription_code', { _code: code, _dairy_id: user.dairyId });
      if (error) {
        if (error.message.includes('invalid_code')) { toast.error(language === 'hi' ? 'अमान्य या उपयोग किया गया कोड' : 'Invalid or used code'); return; }
        if (error.message.includes('not_dairy_owner')) { toast.error(language === 'hi' ? 'डेयरी मालिक नहीं है' : 'Not dairy owner'); return; }
        throw error;
      }
      try { await supabase.rpc('apply_referral_reward', { _referred_user_id: user?.id }); } catch {}
      toast.success(language === 'hi' ? 'सक्रियण सफल!' : 'Activation successful!');
      localStorage.removeItem('subscription_cache');
      await refreshProfile();
      navigate('/dashboard');
    } catch (e: any) {
      toast.error(e.message || (language === 'hi' ? 'सक्रियण विफल' : 'Activation failed'));
    } finally { setActivating(false); }
  };

  const activateDemo = async () => {
    if (!user?.dairyId) { toast.error(language === 'hi' ? 'डेयरी नहीं मिली' : 'Dairy not found'); return; }
    setActivatingDemo(true);
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + demoDays * 24 * 60 * 60 * 1000);
      const { data: existing } = await supabase.from('subscriptions').select('id').eq('dairy_id', user.dairyId).maybeSingle();
      if (existing) {
        const { error } = await supabase.from('subscriptions').update({ status: 'active', started_at: now.toISOString(), expires_at: expiresAt.toISOString() }).eq('dairy_id', user.dairyId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subscriptions').insert({ dairy_id: user.dairyId, status: 'active', started_at: now.toISOString(), expires_at: expiresAt.toISOString() });
        if (error) throw error;
      }
      localStorage.removeItem('subscription_cache');
      toast.success(language === 'hi' ? `डेमो सक्रिय! ${demoDays} दिन का फ्री एक्सेस।` : `Demo activated! ${demoDays} days free.`);
      await refreshProfile();
      navigate('/dashboard');
    } catch { toast.error(language === 'hi' ? 'डेमो विफल' : 'Demo failed'); } finally { setActivatingDemo(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stepTitle = step === 'varieties'
    ? (language === 'hi' ? 'वैरायटी चुनें' : 'Choose Variety')
    : step === 'plans'
    ? (language === 'hi' ? 'प्लान चुनें' : 'Choose Plan')
    : (language === 'hi' ? 'भुगतान करें' : 'Make Payment');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="dairy-header px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} className="text-primary-foreground hover:bg-primary-foreground/20">
            {step === 'varieties' ? <ArrowLeft className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-full flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{stepTitle}</h1>
              <p className="text-primary-foreground/70 text-sm">
                {language === 'hi' ? 'डेयरी सक्रिय करें' : 'Activate your dairy'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-md mx-auto space-y-4">
        {/* STEP 1: Varieties */}
        {step === 'varieties' && (
          <>
            <p className="text-center text-muted-foreground text-sm">
              {language === 'hi' ? 'अपनी ज़रूरत के अनुसार वैरायटी चुनें' : 'Choose a variety that fits your needs'}
            </p>
            <div className="space-y-3">
              {varieties.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setSelectedVariety(v); setStep('plans'); }}
                  className="w-full dairy-card text-left transition-all border-2 border-transparent hover:border-primary/40 hover:shadow-lg active:scale-[0.98]"
                >
                  <h3 className="font-bold text-lg text-foreground">{v.name}</h3>
                  {v.description && <p className="text-sm text-muted-foreground mt-1">{v.description}</p>}
                  {v.features.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {v.features.map((f, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm text-foreground">{f}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Demo Option */}
            <div className="dairy-card space-y-3 border-2 border-dashed border-orange-400 bg-orange-50 dark:bg-orange-950/20">
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5 text-orange-600" />
                <h3 className="font-semibold text-orange-700 dark:text-orange-400 text-lg">
                  {language === 'hi' ? `🎉 ${demoDays} दिन फ्री डेमो` : `🎉 ${demoDays} Days Free Demo`}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {language === 'hi'
                  ? `${demoDays} दिन का मुफ्त प्रीमियम एक्सेस। बिना भुगतान के सभी फीचर्स आज़माएं।`
                  : `${demoDays} days free premium access. Try all features without payment.`}
              </p>
              <Button onClick={activateDemo} disabled={activatingDemo} variant="outline"
                className="w-full border-orange-400 text-orange-700 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-950" size="lg">
                {activatingDemo ? <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" /> : (
                  <><Play className="h-4 w-4 mr-2" />{language === 'hi' ? `${demoDays} दिन फ्री डेमो शुरू करें` : `Start ${demoDays} Days Free Demo`}</>
                )}
              </Button>
            </div>
          </>
        )}

        {/* STEP 2: Plans for selected variety */}
        {step === 'plans' && selectedVariety && (
          <>
            <div className="dairy-card bg-primary/5 border border-primary/20">
              <h3 className="font-bold text-lg">{selectedVariety.name}</h3>
              {selectedVariety.description && <p className="text-sm text-muted-foreground">{selectedVariety.description}</p>}
            </div>

            <p className="text-center text-muted-foreground text-sm">
              {language === 'hi' ? 'प्लान चुनें' : 'Select a plan'}
            </p>

            <div className="space-y-3">
              {plans.filter(p => p.variety_id === selectedVariety.id).map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => { setSelectedPlan(plan); setStep('payment'); }}
                  className="w-full dairy-card text-left transition-all border-2 border-transparent hover:border-primary/40 hover:shadow-lg active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">{plan.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">₹{plan.price}</p>
                  </div>
                </button>
              ))}
              {plans.filter(p => p.variety_id === selectedVariety.id).length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  {language === 'hi' ? 'कोई प्लान उपलब्ध नहीं' : 'No plans available'}
                </p>
              )}
            </div>
          </>
        )}

        {/* STEP 3: Payment Details */}
        {step === 'payment' && selectedPlan && (
          <>
            {/* Selected plan summary */}
            <div className="dairy-card bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold">{selectedVariety?.name} — {selectedPlan.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPlan.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
                </div>
                <p className="text-2xl font-bold text-primary">₹{selectedPlan.price}</p>
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="dairy-card space-y-4">
              <h3 className="font-semibold text-lg">
                {language === 'hi' ? 'भुगतान करने के चरण' : 'Steps to Pay'}
              </h3>

              {/* UPI */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">1</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{language === 'hi' ? 'UPI से भुगतान करें' : 'Pay via UPI'}</p>
                  {settings?.upi_id && (
                    <div className="flex items-center gap-2 mt-2">
                      <code className="bg-muted px-3 py-2 rounded text-sm flex-1 truncate">{settings.upi_id}</code>
                      <Button variant="outline" size="icon" onClick={copyUPI}>
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* QR Code */}
              {settings?.qr_code_url && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium mb-2">{language === 'hi' ? 'या QR कोड स्कैन करें' : 'Or scan QR code'}</p>
                    <img src={settings.qr_code_url} alt="QR" className="w-48 h-48 border rounded-lg cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowQRDialog(true)} />
                    <div className="flex gap-2 mt-2">
                      <Button variant="outline" size="sm" onClick={() => setShowQRDialog(true)} className="gap-1">
                        <QrCode className="h-4 w-4" />{language === 'hi' ? 'बड़ा देखें' : 'View Full'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={downloadQRCode} className="gap-1">
                        <Download className="h-4 w-4" />{language === 'hi' ? 'डाउनलोड' : 'Download'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* WhatsApp */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">2</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{language === 'hi' ? 'स्क्रीनशॉट WhatsApp पर भेजें' : 'Send screenshot on WhatsApp'}</p>
                  {settings?.admin_phone && (
                    <Button variant="outline" onClick={openWhatsApp} className="mt-2 w-full gap-2">
                      <MessageCircle className="h-4 w-4" /><Phone className="h-4 w-4" />{settings.admin_phone}
                    </Button>
                  )}
                </div>
              </div>

              {/* Code */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">3</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{language === 'hi' ? 'प्राप्त कोड दर्ज करें' : 'Enter received code'}</p>
                </div>
              </div>
            </div>

            {/* Activation Code */}
            <div className="dairy-card space-y-4">
              <h3 className="font-semibold">{language === 'hi' ? 'एक्टिवेशन कोड' : 'Activation Code'}</h3>
              <Input
                type="text" value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                placeholder={language === 'hi' ? 'कोड दर्ज करें' : 'Enter code'}
                className="text-center text-xl tracking-widest uppercase" maxLength={12}
              />
              <Button onClick={activateCode} disabled={activating || !activationCode.trim()} className="w-full" size="lg">
                {activating ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : (language === 'hi' ? 'सक्रिय करें' : 'Activate')}
              </Button>
            </div>
          </>
        )}
      </main>

      {/* QR Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">{language === 'hi' ? 'QR कोड स्कैन करें' : 'Scan QR Code'}</DialogTitle>
          </DialogHeader>
          {settings?.qr_code_url && (
            <div className="flex flex-col items-center gap-4">
              <img src={settings.qr_code_url} alt="QR" className="w-full max-w-xs rounded-lg border" />
              <Button onClick={downloadQRCode} className="w-full gap-2">
                <Download className="h-4 w-4" />{language === 'hi' ? 'QR कोड डाउनलोड करें' : 'Download QR Code'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentRequired;
