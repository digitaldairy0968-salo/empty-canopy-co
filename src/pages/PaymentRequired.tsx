import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Copy, MessageCircle, Check, ArrowLeft, QrCode, Phone, Download, Play, Shield, Zap, Star, CheckCircle2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';


const PaymentRequired: React.FC = () => {
  const { language } = useLanguage();
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [varieties, setVarieties] = useState<any[]>([]);
  const [varPlans, setVarPlans] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activationCode, setActivationCode] = useState('');
  const [activating, setActivating] = useState(false);
  const [activatingDemo, setActivatingDemo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<{ plan: any; variety: any } | null>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const varietyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [vRes, pRes, sRes] = await Promise.all([
          supabase.from('subscription_varieties').select('*').eq('is_active', true).order('created_at'),
          supabase.from('variety_plans').select('*').eq('is_active', true).order('price'),
          supabase.from('subscription_settings').select('*').limit(1).maybeSingle(),
        ]);
        setVarieties(vRes.data || []);
        setVarPlans(pRes.data || []);
        setSettings(sRes.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  const demoDays = (settings as any)?.demo_days || 9;

  const varietyById = React.useMemo(() => {
    const m: Record<string, any> = {};
    for (const v of varieties) m[v.id] = v;
    return m;
  }, [varieties]);

  const pickDuration = (days: number) => {
    setSelectedDays(days);
    setSelectedPlan(null);
    setTimeout(() => varietyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const handlePickPlan = (plan: any) => {
    const variety = varietyById[plan.variety_id];
    if (!variety) return;
    setSelectedPlan({ plan, variety });
    setTimeout(() => paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const buildOrderMsg = () => {
    if (!selectedPlan) return '';
    const { plan, variety } = selectedPlan;
    return language === 'hi'
      ? `नमस्ते 🙏\nमैं डेयरी "${user?.dairyName || ''}" से हूँ।\nमैंने यह प्लान चुना है:\n• प्लान: ${variety.name} - ${plan.name} (${plan.validity_days} दिन)\n• कीमत: ₹${plan.price}\n\nमैंने भुगतान कर दिया है। पेमेंट स्क्रीनशॉट भेज रहा हूँ। कृपया एक्टिवेशन कोड भेजें।`
      : `Hello 🙏\nI am from dairy "${user?.dairyName || ''}".\nI have selected this plan:\n• Plan: ${variety.name} - ${plan.name} (${plan.validity_days} days)\n• Price: ₹${plan.price}\n\nI have made the payment. Sending screenshot. Please send activation code.`;
  };

  const copyUPI = async () => {
    if (!settings?.upi_id) return;
    try { await navigator.clipboard.writeText(settings.upi_id); } catch {
      const ta = document.createElement('textarea'); ta.value = settings.upi_id; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true); toast.success(language === 'hi' ? 'UPI ID कॉपी हो गई' : 'UPI ID copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const openWhatsApp = () => {
    if (!settings?.admin_phone) return;
    const msg = selectedPlan ? buildOrderMsg() : (language === 'hi'
      ? 'नमस्ते, मैंने भुगतान किया है। कृपया एक्टिवेशन कोड भेजें।'
      : 'Hello, I have made payment. Please send activation code.');
    window.open(`https://wa.me/${settings.admin_phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const payWithUPIApp = () => {
    if (!settings?.upi_id || !selectedPlan) return;
    const { plan, variety } = selectedPlan;
    const payeeName = settings?.payee_name || settings?.admin_name || 'Dairy';
    const note = `${variety.name} - ${plan.name}`;
    const url = `upi://pay?pa=${encodeURIComponent(settings.upi_id)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(plan.price)}&cu=INR&tn=${encodeURIComponent(note)}`;
    window.location.href = url;
  };

  const downloadQR = async () => {
    if (!settings?.qr_code_url) return;
    try {
      const res = await fetch(settings.qr_code_url); const blob = await res.blob();
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'qr-code.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {}
  };

  const activateCode = async () => {
    if (!activationCode.trim()) { toast.error(language === 'hi' ? 'कृपया कोड दर्ज करें' : 'Please enter code'); return; }
    if (!user?.dairyId) { toast.error(language === 'hi' ? 'डेयरी नहीं मिली' : 'Dairy not found'); return; }
    setActivating(true);
    try {
      const { error } = await supabase.rpc('activate_subscription_code', { _code: activationCode.trim().toUpperCase(), _dairy_id: user.dairyId });
      if (error) {
        if (error.message.includes('invalid_code')) { toast.error(language === 'hi' ? 'अमान्य या उपयोग किया गया कोड' : 'Invalid or used code'); return; }
        if (error.message.includes('not_dairy_owner')) { toast.error(language === 'hi' ? 'डेयरी मालिक नहीं है' : 'Not dairy owner'); return; }
        throw error;
      }
      toast.success(language === 'hi' ? 'सक्रियण सफल!' : 'Activation successful!');
      localStorage.removeItem('subscription_cache');
      await refreshProfile();
      navigate('/dashboard');
    } catch (e: any) { toast.error(e.message || 'Activation failed'); }
    finally { setActivating(false); }
  };

  const activateDemo = async () => {
    if (!user?.dairyId) { toast.error(language === 'hi' ? 'डेयरी नहीं मिली' : 'Dairy not found'); return; }
    setActivatingDemo(true);
    try {
      const { error } = await supabase.rpc('activate_demo_subscription', { _dairy_id: user.dairyId });
      if (error) {
        if (error.message.includes('demo_already_used')) { toast.error(language === 'hi' ? 'डेमो पहले से उपयोग किया जा चुका है' : 'Demo already used'); return; }
        throw error;
      }
      localStorage.removeItem('subscription_cache');
      toast.success(language === 'hi' ? `डेमो सक्रिय! ${demoDays} दिन का फ्री एक्सेस।` : `Demo activated! ${demoDays} days free.`);
      await refreshProfile();
      navigate('/dashboard');
    } catch { toast.error(language === 'hi' ? 'डेमो विफल' : 'Demo failed'); }
    finally { setActivatingDemo(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const visiblePlans = varPlans.filter((p: any) => varietyById[p.variety_id]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Premium Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent/80" />
        <div className="absolute top-4 right-4 w-32 h-32 bg-primary-foreground/5 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-8 w-24 h-24 bg-accent/20 rounded-full blur-xl" />

        <div className="relative px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={async () => { await logout(); navigate('/auth'); }} className="text-primary-foreground hover:bg-primary-foreground/20">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-primary-foreground">
                {language === 'hi' ? '⭐ प्रीमियम प्लान' : '⭐ Premium Plans'}
              </h1>
            </div>
          </div>

          <div className="text-center mb-4">
            <div className="w-16 h-16 bg-primary-foreground/20 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <span className="text-3xl">👑</span>
            </div>
            <p className="text-primary-foreground/80 text-sm font-medium">
              {language === 'hi' ? '✨ प्रीमियम डेयरी प्रबंधन' : '✨ Premium Dairy Management'}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-2">
            {[
              { icon: <Zap className="h-3 w-3" />, text: language === 'hi' ? 'असीमित एंट्री' : 'Unlimited Entries' },
              { icon: <Shield className="h-3 w-3" />, text: language === 'hi' ? 'डेटा सुरक्षित' : 'Data Secure' },
              { icon: <Star className="h-3 w-3" />, text: language === 'hi' ? 'सभी फीचर्स' : 'All Features' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-1 bg-primary-foreground/10 text-primary-foreground/90 px-3 py-1.5 rounded-full text-xs font-medium">
                {f.icon} {f.text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="px-4 py-6 max-w-md mx-auto space-y-4 -mt-2">
        {/* Demo Option */}
        <div className="bg-card rounded-3xl shadow-xl border-2 border-dashed border-orange-300 dark:border-orange-700 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center">
              <Play className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-orange-700 dark:text-orange-400">
                {language === 'hi' ? `🎉 ${demoDays} दिन फ्री डेमो` : `🎉 ${demoDays} Days Free Demo`}
              </h3>
              <p className="text-xs text-muted-foreground">
                {language === 'hi' ? 'बिना भुगतान के सभी फीचर्स आज़माएं' : 'Try all features without payment'}
              </p>
            </div>
          </div>
          <Button onClick={activateDemo} disabled={activatingDemo} variant="outline"
            className="w-full border-orange-400 text-orange-700 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-950 rounded-xl h-11" size="lg">
            {activatingDemo ? <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" /> : (
              <><Play className="h-4 w-4 mr-2" />{language === 'hi' ? `${demoDays} दिन फ्री शुरू करें` : `Start ${demoDays} Days Free`}</>
            )}
          </Button>
        </div>

        {/* Step 1: Duration */}
        <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-semibold text-primary text-center">
          {language === 'hi' ? 'चरण 1: अवधि चुनें' : 'Step 1: Choose Duration'}
        </div>

        {(() => {
          const durMap = new Map<number, string>();
          visiblePlans.forEach((p: any) => { if (!durMap.has(p.validity_days)) durMap.set(p.validity_days, p.name); });
          const durations = Array.from(durMap.entries()).sort((a, b) => a[0] - b[0]);
          return (
            <div className="space-y-2">
              {durations.map(([days, label]) => {
                const isSel = selectedDays === days;
                return (
                  <button key={days} onClick={() => pickDuration(days)}
                    className={cn("w-full p-4 rounded-2xl border text-left transition-all bg-card flex items-center justify-between",
                      isSel ? "border-primary border-2 shadow-md bg-primary/5" : "border-border/40 hover:border-primary/40 shadow-sm")}>
                    <div>
                      <p className="font-bold text-base text-foreground flex items-center gap-2">
                        {label}
                        {isSel && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{days} {language === 'hi' ? 'दिन की वैधता' : 'days validity'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {selectedDays != null && (
          <>
            <div ref={varietyRef} className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-semibold text-primary text-center mt-6">
              {language === 'hi' ? 'चरण 2: वैरायटी चुनें' : 'Step 2: Choose Variety'}
            </div>
            <div className="space-y-2">
              {visiblePlans.filter((p: any) => p.validity_days === selectedDays).map((plan: any) => {
                const variety = varietyById[plan.variety_id];
                const isSelected = selectedPlan?.plan?.id === plan.id;
                return (
                  <button key={plan.id} onClick={() => handlePickPlan(plan)}
                    className={cn("w-full p-4 rounded-2xl border text-left transition-all bg-card",
                      isSelected ? "border-primary border-2 shadow-md bg-primary/5" : "border-border/40 hover:border-primary/40 shadow-sm")}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-bold text-base text-foreground flex items-center gap-2">
                          {variety.name}
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{plan.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
                      </div>
                      <p className="text-2xl font-black text-primary ml-3">₹{plan.price}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Step 3: Payment Section */}
        {selectedPlan && (
          <>
            <div ref={paymentRef} className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-semibold text-primary text-center mt-6">
              {language === 'hi' ? 'चरण 3: भुगतान करें' : 'Step 3: Make Payment'}
            </div>

            <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border-2 border-primary/30 p-4">
              <p className="text-xs text-muted-foreground mb-1">{language === 'hi' ? 'आपका चुना हुआ प्लान' : 'Your Selected Plan'}</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">{selectedPlan.plan.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPlan.variety.name} • {selectedPlan.plan.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
                </div>
                <p className="text-3xl font-black text-primary">₹{selectedPlan.plan.price}</p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-4">
              <p className="font-bold text-amber-800 dark:text-amber-300 mb-2 text-sm">
                {language === 'hi' ? '📋 निर्देश:' : '📋 Instructions:'}
              </p>
              <ol className="space-y-1.5 text-sm text-amber-900 dark:text-amber-200 list-decimal list-inside">
                <li>{language === 'hi' ? 'नीचे "पेमेंट करें" बटन या QR/UPI से भुगतान करें' : 'Pay using the "Pay Now" button below, or QR/UPI'}</li>
                <li>{language === 'hi' ? 'पेमेंट का स्क्रीनशॉट लें' : 'Take a screenshot of the payment'}</li>
                <li>{language === 'hi' ? 'WhatsApp बटन से एडमिन को स्क्रीनशॉट भेजें' : 'Send screenshot to admin via WhatsApp button'}</li>
                <li>{language === 'hi' ? 'एडमिन से कोड मिलने पर नीचे कोड डालें' : 'Enter the code from admin below'}</li>
              </ol>
            </div>

            <div className="bg-card rounded-3xl shadow-xl border border-border/50 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-4 border-b border-border/50">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  {language === 'hi' ? 'भुगतान करें' : 'Make Payment'}
                </h3>
              </div>

              <div className="p-4 space-y-4">


                {settings?.upi_id && (
                  <Button
                    onClick={payWithUPIApp}
                    className="w-full gap-2 h-14 rounded-2xl text-lg font-bold bg-gradient-to-r from-primary to-accent shadow-glow"
                  >
                    <Wallet className="h-5 w-5" />
                    {language === 'hi' ? `पेमेंट करें ₹${selectedPlan.plan.price}` : `Pay Now ₹${selectedPlan.plan.price}`}
                  </Button>
                )}

                {settings?.admin_phone && (
                  <Button variant="outline" onClick={openWhatsApp} className="w-full gap-2 h-12 rounded-xl border-2 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/20">
                    <MessageCircle className="h-5 w-5 text-green-600" /><Phone className="h-4 w-4 text-green-600" />
                    <span className="font-semibold">{language === 'hi' ? 'WhatsApp पर स्क्रीनशॉट भेजें' : 'Send Screenshot on WhatsApp'}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Activation Code */}
            <div className="bg-card rounded-3xl shadow-xl border-2 border-primary/20 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-4 border-b border-border/50">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  🔑 {language === 'hi' ? 'एक्टिवेशन कोड' : 'Activation Code'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === 'hi' ? 'एडमिन से मिला कोड यहाँ दर्ज करें' : 'Enter the code received from admin'}
                </p>
              </div>
              <div className="p-4 space-y-3">
                <Input
                  placeholder={language === 'hi' ? 'कोड दर्ज करें' : 'Enter code'}
                  value={activationCode}
                  onChange={e => setActivationCode(e.target.value.toUpperCase())}
                  className="h-12 text-center text-lg font-bold tracking-widest rounded-xl"
                />
                <Button onClick={activateCode} disabled={activating || !activationCode.trim()} className="w-full h-12 rounded-xl">
                  {activating ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : (language === 'hi' ? '✅ कोड सक्रिय करें' : '✅ Activate Code')}
                </Button>
              </div>
            </div>
          </>
        )}
      </main>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle className="text-center">{language === 'hi' ? 'QR कोड' : 'QR Code'}</DialogTitle></DialogHeader>
          {settings?.qr_code_url && (
            <div className="flex flex-col items-center gap-4">
              <img src={settings.qr_code_url} alt="QR" className="w-full max-w-xs rounded-xl border" />
              <Button onClick={downloadQR} className="w-full gap-2 rounded-xl"><Download className="h-4 w-4" />{language === 'hi' ? 'डाउनलोड' : 'Download'}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentRequired;
