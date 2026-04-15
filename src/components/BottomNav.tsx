import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, Settings, Calculator, History } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const reportLabel = language === 'hi' ? 'रिपोर्ट' : language === 'gu' ? 'રિપોર્ટ' : 'Reports';
  const historyLabel = language === 'hi' ? 'ग्राहक हिस्ट्री' : language === 'gu' ? 'ગ્રાહક હિસ્ટ્રી' : 'Customer History';

  const ownerNavItems = [
    { path: '/dashboard', icon: Home, label: t('home') },
    { path: '/customer-history', icon: History, label: historyLabel },
    { path: '/reports', icon: Calculator, label: reportLabel },
    { path: '/hisaab-report', icon: FileText, label: language === 'hi' ? 'भुगतान' : language === 'gu' ? 'ચુકવણી' : 'Payment' },
    { path: '/settings', icon: Settings, label: t('settings') },
  ];

  const supplierNavItems = [
    { path: '/supplier-dashboard', icon: Home, label: t('home') },
    { path: '/supplier-settings', icon: Settings, label: t('settings') },
  ];

  const navItems = user?.role === 'supplier' ? supplierNavItems : ownerNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/98 backdrop-blur-xl border-t border-border/60 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)] z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto py-1.5 px-1">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={`${item.path}-${index}`}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-300 min-w-[48px]',
                isActive
                  ? 'text-primary bg-primary/12'
                  : 'text-muted-foreground hover:text-foreground active:scale-95'
              )}
            >
              <item.icon className="h-4.5 w-4.5" strokeWidth={isActive ? 2.5 : 2} style={{ width: 18, height: 18 }} />
              <span className={cn(
                'text-[9px] font-medium leading-tight',
                isActive && 'font-semibold text-primary'
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="h-safe-area-inset-bottom bg-card" />
    </nav>
  );
};

export default BottomNav;
