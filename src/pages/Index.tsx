import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LanguageSelect from './LanguageSelect';

const Index = () => {
  const { isAuthenticated, user, authUser, isLoading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showLanguageSelect, setShowLanguageSelect] = useState(false);

  useEffect(() => {
    // Check if first-time user (no language selected yet)
    const hasSelectedLanguage = localStorage.getItem('has_selected_language');
    if (!hasSelectedLanguage) {
      setShowLanguageSelect(true);
      return;
    }

    if (isLoading) return;
    if (authUser && !user) return;

    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }

    // Admin goes to admin dashboard
    if (isAdmin) {
      navigate('/admin', { replace: true });
      return;
    }

    // Supplier goes to supplier dashboard (if has dairy)
    if (user?.role === 'supplier') {
      if (user.dairyId) {
        navigate('/supplier-dashboard', { replace: true });
      } else {
        navigate('/dairy-setup', { replace: true });
      }
      return;
    }

    // Owner: check if dairy is set up
    if (user?.role === 'owner') {
      if (!user.dairyId) {
        // Check if onboarding steps are pending
        const pendingRateSetup = localStorage.getItem('pending_rate_setup');
        const pendingOnboarding = localStorage.getItem('pending_owner_onboarding');
        
        if (pendingRateSetup || pendingOnboarding) {
          // Send back to auth to complete onboarding steps
          navigate('/auth', { replace: true });
        } else {
          navigate('/dairy-setup', { replace: true });
        }
        return;
      }
      
      navigate('/dashboard', { replace: true });
      return;
    }

    // Fallback
    navigate('/dashboard', { replace: true });
  }, [isAuthenticated, user, authUser, isLoading, isAdmin, navigate, showLanguageSelect]);

  if (showLanguageSelect) {
    return (
      <LanguageSelect 
        onComplete={() => {
          setShowLanguageSelect(false);
          // After language selection, navigate to auth
          navigate('/auth', { replace: true });
        }} 
      />
    );
  }

  return null;
};

export default Index;
