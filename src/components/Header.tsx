import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, Calculator, Menu, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCachedAuthImage, fetchAndCacheAuthImage } from '@/utils/authImageCache';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [authImageUrl, setAuthImageUrl] = useState<string | null>(getCachedAuthImage);

  useEffect(() => {
    if (!authImageUrl) {
      fetchAndCacheAuthImage().then((url) => {
        if (url) setAuthImageUrl(url);
      });
    }
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <header className="dairy-header sticky top-0 z-50 px-3 py-2.5 shadow-lg">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-2.5">
          {authImageUrl ? (
            <img src={authImageUrl} alt="Dairy" className="w-9 h-9 rounded-xl object-cover shadow-sm" />
          ) : (
            <div className="w-9 h-9 bg-primary-foreground/20 rounded-xl flex items-center justify-center shadow-sm backdrop-blur-sm">
              <Droplets className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-base font-bold flex items-center gap-1">
              {t('appName')}
              <span className="text-sm">✨</span>
            </h1>
            {user && (
              <p className="text-[10px] text-primary-foreground/80 font-medium -mt-0.5">
                {t('welcome')}, {user.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate('/calculator')}
            className="text-primary-foreground hover:bg-primary-foreground/15 rounded-xl h-8 w-8"
          >
            <Calculator className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-primary-foreground hover:bg-primary-foreground/15 rounded-xl h-8 w-8"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 p-1.5 bg-popover border border-border/60 shadow-xl rounded-2xl">
              <DropdownMenuItem 
                onClick={() => navigate('/settings')}
                className="rounded-xl py-2.5 px-3 cursor-pointer font-medium text-sm"
              >
                <Settings className="mr-2.5 h-4 w-4" />
                {t('settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-0.5" />
              <DropdownMenuItem 
                onClick={handleLogout} 
                className="rounded-xl py-2.5 px-3 cursor-pointer text-destructive font-medium text-sm focus:text-destructive"
              >
                <LogOut className="mr-2.5 h-4 w-4" />
                {t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
