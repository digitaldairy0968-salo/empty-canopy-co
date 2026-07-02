import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, MessageCircle, Phone, Shield, Zap, Star, CheckCircle2, Wallet, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';


const SubscriptionRenewal: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<any>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [varieties, setVarieties] = useState<any[]>([]);
  const [varPlans, setVarPlans] = useState<any[]>([]);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<{ plan: any; variety: any } | null>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const varietyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const [sRes, subRes, vRes, pRes] = await Promise.all([
        supabase.from('subscription_settings').select('*').limit(1).maybeSingle(),
        user?.dairyId
          ? supabase.from('subscriptions').select('expires_at').eq('dairy_id', user.dairyId).eq('status', 'active').maybeSingle()
          : Promise.resolve({ data: null } as any),
        supabase.from('subscription_varieties').select('*').eq('is_active', true).order('created_at'),
        supabase.from('variety_plans').select('*').eq('is_active', true).order('price'),
      ]);
      setSettings(sRes.data);
      setVarieties(vRes.data || []);
      setVarPlans(pRes.data || []);
      if ((subRes as any).data?.expires_at) {
        setDaysLeft(Math.max(0, Math.ceil((new Date((subRes as any).data.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))));
      }
    };
    fetchAll();
  }, [user?.dairyId]);

  const varietyById = React.useMemo(() => {
    const m: Record<string, any> = {};
    for (const v of varieties) m[v.id] = v;
    return m;
  }, [varieties]);

  const visiblePlans = varPlans.filter((p: any) => varietyById[p.variety_id]);

  const durations = React.useMemo(() => {
    const map = new Map<number, { days: number; label: string }>();
    visiblePlans.forEach((p: any) => {
      if (!map.has(p.validity_days)) map.set(p.validity_days, { days: p.validity_days, label: p.name });
    });
    return Array.from(map.values()).sort((a, b) => a.days - b.days);
  }, [visiblePlans]);

  const varietiesForDuration = React.useMemo(() => {
    if (selectedDays == null) return [];
    return visiblePlans
      .filter((p: any) => p.validity_days === selectedDays)
      .map((p: any) => ({ plan: p, variety: varietyById[p.variety_id] }))
      .filter((x: any) => x.variety);
  }, [selectedDays, visiblePlans, varietyById]);

  const pickDuration = (days: number) => {
    setSelectedDays(days);
    setSelectedPlan(null);
    setTimeout(() => varietyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const pickVariety = (plan: any, variety: any) => {
    setSelectedPlan({ plan, variety });
    setTimeout(() => paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const buildMsg = () => {
    if (!selectedPlan) return '';
    const { plan, variety } = selectedPlan;
    return language === 'hi'
      ? `नमस्ते 🙏\nमैं डेयरी "${user?.dairyName || ''}" से हूँ।\nमैंने प्लान चुना है:\n• ${variety.name} - ${plan.name} (${plan.validity_days} दिन)\n• कीमत: ₹${plan.price}\n\nमैंने भुगतान कर दिया है। स्क्रीनशॉट भेज रहा हूँ। कृपया एक्टिवेशन कोड भेजें।`
      : `Hello 🙏\nDairy "${user?.dairyName || ''}"\nSelected plan:\n• ${variety.name} - ${plan.name} (${plan.validity_days} days)\n• Price: ₹${plan.price}\n\nPayment done. Sending screenshot. Please send activation code.`;
  };

  const openWA = () => {
    if (!settings?.admin_phone) return;
    const msg = selectedPlan ? buildMsg() : (language === 'hi' ? 'नमस्ते' : 'Hello');
    window.open(`https://wa.me/${settings.admin_phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const payUPI = () => {
    if (!settings?.upi_id || !selectedPlan) return;
    const { plan, variety } = selectedPlan;
    const payeeName = settings?.payee_name || settings?.admin_name || 'Dairy';
    const url = `upi://pay?pa=${encodeURIComponent(settings.upi_id)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(plan.price)}&cu=INR&tn=${encodeURIComponent(`${variety.name} - ${plan.name}`)}`;
    window.location.href = url;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-accent/80" />
        <div className="relative px-4 py-6">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="text-primary-foreground hover:bg-primary-foreground/20">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-primary-foreground flex-1">
              {language === 'hi' ? '⭐ प्रीमियम प्लान' : '⭐ Premium Plans'}
            </h1>
          </div>
          {daysLeft !== null && (
            <div className="flex justify-center mb-4">
              <div className="bg-primary-foreground/15 backdrop-blur-sm rounded-2xl px-6 py-4 text-center border border-primary-foreground/20">
                <p className="text-5xl font-black text-primary-foreground">{daysLeft}</p>
                <p className="text-primary-foreground/80 text-sm font-medium">{language === 'hi' ? 'दिन बचे हैं' : 'days remaining'}</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { icon: <Zap className="h-3 w-3" />, text: language === 'hi' ? 'असीमित' : 'Unlimited' },
              { icon: <Shield className="h-3 w-3" />, text: language === 'hi' ? 'सुरक्षित' : 'Secure' },
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
        <div className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-semibold text-primary text-center">
          {language === 'hi' ? 'चरण 1: अवधि चुनें' : 'Step 1: Choose Duration'}
        </div>
        <div className="space-y-2">
          {durations.map((d) => {
            const isSel = selectedDays === d.days;
            return (
              <button key={d.days} onClick={() => pickDuration(d.days)}
                className={cn("w-full p-4 rounded-2xl border text-left transition-all bg-card flex items-center justify-between",
                  isSel ? "border-primary border-2 shadow-md bg-primary/5" : "border-border/40 hover:border-primary/40 shadow-sm")}>
                <div>
                  <p className="font-bold text-base text-foreground flex items-center gap-2">
                    {d.label}
                    {isSel && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.days} {language === 'hi' ? 'दिन की वैधता' : 'days validity'}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            );
          })}
        </div>

        {selectedDays != null && (
          <>
            <div ref={varietyRef} className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-semibold text-primary text-center mt-6">
              {language === 'hi' ? 'चरण 2: वैरायटी चुनें' : 'Step 2: Choose Variety'}
            </div>
            <div className="space-y-2">
              {varietiesForDuration.map(({ plan, variety }) => {
                const isSel = selectedPlan?.plan?.id === plan.id;
                return (
                  <button key={plan.id} onClick={() => pickVariety(plan, variety)}
                    className={cn("w-full p-4 rounded-2xl border text-left transition-all bg-card",
                      isSel ? "border-primary border-2 shadow-md bg-primary/5" : "border-border/40 hover:border-primary/40 shadow-sm")}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-bold text-base text-foreground flex items-center gap-2">
                          {variety.name}
                          {isSel && <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />}
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

        {selectedPlan && (
          <>
            <div ref={paymentRef} className="rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 text-sm font-semibold text-primary text-center mt-6">
              {language === 'hi' ? 'चरण 3: भुगतान करें' : 'Step 3: Make Payment'}
            </div>
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border-2 border-primary/30 p-4">
              <p className="text-xs text-muted-foreground mb-1">{language === 'hi' ? 'आपका चुना हुआ प्लान' : 'Selected Plan'}</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-foreground">{selectedPlan.variety.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPlan.plan.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
                </div>
                <p className="text-3xl font-black text-primary">₹{selectedPlan.plan.price}</p>
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-4">
              <p className="font-bold text-amber-800 dark:text-amber-300 mb-2 text-sm">
                {language === 'hi' ? '📋 निर्देश:' : '📋 Instructions:'}
              </p>
              <ol className="space-y-1.5 text-sm text-amber-900 dark:text-amber-200 list-decimal list-inside">
                <li>{language === 'hi' ? '"पेमेंट करें" पर क्लिक करें' : 'Tap "Pay Now"'}</li>
                <li>{language === 'hi' ? 'पेमेंट का स्क्रीनशॉट लें' : 'Take payment screenshot'}</li>
                <li>{language === 'hi' ? 'WhatsApp से एडमिन को भेजें' : 'Send to admin on WhatsApp'}</li>
                <li>{language === 'hi' ? 'एडमिन कोड भेजेगा (यदि आवश्यक)' : 'Admin will send code (if needed)'}</li>
              </ol>
            </div>
            <div className="bg-card rounded-3xl shadow-xl border border-border/50 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/5 to-accent/5 p-4 border-b border-border/50">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  {language === 'hi' ? 'भुगतान करें' : 'Make Payment'}
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {settings?.upi_id && (
                  <Button onClick={payUPI} className="w-full gap-2 h-14 rounded-2xl text-lg font-bold bg-gradient-to-r from-primary to-accent shadow-glow">
                    <Wallet className="h-5 w-5" />
                    {language === 'hi' ? `पेमेंट करें ₹${selectedPlan.plan.price}` : `Pay Now ₹${selectedPlan.plan.price}`}
                  </Button>
                )}
                {settings?.admin_phone && (
                  <Button variant="outline" onClick={openWA} className="w-full gap-2 h-12 rounded-xl border-2 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/20">
                    <MessageCircle className="h-5 w-5 text-green-600" /><Phone className="h-4 w-4 text-green-600" />
                    <span className="font-semibold">{language === 'hi' ? 'WhatsApp पर स्क्रीनशॉट भेजें' : 'Send Screenshot on WhatsApp'}</span>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default SubscriptionRenewal;
