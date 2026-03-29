import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Hash, Search, Milk, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

import { supabase } from '@/integrations/supabase/client';

const DairySetup: React.FC = () => {
  const { user, setupDairy, joinDairy, logout, setHasSeenOnboarding } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [dairyName, setDairyName] = useState('');
  const [dairyCode, setDairyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  const isOwner = user?.role === 'owner';

  // Save pending owner settings after dairy is created
  const savePendingSettings = async (dairyId: string) => {
    try {
      const pendingSettingsStr = localStorage.getItem('pending_owner_settings');
      if (pendingSettingsStr) {
        const pendingSettings = JSON.parse(pendingSettingsStr);
        
        await supabase
          .from('owner_settings')
          .upsert({
            dairy_id: dairyId,
            uses_printer: pendingSettings.usesPrinter ?? false,
            milk_buying_basis: pendingSettings.milkBuyingBasis ?? 'fat',
            calculation_system: pendingSettings.calculationSystem ?? 'avg_fat',
            onboarding_completed: true,
          } as any, { onConflict: 'dairy_id' });
        
        await supabase
          .from('rate_settings')
          .update({ calculation_method: pendingSettings.calculationSystem ?? 'avg_fat' } as any)
          .eq('dairy_id', dairyId);
        
        localStorage.removeItem('pending_owner_settings');
      }

      const pendingFatSnfStr = localStorage.getItem('pending_fat_snf_settings');
      if (pendingFatSnfStr) {
        const fatSnfSettings = JSON.parse(pendingFatSnfStr);
        
        await supabase
          .from('fat_snf_rate_settings')
          .upsert({
            dairy_id: dairyId,
            base_fat_rate: fatSnfSettings.baseFatRate ?? 8,
            base_snf: fatSnfSettings.baseSNF ?? 9.5,
            snf_deduction_per_point: fatSnfSettings.snfDeductionPerPoint ?? 0.2,
            fat_min: fatSnfSettings.fatMin ?? 5.0,
            fat_max: fatSnfSettings.fatMax ?? 9.0,
            fat_step: fatSnfSettings.fatStep ?? 0.5,
            snf_min: fatSnfSettings.snfMin ?? 9.0,
            snf_max: fatSnfSettings.snfMax ?? 9.5,
            is_enabled: true,
          } as any, { onConflict: 'dairy_id' });
        
        localStorage.removeItem('pending_fat_snf_settings');
      }
    } catch (error) {
      console.error('Error saving pending settings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isOwner) {
        if (!dairyName.trim()) {
          toast({
            title: t('error'),
            description: 'कृपया डेयरी का नाम दर्ज करें / Please enter dairy name',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        // Owner creates dairy WITHOUT a code (code will be null, admin controls it)
        const success = await setupDairy(dairyName.trim(), '');
        if (success) {
          // Get the newly created dairy ID and save pending settings
          const { data: dairyData } = await supabase
            .from('dairies')
            .select('id')
            .eq('owner_id', user?.id || '')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (dairyData?.id) {
            await savePendingSettings(dairyData.id);
          }
          
          toast({ title: t('success'), description: 'डेयरी बनाई गई! / Dairy created!' });
          navigate('/payment-required');
        } else {
          toast({
            title: t('error'),
            description: 'डेयरी बनाने में समस्या / Problem creating dairy',
            variant: 'destructive',
          });
        }
      } else {
        // Supplier joins via 12-digit code
        if (!/^\d{12}$/.test(dairyCode)) {
          toast({
            title: t('error'),
            description: 'कृपया 12 अंकों का कोड दर्ज करें / Please enter 12-digit code',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        setJoinError('');
        const result = await joinDairy(dairyCode);
        if (result === true) {
          toast({ title: t('success'), description: 'डेयरी से जुड़ गए! / Joined dairy!' });
          navigate('/supplier-dashboard');
        } else {
          const errorMsg = typeof result === 'string' ? result : 'डेयरी नहीं मिली / Dairy not found';
          setJoinError(errorMsg);
          toast({
            title: t('error'),
            description: errorMsg,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({ title: t('error'), description: 'कुछ गलत हो गया / Something went wrong', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="dairy-header py-8 px-4 text-center relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="absolute left-4 top-4 text-primary-foreground hover:bg-primary-foreground/20"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 bg-primary-foreground/20 rounded-full flex items-center justify-center animate-pulse-soft">
            <Milk className="w-10 h-10" />
          </div>
        </div>
        <h1 className="text-2xl font-bold">{t('appName')}</h1>
        <p className="text-primary-foreground/80 mt-1">
          {isOwner ? 'अपनी डेयरी बनाएं / Create your Dairy' : 'डेयरी कोड डालें / Enter Dairy Code'}
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 px-4 py-6 -mt-4">
        <div className="dairy-card max-w-md mx-auto animate-slide-up">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
              {isOwner ? (
                <Building2 className="w-8 h-8 text-primary" />
              ) : (
                <Search className="w-8 h-8 text-primary" />
              )}
            </div>
            <h2 className="text-xl font-bold">
              {isOwner ? 'डेयरी का नाम दर्ज करें' : 'डेयरी से जुड़ें'}
            </h2>
            <p className="text-muted-foreground text-sm mt-2">
              {isOwner
                ? 'अपनी डेयरी के लिए एक नाम दें'
                : 'डेयरी मालिक से मिला 12 अंकों का कोड डालें'}
            </p>
            {!isOwner && (
              <p className="text-amber-600 text-xs mt-2 bg-amber-50 p-2 rounded">
                नोट: पहले मालिक को आपका फोन नंबर डेयरी में जोड़ना होगा
                <br />
                Note: Owner must add your phone number first
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isOwner && (
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="डेयरी का नाम / Dairy Name *"
                  value={dairyName}
                  onChange={e => setDairyName(e.target.value)}
                  className="dairy-input pl-12"
                  required
                />
              </div>
            )}

            {/* Only show code input for suppliers */}
            {!isOwner && (
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="12 अंकों का कोड / 12-digit code *"
                  value={dairyCode}
                  onChange={e => setDairyCode(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className="dairy-input pl-12 tracking-wider text-lg"
                  maxLength={12}
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {dairyCode.length}/12
                </span>
              </div>
            )}

            {isOwner && (
              <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-2xl">
                <span className="text-lg">ℹ️</span>
                <p className="text-xs text-muted-foreground">
                  {language === 'hi' 
                    ? 'ग्राहकों के लिए 12 अंकों का कोड एडमिन द्वारा बाद में सक्रिय किया जाएगा' 
                    : 'A 12-digit code for customers will be activated by admin later'}
                </p>
              </div>
            )}

            <Button
              type="submit"
              variant="dairy"
              className="w-full"
              disabled={isLoading || (isOwner ? !dairyName.trim() : dairyCode.length !== 12)}
            >
              {isLoading ? '...' : isOwner ? 'डेयरी बनाएं / Create Dairy' : 'डेयरी में जुड़ें / Join Dairy'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DairySetup;
