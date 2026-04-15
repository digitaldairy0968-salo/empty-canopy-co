import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, ArrowLeft, Eye, EyeOff, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCachedAuthImage, fetchAndCacheAuthImage } from '@/utils/authImageCache';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import LanguageSelect from './LanguageSelect';
import RateSetup from './RateSetup';
import OwnerOnboarding from './OwnerOnboarding';
import farmerImage from '@/assets/farmer-welcome.jpg';
import cowImage from '@/assets/cow-illustration.jpg';

type AuthMode = 'login' | 'signup';
type UserRole = 'owner' | 'supplier';
type AuthStep = 'language-selection' | 'role-selection' | 'auth-form' | 'rate-setup' | 'owner-onboarding';

// Validation schemas
const emailSchema = z.string().email('कृपया सही ईमेल दर्ज करें / Please enter a valid email');
const passwordSchema = z.string().min(6, 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए / Password must be at least 6 characters');
const phoneSchema = z.string().regex(/^\d{10}$/, 'कृपया 10 अंकों का फोन नंबर दर्ज करें / Please enter 10-digit phone number');
const nameSchema = z.string().min(2, 'कृपया नाम दर्ज करें / Please enter name');

const Auth: React.FC = () => {
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [authPageImageUrl, setAuthPageImageUrl] = useState<string | null>(getCachedAuthImage);

  // Determine initial step based on pending state
  const getInitialStep = (): AuthStep => {
    if (localStorage.getItem('pending_owner_onboarding') === 'true') return 'owner-onboarding';
    if (localStorage.getItem('pending_rate_setup') === 'true') return 'rate-setup';
    return 'role-selection';
  };

  const [step, setStep] = useState<AuthStep>(getInitialStep);
  const [mode, setMode] = useState<AuthMode>('signup');
  const [role, setRole] = useState<UserRole>('owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, signup, isAuthenticated, user, authDiagnostics } = useAuth();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch admin-uploaded auth page image
  useEffect(() => {
    if (!authPageImageUrl) {
      fetchAndCacheAuthImage().then((url) => {
        if (url) setAuthPageImageUrl(url);
      });
    }
  }, []);

  // Check if this is a password recovery redirect
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    
    if (type === 'recovery' && accessToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: hashParams.get('refresh_token') || '',
      }).then(() => {
        setShowResetPassword(true);
      });
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // After login, redirect based on role
  useEffect(() => {
    if (isAuthenticated && user && step === 'auth-form' && mode === 'login') {
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'supplier') {
        navigate(user.dairyId ? '/supplier-dashboard' : '/dairy-setup', { replace: true });
      } else if (user.role === 'owner') {
        if (user.dairyId) {
          navigate('/dashboard', { replace: true });
        } else {
          // Owner without dairy - start onboarding
          const pendingRateSetup = localStorage.getItem('pending_rate_setup');
          const pendingOnboarding = localStorage.getItem('pending_owner_onboarding');
          if (pendingOnboarding === 'true') {
            setStep('owner-onboarding');
          } else if (pendingRateSetup === 'true') {
            setStep('rate-setup');
          } else {
            navigate('/dairy-setup', { replace: true });
          }
        }
      }
    }
  }, [isAuthenticated, user, step, mode]);

  const handleLanguageComplete = () => {
    setStep('role-selection');
  };

  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole);
    setStep('auth-form');
  };

  const handleBack = () => {
    if (step === 'auth-form') {
      setStep('role-selection');
      return;
    }
    if (step === 'role-selection') {
      setStep('language-selection');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (authDiagnostics.preAuthFetchStatus === 'failed') {
      toast({
        title: t('error'),
        description: authDiagnostics.preAuthFetchError || 'Network error - please check your internet connection',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    try {
      const emailResult = emailSchema.safeParse(email.trim());
      if (!emailResult.success) {
        toast({ title: t('error'), description: emailResult.error.errors[0].message, variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const passwordResult = passwordSchema.safeParse(password);
      if (!passwordResult.success) {
        toast({ title: t('error'), description: passwordResult.error.errors[0].message, variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      if (mode === 'signup') {
        const nameResult = nameSchema.safeParse(name.trim());
        if (!nameResult.success) {
          toast({ title: t('error'), description: nameResult.error.errors[0].message, variant: 'destructive' });
          setIsLoading(false);
          return;
        }

        const phoneResult = phoneSchema.safeParse(phone.trim());
        if (!phoneResult.success) {
          toast({ title: t('error'), description: phoneResult.error.errors[0].message, variant: 'destructive' });
          setIsLoading(false);
          return;
        }
      }

      if (mode === 'login') {
        const result = await login(email.trim(), password);
        if (result.success) {
          toast({ title: t('success'), description: `${t('welcome')}!` });
          // Navigation handled by useEffect above
        } else {
          toast({ 
            title: t('error'), 
            description: result.error || 'गलत ईमेल या पासवर्ड / Invalid email or password', 
            variant: 'destructive' 
          });
        }
      } else {
        const result = await signup(email.trim(), password, name.trim(), phone.trim(), role, referralCode.trim() || undefined);
        if (result.success) {
          toast({ 
            title: t('success'), 
            description: language === 'hi' 
              ? '📧 वेरिफिकेशन ईमेल भेजा गया! कृपया ईमेल में लिंक पर क्लिक करें (Inbox और Spam दोनों चेक करें)' 
              : '📧 Verification email sent! Please click the link in your email (check both Inbox and Spam)',
          });

          // For owner signup: start onboarding flow
          if (role === 'owner') {
            localStorage.setItem('pending_rate_setup', 'true');
            setStep('rate-setup');
          }
        } else {
          toast({ 
            title: t('error'), 
            description: result.error || 'यह ईमेल पहले से पंजीकृत है / This email is already registered', 
            variant: 'destructive' 
          });
        }
      }
    } catch (error) {
      toast({ title: t('error'), description: 'कुछ गलत हो गया / Something went wrong', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRateSetupComplete = () => {
    localStorage.removeItem('pending_rate_setup');
    localStorage.setItem('pending_owner_onboarding', 'true');
    setStep('owner-onboarding');
  };

  const handleOwnerOnboardingComplete = () => {
    localStorage.removeItem('pending_owner_onboarding');
    navigate('/dairy-setup');
  };

  const handleRateSetupBack = () => {
    localStorage.removeItem('pending_rate_setup');
    setStep('auth-form');
  };

  const handleOwnerOnboardingBack = () => {
    localStorage.setItem('pending_rate_setup', 'true');
    localStorage.removeItem('pending_owner_onboarding');
    setStep('rate-setup');
  };

  // Password Reset Form
  if (showResetPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-dairy-cream flex flex-col items-center justify-center px-4">
        <div className="dairy-card max-w-md w-full p-5 animate-slide-up">
          <div className="text-center mb-4">
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Lock className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-xl font-bold">{language === 'hi' ? 'नया पासवर्ड बनाएं' : 'Create New Password'}</h1>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (newPassword.length < 6) {
              toast({ title: t('error'), description: language === 'hi' ? 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए' : 'Password must be at least 6 characters', variant: 'destructive' });
              return;
            }
            if (newPassword !== confirmPassword) {
              toast({ title: t('error'), description: language === 'hi' ? 'पासवर्ड मेल नहीं खाता' : 'Passwords do not match', variant: 'destructive' });
              return;
            }
            setIsResettingPassword(true);
            try {
              const { error } = await supabase.auth.updateUser({ password: newPassword });
              if (error) throw error;
              toast({ title: t('success'), description: language === 'hi' ? '✅ पासवर्ड बदल गया! अब लॉगिन करें' : '✅ Password changed! Please login now' });
              setShowResetPassword(false);
              setNewPassword('');
              setConfirmPassword('');
              await supabase.auth.signOut();
              window.location.hash = '';
            } catch (error: any) {
              toast({ title: t('error'), description: error.message || 'Failed', variant: 'destructive' });
            } finally {
              setIsResettingPassword(false);
            }
          }} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="password"
                placeholder={language === 'hi' ? 'नया पासवर्ड *' : 'New Password *'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="dairy-input pl-11 h-11"
                minLength={6}
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder={language === 'hi' ? 'पासवर्ड दोबारा डालें *' : 'Confirm Password *'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="dairy-input pl-11 h-11"
                minLength={6}
                required
              />
            </div>
            <Button type="submit" variant="dairy" className="w-full h-11 text-base" disabled={isResettingPassword}>
              {isResettingPassword ? (language === 'hi' ? 'बदल रहा है...' : 'Changing...') : (language === 'hi' ? 'पासवर्ड बदलें' : 'Change Password')}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 'language-selection') {
    return <LanguageSelect onComplete={handleLanguageComplete} />;
  }

  if (step === 'rate-setup') {
    return (
      <RateSetup 
        onComplete={handleRateSetupComplete}
        onBack={handleRateSetupBack}
      />
    );
  }
 
  if (step === 'owner-onboarding') {
    return (
      <OwnerOnboarding
        onComplete={handleOwnerOnboardingComplete}
        onBack={handleOwnerOnboardingBack}
      />
    );
  }

  // Role Selection Screen
  if (step === 'role-selection') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-dairy-cream flex flex-col">
        <div className="relative pt-4 pb-4 px-4">
          <button
            onClick={() => setStep('language-selection')}
            className="absolute left-4 top-4 w-9 h-9 rounded-xl bg-card border border-border/50 shadow-sm flex items-center justify-center hover:bg-muted transition-colors z-10"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="text-center pt-2">
            {authPageImageUrl && (
              <div className="mb-2 relative mx-auto w-28 h-28">
                <img 
                  src={authPageImageUrl} 
                  alt="Dairy" 
                  className="w-full h-full object-contain rounded-2xl animate-bounce-gentle"
                />
              </div>
            )}
            {!authPageImageUrl && (
              <div className="flex justify-center mb-2">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 animate-bounce-gentle">
                  <Droplets className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
            )}
            <h1 className="text-xl font-bold">{t('appName')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {language === 'hi' ? 'आप कौन हैं?' : language === 'gu' ? 'તમે કોણ છો?' : 'Who are you?'}
            </p>
          </div>
        </div>

        <div className="flex-1 px-4 py-2">
          <div className="max-w-md mx-auto space-y-3 animate-slide-up">
            {/* Dairy Owner Card */}
            <button
              onClick={() => handleRoleSelect('owner')}
              className="w-full dairy-card p-0 overflow-hidden hover:shadow-xl active:scale-[0.98] transition-all duration-300 border-2 border-transparent hover:border-primary/30 group"
            >
              <div className="flex">
                <div className="w-22 h-24 flex-shrink-0 overflow-hidden" style={{width: '88px', height: '96px'}}>
                  <img 
                    src={farmerImage} 
                    alt="Dairy Owner" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="flex-1 p-3 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xl">👨‍🌾</span>
                    <h3 className="text-lg font-bold text-foreground">
                      {language === 'hi' ? 'डेयरी मालिक' : language === 'gu' ? 'ડેરી માલિક' : 'Dairy Owner'}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'hi' ? 'डेयरी बनाएं और ग्राहक जोड़ें' : language === 'gu' ? 'ડેરી બનાવો અને ગ્રાહક ઉમેરો' : 'Create dairy and add customers'}
                  </p>
                </div>
                <div className="flex items-center pr-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <span className="text-sm">→</span>
                  </div>
                </div>
              </div>
            </button>

            {/* Customer Card */}
            <button
              onClick={() => handleRoleSelect('supplier')}
              className="w-full dairy-card p-0 overflow-hidden hover:shadow-xl active:scale-[0.98] transition-all duration-300 border-2 border-transparent hover:border-accent/30 group"
            >
              <div className="flex">
                <div className="w-22 h-24 flex-shrink-0 overflow-hidden" style={{width: '88px', height: '96px'}}>
                  <img 
                    src={cowImage} 
                    alt="Customer" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="flex-1 p-3 flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xl">🐄</span>
                    <h3 className="text-lg font-bold text-foreground">
                      {language === 'hi' ? 'ग्राहक' : language === 'gu' ? 'ગ્રાહક' : 'Customer'}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'hi' ? 'डेयरी से जुड़ें और अपना कार्ड देखें' : language === 'gu' ? 'ડેરી સાથે જોડાવ અને તમારું કાર્ડ જુઓ' : 'Join dairy and view your card'}
                  </p>
                </div>
                <div className="flex items-center pr-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-all">
                    <span className="text-sm">→</span>
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="max-w-md mx-auto mt-4 text-center animate-fade-in" style={{ animationDelay: '300ms' }}>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/8 rounded-full">
              <span className="text-sm">🥛</span>
              <span className="text-xs text-muted-foreground">
                {language === 'hi' ? 'सही विकल्प चुनें' : language === 'gu' ? 'યોગ્ય વિકલ્પ પસંદ કરો' : 'Choose the right option'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Auth Form Screen
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-dairy-cream flex flex-col">
      <div className="relative pt-4 pb-3 px-4">
        <button
          onClick={handleBack}
          className="absolute left-4 top-4 w-9 h-9 rounded-xl bg-card border border-border/50 shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        
        <div className="text-center pt-6">
          {authPageImageUrl ? (
            <div className="mb-2 relative mx-auto w-28 h-28">
              <img 
                src={authPageImageUrl} 
                alt="Dairy" 
                className="w-full h-full object-contain rounded-2xl animate-bounce-gentle"
              />
            </div>
          ) : (
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Droplets className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
          )}
          <h1 className="text-xl font-bold">{t('appName')}</h1>
          <div className="flex items-center justify-center gap-1.5 mt-1">
            <span className="text-lg">{role === 'owner' ? '👨‍🌾' : '🐄'}</span>
            <span className="text-sm text-muted-foreground">
              {role === 'owner' 
                ? (language === 'hi' ? 'डेयरी मालिक' : 'Dairy Owner')
                : (language === 'hi' ? 'ग्राहक' : 'Customer')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pb-4">
        <div className="dairy-card max-w-md mx-auto animate-slide-up p-4">

          {/* Mode Toggle */}
          <div className="flex gap-2 p-1 bg-muted rounded-2xl mb-6">
            <button
              type="button"
              onClick={() => { setMode('signup'); setPhone(''); }}
              className={cn(
                'flex-1 py-3 px-4 rounded-xl font-semibold transition-all text-sm',
                mode === 'signup' 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {language === 'hi' ? 'नया खाता' : 'Sign Up'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('login'); setPhone(''); }}
              className={cn(
                'flex-1 py-3 px-4 rounded-xl font-semibold transition-all text-sm',
                mode === 'login' 
                  ? 'bg-primary text-primary-foreground shadow-md' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {language === 'hi' ? 'लॉगिन' : 'Login'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder={language === 'hi' ? 'नाम *' : 'Name *'}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="dairy-input pl-12 h-14"
                    required
                  />
                </div>
                
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder={language === 'hi' ? 'फोन नंबर (10 अंक) *' : 'Phone (10 digits) *'}
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="dairy-input pl-12 h-14"
                    required
                    maxLength={10}
                  />
                </div>

                {role === 'supplier' && (
                  <div className="flex items-start gap-2 p-3 bg-accent/10 rounded-2xl">
                    <span className="text-lg">💡</span>
                    <p className="text-xs text-muted-foreground">
                      {language === 'hi' 
                        ? 'नोट: यह वही फोन नंबर होना चाहिए जो डेयरी मालिक ने जोड़ा है' 
                        : 'Note: This must be the same phone number the dairy owner added'}
                    </p>
                  </div>
                )}

                {role === 'owner' && (
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🎁</span>
                    <Input
                      type="text"
                      placeholder={language === 'hi' ? 'रेफरल कोड (वैकल्पिक)' : 'Referral Code (optional)'}
                      value={referralCode}
                      onChange={e => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9))}
                      className="dairy-input pl-12 h-14"
                      maxLength={9}
                    />
                  </div>
                )}
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder={language === 'hi' ? 'ईमेल *' : 'Email *'}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="dairy-input pl-12 h-14"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder={language === 'hi' ? 'पासवर्ड *' : 'Password *'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="dairy-input pl-12 pr-12 h-14"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>

            <Button
              type="submit"
              variant="dairy"
              className="w-full h-14 text-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {language === 'hi' ? 'प्रतीक्षा करें...' : 'Please wait...'}
                </span>
              ) : mode === 'login' ? t('login') : t('signup')}
            </Button>
          </form>

          {mode === 'login' && (
            <div className="text-center mt-4 space-y-2">
              <button
                type="button"
                onClick={async () => {
                  if (!email.trim()) {
                    toast({ title: t('error'), description: language === 'hi' ? 'पहले ईमेल दर्ज करें' : 'Enter email first', variant: 'destructive' });
                    return;
                  }
                  const emailResult = emailSchema.safeParse(email.trim());
                  if (!emailResult.success) {
                    toast({ title: t('error'), description: language === 'hi' ? 'कृपया सही ईमेल दर्ज करें' : 'Please enter a valid email', variant: 'destructive' });
                    return;
                  }
                  try {
                    const redirectUrl = `${window.location.origin}/auth`;
                    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl });
                    
                    if (error) {
                      if (error.message.includes('rate') || error.message.includes('limit') || error.message.includes('429')) {
                        toast({ title: '⏳', description: language === 'hi' ? 'बहुत ज्यादा प्रयास! 1 घंटे बाद दोबारा करें' : 'Too many attempts! Try again after 1 hour', variant: 'destructive' });
                      } else {
                        toast({ title: t('error'), description: error.message, variant: 'destructive' });
                      }
                      return;
                    }
                    toast({ 
                      title: '📧 ' + (language === 'hi' ? 'ईमेल भेजा गया!' : 'Email sent!'), 
                      description: language === 'hi' 
                        ? 'पासवर्ड रीसेट लिंक भेजा गया। Inbox और Spam दोनों चेक करें!' 
                        : 'Password reset link sent. Check both Inbox and Spam!' 
                    });
                  } catch {
                    toast({ title: t('error'), description: language === 'hi' ? 'लिंक भेजने में विफल' : 'Failed to send link', variant: 'destructive' });
                  }
                }}
                className="text-primary text-sm font-medium hover:underline"
              >
                {language === 'hi' ? '🔑 पासवर्ड भूल गए?' : '🔑 Forgot Password?'}
              </button>
              <p className="text-muted-foreground text-xs px-4">
                {language === 'hi' 
                  ? 'ईमेल डालकर "पासवर्ड भूल गए" दबाएं। लिंक आपकी ईमेल पर आएगा (स्पैम भी चेक करें)'
                  : 'Enter email and click "Forgot Password". Link will be sent to your email (check spam too)'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
