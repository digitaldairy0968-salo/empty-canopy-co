import React, { useState, useEffect } from 'react';
import { Droplets } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';

type Language = 'hi' | 'gu' | 'en';

interface LanguageSelectProps {
  onComplete: () => void;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({ onComplete }) => {
  const { setLanguage } = useLanguage();
  const [authImageUrl, setAuthImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAuthImage = async () => {
      const { data } = await supabase
        .from('subscription_settings')
        .select('auth_page_image_url')
        .limit(1)
        .maybeSingle();
      if ((data as any)?.auth_page_image_url) {
        setAuthImageUrl((data as any).auth_page_image_url);
      }
    };
    fetchAuthImage();
  }, []);

  const languages: { code: Language; name: string; nativeName: string; emoji: string }[] = [
    { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', emoji: '🙏' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', emoji: '🙏' },
    { code: 'en', name: 'English', nativeName: 'English', emoji: '👋' },
  ];

  const handleSelect = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('has_selected_language', 'true');
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-dairy-cream flex flex-col">
      {/* Hero Section with Illustration */}
      <div className="relative pt-8 pb-12 px-4 text-center">
        {/* Background decoration */}
        <div className="absolute top-0 left-0 right-0 h-72 bg-gradient-to-b from-primary/8 to-transparent -z-10" />
        <div className="absolute top-20 left-1/4 w-16 h-16 bg-primary/10 rounded-full blur-2xl" />
        <div className="absolute top-32 right-1/4 w-24 h-24 bg-accent/10 rounded-full blur-2xl" />
        
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-3xl flex items-center justify-center shadow-lg shadow-primary/25 animate-bounce-gentle">
            <Droplets className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>
        
        {/* App Name */}
        <h1 className="text-3xl font-bold text-foreground mb-1">
          डेयरी प्रबंधक
        </h1>
        <p className="text-lg text-muted-foreground font-medium">
          Dairy Manager
        </p>

        {/* Admin auth image OR fallback */}
        <div className="mt-6 relative mx-auto max-w-[280px]">
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
          {authImageUrl ? (
            <img 
              src={authImageUrl} 
              alt="Dairy" 
              className="w-full h-auto max-h-[200px] object-contain rounded-3xl shadow-xl animate-fade-in mx-auto"
            />
          ) : (
            <div className="w-full h-[180px] bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl flex items-center justify-center">
              <span className="text-6xl">🥛</span>
            </div>
          )}
        </div>
      </div>

      {/* Language Selection */}
      <div className="flex-1 px-4 pb-8 -mt-8 relative z-20">
        <div className="max-w-md mx-auto animate-slide-up">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-1">
              अपनी भाषा चुनें
            </h2>
            <p className="text-muted-foreground">
              Choose your language
            </p>
          </div>

          <div className="space-y-3">
            {languages.map((lang, index) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className="w-full dairy-card p-5 flex items-center gap-4 hover:border-primary/50 hover:shadow-lg active:scale-[0.98] transition-all duration-200 border-2 border-transparent group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 bg-gradient-to-br from-primary/15 to-primary/5 rounded-2xl flex items-center justify-center group-hover:from-primary/25 group-hover:to-primary/10 transition-all">
                  <span className="text-3xl">{lang.emoji}</span>
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-xl font-bold text-foreground">{lang.nativeName}</h3>
                  <p className="text-muted-foreground">{lang.name}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <span className="text-lg">→</span>
                </div>
              </button>
            ))}
          </div>

          {/* Friendly message */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              🥛 दूध का हिसाब अब आसान है!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Milk accounting made simple!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelect;
