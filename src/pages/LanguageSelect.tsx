import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCachedAuthImage, fetchAndCacheAuthImage } from '@/utils/authImageCache';
type Language = 'hi' | 'gu' | 'en';

interface LanguageSelectProps {
  onComplete: () => void;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({ onComplete }) => {
  const { setLanguage } = useLanguage();
  const [authImageUrl, setAuthImageUrl] = useState<string | null>(getCachedAuthImage);
  const [imageLoaded, setImageLoaded] = useState(!!authImageUrl);

  useEffect(() => {
    if (!authImageUrl) {
      fetchAndCacheAuthImage().then((url) => {
        if (url) {
          setAuthImageUrl(url);
          setImageLoaded(true);
        }
      });
    }
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
      {/* Hero Section */}
      <div className="relative pt-5 pb-4 px-4 text-center">
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-primary/8 to-transparent -z-10" />
        
        {/* Auth Image or App Icon */}
        {authImageUrl && imageLoaded ? (
          <div className="flex justify-center mb-2">
            <img src={authImageUrl} alt="Dairy Manager" className="w-16 h-16 rounded-2xl object-cover shadow-lg shadow-primary/25" loading="eager" />
          </div>
        ) : (
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25">
              <span className="text-3xl">🥛</span>
            </div>
          </div>
        )}
        
        <h1 className="text-2xl font-bold text-foreground mb-0.5">
          डेयरी प्रबंधक
        </h1>
        <p className="text-sm text-muted-foreground font-medium">
          Dairy Manager
        </p>
      </div>

      {/* Language Selection */}
      <div className="flex-1 px-4 pb-4 relative z-20">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold text-foreground mb-0.5">
              अपनी भाषा चुनें
            </h2>
            <p className="text-sm text-muted-foreground">
              Choose your language
            </p>
          </div>

          <div className="space-y-2.5">
            {languages.map((lang, index) => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className="w-full dairy-card p-3.5 flex items-center gap-3 hover:border-primary/50 hover:shadow-lg active:scale-[0.98] transition-all duration-200 border-2 border-transparent group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-11 h-11 bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl flex items-center justify-center group-hover:from-primary/25 group-hover:to-primary/10 transition-all">
                  <span className="text-2xl">{lang.emoji}</span>
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-bold text-foreground">{lang.nativeName}</h3>
                  <p className="text-xs text-muted-foreground">{lang.name}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <span className="text-sm">→</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs text-muted-foreground">
              🥛 दूध का हिसाब अब आसान है!
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Milk accounting made simple!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelect;
