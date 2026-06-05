import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Copy, Check, QrCode, Phone, MessageCircle, Download, Crown, Sparkles, Shield, Zap, Star, CheckCircle2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCachedQRCode, fetchAndCacheQRCode } from '@/utils/qrCodeCache';
import { getFeatureDef } from '@/lib/featureCatalog';


const SubscriptionRenewal: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<any>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [varieties, setVarieties] = useState<any[]>([]);
  const [varPlans, setVarPlans] = useState<any[]>([]);
  const [coinBalance, setCoinBalance] = useState(0);
  const [buyingWithCoins, setBuyingWithCoins] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<{ plan: any; variety: any } | null>(null);
  const paymentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const [sRes, subRes, vRes, pRes, coinRes] = await Promise.all([
        supabase.from('subscription_settings').select('*').limit(1).maybeSingle(),
        user?.dairyId ? supabase.from('subscriptions').select('expires_at').eq('dairy_id', user.dairyId).eq('status', 'active').maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('subscription_varieties').select('*').eq('is_active', true).order('created_at'),
        supabase.from('variety_plans').select('*').eq('is_active', true).order('price'),
        user?.dairyId ? supabase.from('digital_coins').select('balance').eq('dairy_id', user.dairyId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setSettings(sRes.data);
      setVarieties(vRes.data || []);
      setVarPlans(pRes.data || []);
      setCoinBalance((coinRes.data as any)?.balance || 0);
      if (subRes.data?.expires_at) {
        setDaysLeft(Math.max(0, Math.ceil((new Date(subRes.data.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))));
      }
      const qrUrl = (sRes.data as any)?.qr_code_url;
      if (qrUrl) {
        const cached = getCachedQRCode(qrUrl);
        if (cached) setQrDataUrl(cached);
        else fetchAndCacheQRCode(qrUrl).then((url) => url && setQrDataUrl(url));
      }
    };
    fetch();
  }, [user?.dairyId]);

  const handlePickPlan = (plan: any, variety: any) => {
    setSelectedPlan({ plan, variety });
    setTimeout(() => paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const buildOrderMsg = () => {
    if (!selectedPlan) return '';
    const { plan, variety } = selectedPlan;
    return language === 'hi'
      ? `नमस्ते 🙏\nमैं डेयरी "${user?.dairyName || ''}" से हूँ।\nमैंने यह प्लान चुना है:\n• वैरायटी: ${variety.name}\n• प्लान: ${plan.name} (${plan.validity_days} दिन)\n• कीमत: ₹${plan.price}\n\nमैंने भुगतान कर दिया है। पेमेंट स्क्रीनशॉट भेज रहा हूँ। कृपया एक्टिवेशन कोड भेजें।`
      : `Hello 🙏\nI am from dairy "${user?.dairyName || ''}".\nI have selected this plan:\n• Variety: ${variety.name}\n• Plan: ${plan.name} (${plan.validity_days} days)\n• Price: ₹${plan.price}\n\nI have made the payment. Sending screenshot. Please send activation code.`;
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
      ? 'नमस्ते, मैंने भुगतान किया है। कृपया मेरी सब्सक्रिप्शन बढ़ाएं।'
      : 'Hello, I have made payment. Please extend my subscription.');
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

  const buyWithCoins = async (planId: string, planPrice: number) => {
    if (!user?.dairyId) return;
    if (coinBalance < planPrice) {
      toast.error(language === 'hi' ? `पर्याप्त कॉइन नहीं हैं (${coinBalance}/${planPrice})` : `Insufficient coins (${coinBalance}/${planPrice})`);
      return;
    }
    setBuyingWithCoins(planId);
    try {
      const { error } = await supabase.rpc('purchase_plan_with_coins', { _dairy_id: user.dairyId, _plan_id: planId });
      if (error) {
        if (error.message.includes('insufficient_coins')) { toast.error(language === 'hi' ? 'पर्याप्त कॉइन नहीं' : 'Insufficient coins'); return; }
        throw error;
      }
      toast.success(language === 'hi' ? '✅ प्लान कॉइन से खरीदा गया!' : '✅ Plan purchased with coins!');
      window.location.reload();
    } catch (e: any) { toast.error(e.message || 'Failed'); } finally { setBuyingWithCoins(null); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Premium Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent/80" />
        <div className="absolute top-4 right-4 w-32 h-32 bg-primary-foreground/5 rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-8 w-24 h-24 bg-accent/20 rounded-full blur-xl" />

        <div className="relative px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="text-primary-foreground hover:bg-primary-foreground/20">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-primary-foreground">
                {language === 'hi' ? '⭐ प्रीमियम प्लान' : '⭐ Premium Plans'}
              </h1>
            </div>
          </div>

          {daysLeft !== null && (
            <div className="flex justify-center mb-4">
              <div className="bg-primary-foreground/15 backdrop-blur-sm rounded-2xl px-6 py-4 text-center border border-primary-foreground/20">
                <p className="text-5xl font-black text-primary-foreground">{daysLeft}</p>
                <p className="text-primary-foreground/80 text-sm font-medium">
                  {language === 'hi' ? 'दिन बचे हैं' : 'days remaining'}
                </p>
              </div>
            </div>
          )}

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
        {/* Coin Balance */}
        <div className="bg-card rounded-3xl shadow-xl border-2 border-amber-200 dark:border-amber-800 p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🪙</span>
            <div className="flex-1">
              <p className="font-semibold">{language === 'hi' ? 'डिजिटल कॉइन बैलेंस' : 'Digital Coin Balance'}</p>
              <p className="text-xs text-muted-foreground">{language === 'hi' ? '1 कॉइन = ₹1' : '1 coin = ₹1'}</p>
            </div>
            <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{coinBalance}</p>
          </div>
        </div>

        {/* Step 1: Varieties + Plans */}
        <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-semibold text-primary text-center">
          {language === 'hi' ? 'चरण 1: वैरायटी और प्लान चुनें' : 'Step 1: Choose a Variety & Plan'}
        </div>

        {varieties.map((v: any) => {
          const vp = varPlans.filter((p: any) => p.variety_id === v.id);
          const features = Array.isArray(v.features) ? v.features : [];
          return (
            <div key={v.id} className="bg-card rounded-3xl shadow-xl border-2 border-primary/10 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-lg text-foreground">{v.name}</h3>
                </div>
                {v.description && <p className="text-sm text-muted-foreground mt-1">{v.description}</p>}
              </div>

              {features.length > 0 && (
                <div className="px-4 py-3 grid grid-cols-2 gap-2">
                  {features.map((f: string, i: number) => {
                    const def = getFeatureDef(f);
                    const Icon = def?.icon ?? Sparkles;
                    const label = def ? (language === 'hi' ? def.labelHi : def.labelEn) : f;
                    const grad = def?.color ?? 'from-primary to-primary/70';
                    return (
                      <div key={i} className="relative overflow-hidden rounded-xl border border-border/40 bg-card p-2.5 flex items-center gap-2 shadow-sm hover:shadow-md transition-all">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-foreground leading-tight">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {vp.length > 0 && (
                <div className="p-4 pt-0 space-y-2">
                  {vp.map((plan: any) => {
                    const isSelected = selectedPlan?.plan?.id === plan.id;
                    return (
                      <div key={plan.id} className={cn(
                        "p-3 rounded-2xl border transition-all",
                        isSelected
                          ? "bg-primary/10 border-primary border-2 shadow-md"
                          : "bg-gradient-to-r from-muted/50 to-muted/30 border-border/30"
                      )}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm text-foreground">{plan.name}</p>
                            <p className="text-xs text-muted-foreground">{plan.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-primary">₹{plan.price}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <button
                            onClick={() => handlePickPlan(plan, v)}
                            className={cn(
                              "py-2 px-3 rounded-xl text-sm font-semibold transition-all",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                            )}
                          >
                            {isSelected
                              ? <span className="flex items-center justify-center gap-1"><CheckCircle2 className="h-4 w-4" />{language === 'hi' ? 'चुना गया' : 'Selected'}</span>
                              : (language === 'hi' ? 'इसे चुनें' : 'Select Plan')}
                          </button>
                          <button
                            onClick={() => buyWithCoins(plan.id, plan.price)}
                            disabled={buyingWithCoins === plan.id || coinBalance < plan.price}
                            className={cn(
                              "py-2 px-3 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50",
                              coinBalance >= plan.price
                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {buyingWithCoins === plan.id ? '...' : `🪙 ${language === 'hi' ? 'कॉइन से' : 'Coins'}`}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Step 2: Payment Section (only when plan selected) */}
        {selectedPlan && (
          <>
            <div ref={paymentRef} className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-semibold text-primary text-center mt-6">
              {language === 'hi' ? 'चरण 2: भुगतान करें' : 'Step 2: Make Payment'}
            </div>

            {/* Selected plan summary */}
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border-2 border-primary/30 p-4">
              <p className="text-xs text-muted-foreground mb-1">{language === 'hi' ? 'आपका चुना हुआ प्लान' : 'Your Selected Plan'}</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">{selectedPlan.variety.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPlan.plan.name} • {selectedPlan.plan.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
                </div>
                <p className="text-3xl font-black text-primary">₹{selectedPlan.plan.price}</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-4">
              <p className="font-bold text-amber-800 dark:text-amber-300 mb-2 text-sm">
                {language === 'hi' ? '📋 निर्देश:' : '📋 Instructions:'}
              </p>
              <ol className="space-y-1.5 text-sm text-amber-900 dark:text-amber-200 list-decimal list-inside">
                <li>{language === 'hi' ? 'नीचे "पेमेंट करें" बटन या QR/UPI से भुगतान करें' : 'Pay using the "Pay Now" button below, or QR/UPI'}</li>
                <li>{language === 'hi' ? 'पेमेंट का स्क्रीनशॉट लें' : 'Take a screenshot of the payment'}</li>
                <li>{language === 'hi' ? 'WhatsApp बटन से एडमिन को स्क्रीनशॉट भेजें' : 'Send screenshot to admin via WhatsApp button'}</li>
                <li>{language === 'hi' ? 'एडमिन से मिले कोड को यहाँ डालें (अगर मिले)' : 'Enter the code received from admin (if any)'}</li>
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
                  <div>
                    <p className="font-medium text-sm mb-2 text-muted-foreground">{language === 'hi' ? '💳 UPI से भुगतान करें' : '💳 Pay via UPI'}</p>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-4 py-3 rounded-xl text-sm flex-1 truncate font-semibold">{settings.upi_id}</code>
                      <Button variant="outline" size="icon" onClick={copyUPI} className="rounded-xl h-11 w-11">
                        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {settings?.qr_code_url && (
                  <div className="text-center">
                    <p className="font-medium text-sm mb-3 text-muted-foreground">{language === 'hi' ? '📱 QR कोड स्कैन करें' : '📱 Scan QR Code'}</p>
                    <div className="inline-block p-3 bg-card rounded-2xl shadow-lg border-2 border-primary/10">
                      <img src={qrDataUrl || settings.qr_code_url} alt="QR" width="208" height="208" className="w-52 h-52 rounded-xl cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowQR(true)} loading="lazy" decoding="async" />
                    </div>
                    <div className="flex gap-2 mt-3 justify-center">
                      <Button variant="outline" size="sm" onClick={() => setShowQR(true)} className="gap-1 rounded-xl"><QrCode className="h-4 w-4" />{language === 'hi' ? 'बड़ा देखें' : 'Full'}</Button>
                      <Button variant="outline" size="sm" onClick={downloadQR} className="gap-1 rounded-xl"><Download className="h-4 w-4" />{language === 'hi' ? 'डाउनलोड' : 'Download'}</Button>
                    </div>
                  </div>
                )}

                {/* Pay Now via UPI app */}
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
          </>
        )}

        {!selectedPlan && (
          <div className="bg-muted/40 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {language === 'hi'
                ? '👆 ऊपर से एक प्लान चुनें ताकि भुगतान विकल्प दिखाई दें'
                : '👆 Select a plan above to see payment options'}
            </p>
          </div>
        )}
      </main>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle className="text-center">{language === 'hi' ? 'QR कोड' : 'QR Code'}</DialogTitle></DialogHeader>
          {settings?.qr_code_url && (
            <div className="flex flex-col items-center gap-4">
              <img src={qrDataUrl || settings.qr_code_url} alt="QR" className="w-full max-w-xs rounded-xl border" loading="lazy" decoding="async" />
              <Button onClick={downloadQR} className="w-full gap-2 rounded-xl"><Download className="h-4 w-4" />{language === 'hi' ? 'डाउनलोड' : 'Download'}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionRenewal;
