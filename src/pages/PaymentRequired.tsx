import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Copy, MessageCircle, Check, ArrowLeft, QrCode, Phone, Download, X, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Varieties display component
const VarietiesDisplay: React.FC<{ 
  language: string; 
  onSelectVariety: (varietyId: string) => void;
  selectedVariety: string | null;
}> = ({ language, onSelectVariety, selectedVariety }) => {
  const [varieties, setVarieties] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: vData } = await supabase
        .from('subscription_varieties')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      setVarieties(vData || []);

      const { data: pData } = await supabase
        .from('variety_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      setPlans(pData || []);
    };
    fetchData();
  }, []);

  if (varieties.length === 0) {
    // Fallback to old plans display
    return <OldPlansDisplay language={language} />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-center">
        {language === 'hi' ? '🏷️ सब्सक्रिप्शन वैरायटी चुनें' : '🏷️ Choose Subscription Variety'}
      </h2>
      {varieties.map((v: any) => {
        const isSelected = selectedVariety === v.id;
        const varPlans = plans.filter((p: any) => p.variety_id === v.id);
        const features = Array.isArray(v.features) ? v.features : [];
        
        return (
          <button
            key={v.id}
            onClick={() => onSelectVariety(v.id)}
            className={`w-full dairy-card text-left transition-all border-2 ${
              isSelected ? 'border-primary bg-primary/5 shadow-lg' : 'border-transparent hover:border-primary/30'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{v.name}</h3>
                {v.description && <p className="text-sm text-muted-foreground">{v.description}</p>}
                {features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {features.map((f: string, i: number) => (
                      <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">✓ {f}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1 ${
                isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
              }`}>
                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
            </div>
            
            {isSelected && varPlans.length > 0 && (
              <div className="mt-3 pt-3 border-t space-y-2">
                <p className="text-sm font-semibold">{language === 'hi' ? 'उपलब्ध प्लान:' : 'Available Plans:'}</p>
                {varPlans.map((plan: any) => (
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
          </button>
        );
      })}
    </div>
  );
};

// Old plans fallback
const OldPlansDisplay: React.FC<{ language: string }> = ({ language }) => {
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from('payment_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      setPlans(data || []);
    };
    fetchPlans();
  }, []);

  if (plans.length === 0) return null;

  return (
    <div className="dairy-card space-y-3">
      <h2 className="text-lg font-semibold text-center">
        {language === 'hi' ? '💳 उपलब्ध प्लान' : '💳 Available Plans'}
      </h2>
      {plans.map((plan: any) => (
        <div key={plan.id} className="flex items-start justify-between p-3 border-2 border-border rounded-xl">
          <div className="flex-1">
            <p className="font-semibold">{plan.name}</p>
            <p className="text-xs text-muted-foreground">{plan.validity_days} {language === 'hi' ? 'दिन' : 'days'}</p>
            {plan.description && <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>}
          </div>
          <p className="text-lg font-bold text-primary ml-3">₹{plan.price}</p>
        </div>
      ))}
    </div>
  );
};

interface SubscriptionSettings {
  monthly_price: number;
  upi_id: string;
  qr_code_url: string | null;
  admin_phone: string;
  default_validity_days: number;
}

const PaymentRequired: React.FC = () => {
  const { t, language } = useLanguage();
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SubscriptionSettings | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [activatingDemo, setActivatingDemo] = useState(false);
  const [selectedVariety, setSelectedVariety] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fallback for older browsers or when document not focused
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        return true;
      } catch (err) {
        return false;
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const copyUPI = async () => {
    if (settings?.upi_id) {
      const success = await copyToClipboard(settings.upi_id);
      if (success) {
        setCopied(true);
        toast.success(language === 'hi' ? 'UPI ID कॉपी हो गई' : 'UPI ID copied');
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error(language === 'hi' ? 'कॉपी विफल' : 'Failed to copy');
      }
    }
  };

  const downloadQRCode = async () => {
    if (!settings?.qr_code_url) return;
    try {
      const response = await fetch(settings.qr_code_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'payment-qr-code.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(language === 'hi' ? 'QR कोड डाउनलोड हो गया' : 'QR code downloaded');
    } catch (error) {
      toast.error(language === 'hi' ? 'डाउनलोड विफल' : 'Download failed');
    }
  };

  const openWhatsApp = () => {
    if (settings?.admin_phone) {
      const message = language === 'hi' 
        ? `नमस्ते, मैंने ${settings.monthly_price} रुपये का भुगतान किया है। कृपया एक्टिवेशन कोड भेजें।`
        : `Hello, I have paid ₹${settings.monthly_price}. Please send activation code.`;
      window.open(`https://wa.me/${settings.admin_phone}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const activateCode = async () => {
    if (!activationCode.trim()) {
      toast.error(language === 'hi' ? 'कृपया कोड दर्ज करें' : 'Please enter code');
      return;
    }

    if (!user?.dairyId) {
      toast.error(language === 'hi' ? 'डेयरी नहीं मिली। कृपया पुनः लॉगिन करें।' : 'Dairy not found. Please login again.');
      return;
    }

    setActivating(true);
    try {
      const codeToCheck = activationCode.trim().toUpperCase();
      console.log('Activating code:', codeToCheck, 'for dairy:', user.dairyId);

      // Use atomic RPC function for activation
      const { data, error } = await supabase.rpc('activate_subscription_code', {
        _code: codeToCheck,
        _dairy_id: user.dairyId
      });

      console.log('Activation result:', { data, error });

      if (error) {
        console.error('Activation error:', error);
        
        // Handle specific error messages
        if (error.message.includes('invalid_code')) {
          toast.error(language === 'hi' ? 'अमान्य या उपयोग किया गया कोड' : 'Invalid or already used code');
          return;
        }
        if (error.message.includes('not_dairy_owner')) {
          toast.error(language === 'hi' ? 'डेयरी मालिक नहीं है' : 'Not the dairy owner');
          return;
        }
        if (error.message.includes('not_authenticated')) {
          toast.error(language === 'hi' ? 'कृपया पुनः लॉगिन करें' : 'Please login again');
          return;
        }
        
        throw new Error(language === 'hi' ? 'सक्रियण विफल' : 'Activation failed');
      }

      // Apply referral reward if this is first premium purchase
      try {
        await supabase.rpc('apply_referral_reward', { _referred_user_id: user?.id });
      } catch (e) {
        console.log('No referral reward to apply or already applied');
      }

      toast.success(language === 'hi' ? 'सक्रियण सफल! डैशबोर्ड पर जा रहे हैं...' : 'Activation successful! Going to dashboard...');
      localStorage.removeItem('subscription_cache');
      await refreshProfile();
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Activation error:', error);
      toast.error(error.message || (language === 'hi' ? 'सक्रियण विफल' : 'Activation failed'));
    } finally {
      setActivating(false);
    }
  };

  const handleBack = async () => {
    await logout();
    navigate('/auth');
  };

  const activateDemo = async () => {
    if (!user?.dairyId) {
      toast.error(language === 'hi' ? 'डेयरी नहीं मिली। कृपया पुनः लॉगिन करें।' : 'Dairy not found. Please login again.');
      return;
    }

    setActivatingDemo(true);
    try {
      // Create a demo subscription valid for 9 days
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000);

      // Check if subscription already exists
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('dairy_id', user.dairyId)
        .maybeSingle();

      if (existingSub) {
        // Update existing subscription
        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            started_at: now.toISOString(),
            expires_at: expiresAt.toISOString()
          })
          .eq('dairy_id', user.dairyId);

        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await supabase
          .from('subscriptions')
          .insert({
            dairy_id: user.dairyId,
            status: 'active',
            started_at: now.toISOString(),
            expires_at: expiresAt.toISOString()
          });

        if (error) throw error;
      }

      // Clear subscription cache so OwnerRoute doesn't redirect back
      localStorage.removeItem('subscription_cache');
      
      toast.success(language === 'hi' ? 'डेमो सक्रिय! 9 दिन का फ्री एक्सेस मिला।' : 'Demo activated! 9 days free access.');
      await refreshProfile();
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Demo activation error:', error);
      toast.error(language === 'hi' ? 'डेमो सक्रियण विफल' : 'Demo activation failed');
    } finally {
      setActivatingDemo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="dairy-header px-4 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-foreground/20 rounded-full flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {language === 'hi' ? 'भुगतान आवश्यक' : 'Payment Required'}
              </h1>
              <p className="text-primary-foreground/70 text-sm">
                {language === 'hi' ? 'डेयरी सक्रिय करें' : 'Activate your dairy'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-md mx-auto space-y-6">
        {/* Payment Plans */}
        <VarietiesDisplay language={language} onSelectVariety={setSelectedVariety} selectedVariety={selectedVariety} />

        {/* Payment Instructions */}
        <div className="dairy-card space-y-4">
          <h3 className="font-semibold text-lg">
            {language === 'hi' ? 'भुगतान करने के चरण' : 'Steps to Pay'}
          </h3>

          {/* Step 1: UPI */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold">1</span>
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {language === 'hi' ? 'UPI से भुगतान करें' : 'Pay via UPI'}
              </p>
              {settings?.upi_id && (
                <div className="flex items-center gap-2 mt-2">
                  <code className="bg-muted px-3 py-2 rounded text-sm flex-1 truncate">
                    {settings.upi_id}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyUPI}
                  >
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
                <p className="font-medium mb-2">
                  {language === 'hi' ? 'या QR कोड स्कैन करें' : 'Or scan QR code'}
                </p>
                <img 
                  src={settings.qr_code_url} 
                  alt="Payment QR Code" 
                  className="w-48 h-48 border rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setShowQRDialog(true)}
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQRDialog(true)}
                    className="gap-1"
                  >
                    <QrCode className="h-4 w-4" />
                    {language === 'hi' ? 'बड़ा देखें' : 'View Full'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadQRCode}
                    className="gap-1"
                  >
                    <Download className="h-4 w-4" />
                    {language === 'hi' ? 'डाउनलोड' : 'Download'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Send Screenshot */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold">2</span>
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {language === 'hi' ? 'स्क्रीनशॉट WhatsApp पर भेजें' : 'Send screenshot on WhatsApp'}
              </p>
              {settings?.admin_phone && (
                <Button
                  variant="outline"
                  onClick={openWhatsApp}
                  className="mt-2 w-full gap-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  <Phone className="h-4 w-4" />
                  {settings.admin_phone}
                </Button>
              )}
            </div>
          </div>

          {/* Step 3: Enter Code */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold">3</span>
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {language === 'hi' ? 'प्राप्त कोड दर्ज करें' : 'Enter received code'}
              </p>
            </div>
          </div>
        </div>

        {/* Activation Code Input */}
        <div className="dairy-card space-y-4">
          <h3 className="font-semibold">
            {language === 'hi' ? 'एक्टिवेशन कोड' : 'Activation Code'}
          </h3>
          <Input
            type="text"
            value={activationCode}
            onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
            placeholder={language === 'hi' ? 'कोड दर्ज करें' : 'Enter code'}
            className="text-center text-xl tracking-widest uppercase"
            maxLength={12}
          />
          <Button
            onClick={activateCode}
            disabled={activating || !activationCode.trim()}
            className="w-full"
            size="lg"
          >
            {activating ? (
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              language === 'hi' ? 'सक्रिय करें' : 'Activate'
            )}
          </Button>
        </div>

        {/* Demo Option */}
        <div className="dairy-card space-y-4 border-2 border-dashed border-orange-400 bg-orange-50 dark:bg-orange-950/20">
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-orange-700 dark:text-orange-400 text-lg">
              {language === 'hi' ? '🎉 9 दिन फ्री डेमो' : '🎉 9 Days Free Demo'}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {language === 'hi' 
              ? '9 दिन का मुफ्त प्रीमियम एक्सेस पाएं। बिना भुगतान के सभी फीचर्स आज़माएं।' 
              : 'Get 9 days free premium access. Try all features without payment.'}
          </p>
          <Button
            onClick={activateDemo}
            disabled={activatingDemo}
            variant="outline"
            className="w-full border-orange-400 text-orange-700 hover:bg-orange-100 dark:text-orange-400 dark:hover:bg-orange-950"
            size="lg"
          >
            {activatingDemo ? (
              <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {language === 'hi' ? '9 दिन फ्री डेमो शुरू करें' : 'Start 9 Days Free Demo'}
              </>
            )}
          </Button>
        </div>
      </main>

      {/* QR Code Full View Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">
              {language === 'hi' ? 'QR कोड स्कैन करें' : 'Scan QR Code'}
            </DialogTitle>
          </DialogHeader>
          {settings?.qr_code_url && (
            <div className="flex flex-col items-center gap-4">
              <img 
                src={settings.qr_code_url} 
                alt="Payment QR Code" 
                className="w-full max-w-xs rounded-lg border"
              />
              <Button
                onClick={downloadQRCode}
                className="w-full gap-2"
              >
                <Download className="h-4 w-4" />
                {language === 'hi' ? 'QR कोड डाउनलोड करें' : 'Download QR Code'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentRequired;
