import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, Calculator, Menu, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const [authImageUrl, setAuthImageUrl] = useState<string | null>(() => {
    return sessionStorage.getItem('auth_page_image_url') || null;
  });

  useEffect(() => {
    if (!authImageUrl) {
      import('@/integrations/supabase/client').then(({ supabase }) => {
        supabase.from('subscription_settings').select('auth_page_image_url').limit(1).maybeSingle().then(({ data }) => {
          if (data?.auth_page_image_url) {
            setAuthImageUrl(data.auth_page_image_url);
            sessionStorage.setItem('auth_page_image_url', data.auth_page_image_url);
          }
        });
      });
    }
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <header className="dairy-header sticky top-0 z-50 px-4 py-4 shadow-lg">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          {authImageUrl ? (
            <img src={authImageUrl} alt="Dairy" className="w-12 h-12 rounded-2xl object-cover shadow-sm" />
          ) : (
            <div className="w-12 h-12 bg-primary-foreground/20 rounded-2xl flex items-center justify-center shadow-sm backdrop-blur-sm">
              <Droplets className="w-6 h-6 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold flex items-center gap-1.5">
              {t('appName')}
              <span className="text-lg">✨</span>
            </h1>
            {user && (
              <p className="text-xs text-primary-foreground/80 font-medium">
                {t('welcome')}, {user.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate('/calculator')}
            className="text-primary-foreground hover:bg-primary-foreground/15 rounded-xl"
          >
            <Calculator className="h-5 w-5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-primary-foreground hover:bg-primary-foreground/15 rounded-xl"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 p-2 bg-popover border border-border/60 shadow-xl rounded-2xl">
              <DropdownMenuItem 
                onClick={() => navigate('/settings')}
                className="rounded-xl py-3 px-3 cursor-pointer font-medium"
              >
                <Settings className="mr-3 h-4 w-4" />
                {t('settings')}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem 
                onClick={handleLogout} 
                className="rounded-xl py-3 px-3 cursor-pointer text-destructive font-medium focus:text-destructive"
              >
                <LogOut className="mr-3 h-4 w-4" />
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
