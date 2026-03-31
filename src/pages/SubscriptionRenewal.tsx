import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Copy, Check, QrCode, Phone, MessageCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SubscriptionRenewal: React.FC = () => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<any>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [varieties, setVarieties] = useState<any[]>([]);
  const [varPlans, setVarPlans] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [sRes, subRes, vRes, pRes] = await Promise.all([
        supabase.from('subscription_settings').select('*').limit(1).maybeSingle(),
        user?.dairyId ? supabase.from('subscriptions').select('expires_at').eq('dairy_id', user.dairyId).eq('status', 'active').maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('subscription_varieties').select('*').eq('is_active', true).order('created_at'),
        supabase.from('variety_plans').select('*').eq('is_active', true).order('price'),
      ]);
      setSettings(sRes.data);
      setVarieties(vRes.data || []);
      setVarPlans(pRes.data || []);
      if (subRes.data?.expires_at) {
        setDaysLeft(Math.max(0, Math.ceil((new Date(subRes.data.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))));
      }
      // fallback old plans
      const { data: oldPlans } = await supabase.from('payment_plans').select('*').eq('is_active', true).order('price');
      setPlans(oldPlans || []);
    };
    fetch();
  }, [user?.dairyId]);

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
        ? 'नमस्ते, मैंने भुगतान किया है। कृपया मेरी सब्सक्रिप्शन बढ़ाएं।'
        : 'Hello, I have made payment. Please extend my subscription.';
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

  return (
    <div className="min-h-screen bg-background">
      <header className="dairy-header px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="text-primary-foreground hover:bg-primary-foreground/20">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-full flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{language === 'hi' ? 'सब्सक्रिप्शन बढ़ाएं' : 'Extend Subscription'}</h1>
              {daysLeft !== null && (
                <p className="text-primary-foreground/70 text-sm">
                  {daysLeft} {language === 'hi' ? 'दिन बचे हैं' : 'days remaining'}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-md mx-auto space-y-4">
        {/* Show varieties & plans */}
        {varieties.length > 0 ? (
          varieties.map((v: any) => {
            const vp = varPlans.filter((p: any) => p.variety_id === v.id);
            const features = Array.isArray(v.features) ? v.features : [];
            return (
              <div key={v.id} className="dairy-card">
                <h3 className="font-bold text-lg">{v.name}</h3>
                {v.description && <p className="text-sm text-muted-foreground">{v.description}</p>}
                {features.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {features.map((f: string, i: number) => (
                      <p key={i} className="text-xs text-primary flex items-center gap-1.5">
                        <Check className="h-3 w-3" /> {f}
                      </p>
                    ))}
                  </div>
                )}
                {vp.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {vp.map((plan: any) => (
                      <div key={plan.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{plan.name}</p>
                          <p className="text-xs text-muted-foreground">{plan.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
                        </div>
                        <p className="text-lg font-bold text-primary">₹{plan.price}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : plans.length > 0 ? (
          <div className="dairy-card space-y-2">
            {plans.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-3 border rounded-xl">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
                </div>
                <p className="text-lg font-bold text-primary">₹{p.price}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Payment Info */}
        <div className="dairy-card space-y-4">
          {settings?.upi_id && (
            <div>
              <p className="font-medium text-sm mb-2">{language === 'hi' ? 'UPI से भुगतान करें' : 'Pay via UPI'}</p>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-3 py-2 rounded text-sm flex-1 truncate">{settings.upi_id}</code>
                <Button variant="outline" size="icon" onClick={copyUPI}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {settings?.qr_code_url && (
            <div>
              <p className="font-medium text-sm mb-2">{language === 'hi' ? 'QR कोड स्कैन करें' : 'Scan QR Code'}</p>
              <img src={settings.qr_code_url} alt="QR" className="w-48 h-48 border rounded-lg cursor-pointer" onClick={() => setShowQR(true)} />
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => setShowQR(true)} className="gap-1"><QrCode className="h-4 w-4" />{language === 'hi' ? 'बड़ा देखें' : 'Full'}</Button>
                <Button variant="outline" size="sm" onClick={downloadQR} className="gap-1"><Download className="h-4 w-4" />{language === 'hi' ? 'डाउनलोड' : 'Download'}</Button>
              </div>
            </div>
          )}

          {settings?.admin_phone && (
            <Button variant="outline" onClick={openWhatsApp} className="w-full gap-2">
              <MessageCircle className="h-4 w-4" /><Phone className="h-4 w-4" />{settings.admin_phone}
            </Button>
          )}
        </div>

        {/* Final message */}
        <div className="dairy-card bg-primary/5 border-2 border-primary/20 text-center py-6">
          <p className="text-lg font-bold text-primary">
            {language === 'hi'
              ? '💰 पेमेंट कर दें, एडमिन आपका टाइम पीरियड बढ़ा देगा'
              : '💰 Make the payment, admin will extend your subscription'}
          </p>
        </div>
      </main>

      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-center">{language === 'hi' ? 'QR कोड' : 'QR Code'}</DialogTitle></DialogHeader>
          {settings?.qr_code_url && (
            <div className="flex flex-col items-center gap-4">
              <img src={settings.qr_code_url} alt="QR" className="w-full max-w-xs rounded-lg border" />
              <Button onClick={downloadQR} className="w-full gap-2"><Download className="h-4 w-4" />{language === 'hi' ? 'डाउनलोड' : 'Download'}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionRenewal;
