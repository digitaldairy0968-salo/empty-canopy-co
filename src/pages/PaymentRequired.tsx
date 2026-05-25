import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Copy, MessageCircle, Check, ArrowLeft, QrCode, Phone, Download, Play, Crown, Sparkles, Shield, Zap, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getFeatureDef } from '@/lib/featureCatalog';


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

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [vRes, pRes, sRes] = await Promise.all([
          supabase.from('subscription_varieties').select('*').eq('is_active', true).order('created_at'),
          supabase.from('variety_plans').select('*').eq('is_active', true).order('price'),
          supabase.from('subscription_settings').select('*').limit(1).maybeSingle(),
        ]);
        setVarieties((vRes.data || []).map((v: any) => ({ ...v, features: Array.isArray(v.features) ? v.features : [] })));
        setVarPlans(pRes.data || []);
        setSettings(sRes.data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  const demoDays = (settings as any)?.demo_days || 9;

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
    if (settings?.admin_phone) {
      const msg = language === 'hi'
        ? 'नमस्ते, मैंने भुगतान किया है। कृपया एक्टिवेशन कोड भेजें।'
        : 'Hello, I have made payment. Please send activation code.';
      window.open(`https://wa.me/${settings.admin_phone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
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
      try { await supabase.rpc('apply_referral_reward', { _referred_user_id: user?.id }); } catch {}
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Premium Header - same style as SubscriptionRenewal */}
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

        {/* Variety Cards with Plans */}
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
                  {vp.map((plan: any) => (
                    <div key={plan.id} className="p-3 bg-gradient-to-r from-muted/50 to-muted/30 rounded-2xl border border-border/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{plan.name}</p>
                          <p className="text-xs text-muted-foreground">{plan.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
                        </div>
                        <p className="text-2xl font-black text-primary">₹{plan.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Payment Section */}
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
                  <img src={settings.qr_code_url} alt="QR" className="w-52 h-52 rounded-xl cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowQR(true)} />
                </div>
                <div className="flex gap-2 mt-3 justify-center">
                  <Button variant="outline" size="sm" onClick={() => setShowQR(true)} className="gap-1 rounded-xl"><QrCode className="h-4 w-4" />{language === 'hi' ? 'बड़ा देखें' : 'Full'}</Button>
                  <Button variant="outline" size="sm" onClick={downloadQR} className="gap-1 rounded-xl"><Download className="h-4 w-4" />{language === 'hi' ? 'डाउनलोड' : 'Download'}</Button>
                </div>
              </div>
            )}

            {settings?.admin_phone && (
              <Button variant="outline" onClick={openWhatsApp} className="w-full gap-2 h-12 rounded-xl border-2 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/20">
                <MessageCircle className="h-5 w-5 text-green-600" /><Phone className="h-4 w-4 text-green-600" />
                <span className="font-semibold">{settings.admin_phone}</span>
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

        {/* Final CTA */}
        <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-3xl border-2 border-primary/20 text-center py-8 px-4">
          <div className="text-4xl mb-3">💰</div>
          <p className="text-xl font-black text-primary mb-2">
            {language === 'hi' ? 'पेमेंट कर दें!' : 'Make the payment!'}
          </p>
          <p className="text-sm text-muted-foreground">
            {language === 'hi' ? 'एडमिन आपको कोड देगा, कोड दर्ज करें 🚀' : 'Admin will give you a code, enter it above 🚀'}
          </p>
        </div>
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
