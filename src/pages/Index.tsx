import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { isAuthenticated, user, authUser, isLoading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
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
  }, [isAuthenticated, user, authUser, isLoading, isAdmin, navigate]);

  return null;
};

export default Index;
