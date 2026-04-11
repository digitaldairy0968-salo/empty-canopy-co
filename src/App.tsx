import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DairyProvider } from "@/contexts/DairyContext";


import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DairySetup from "./pages/DairySetup";

import Dashboard from "./pages/Dashboard";
import SupplierDashboard from "./pages/SupplierDashboard";
import Suppliers from "./pages/Suppliers";
import AddSupplier from "./pages/AddSupplier";
import SupplierCard from "./pages/SupplierCard";
import SupplierViewCard from "./pages/SupplierViewCard";
import MilkEntry from "./pages/MilkEntry";
import HisaabReport from "./pages/HisaabReport";
import CustomerHistory from "./pages/CustomerHistory";
import Calculator from "./pages/Calculator";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import FatSnfRateSetup from "./pages/FatSnfRateSetup";
import SupplierSettings from "./pages/SupplierSettings";
import Announcements from "./pages/Announcements";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import AdminDairyFeatures from "./pages/AdminDairyFeatures";
import AdminVarieties from "./pages/AdminVarieties";
import PaymentRequired from "./pages/PaymentRequired";
import SubscriptionRenewal from "./pages/SubscriptionRenewal";
import NotFound from "./pages/NotFound";
import { useState, useEffect } from "react";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// No loading screen - use cached data for instant access

// Protected Route Component for Admin - with loading check
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, authUser } = useAuth();
  
  if (authUser && !user) {
    return null; // Don't show spinner, wait silently
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

// Protected Route Component for Owner (with subscription check)
// Uses cache-first approach — show content immediately, check in background
const OwnerRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, authUser, isAdmin } = useAuth();
  
  // Initialize from cache immediately — no loading state
  const [subStatus, setSubStatus] = useState<'active' | 'expired' | 'none'>(() => {
    if (isAdmin) return 'active';
    const cached = localStorage.getItem('subscription_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.status || 'active';
      } catch {}
    }
    return 'active'; // Assume active, verify in background
  });

  useEffect(() => {
    let isMounted = true;
    const checkSubscription = async () => {
      if (!user?.dairyId || isAdmin) return;

      // Check if cache is fresh (valid for 5 minutes)
      const cached = localStorage.getItem('subscription_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 300000) {
            if (isMounted) setSubStatus(parsed.status);
            return;
          }
        } catch {}
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, expires_at')
        .eq('dairy_id', user.dairyId)
        .maybeSingle();

      if (!isMounted) return;

      if (error || !data) {
        setSubStatus('none');
        localStorage.setItem('subscription_cache', JSON.stringify({ status: 'none', timestamp: Date.now() }));
        return;
      }

      const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
      const status = (data.status === 'active' && !isExpired) ? 'active' : 'expired';
      setSubStatus(status);
      localStorage.setItem('subscription_cache', JSON.stringify({ status, timestamp: Date.now() }));
    };

    checkSubscription();
    return () => { isMounted = false; };
  }, [user?.dairyId, isAdmin]);

  if (authUser && !user) {
    return null; // Don't show spinner
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (subStatus === 'expired' || subStatus === 'none') {
    return <Navigate to="/payment-required" replace />;
  }

  return <>{children}</>;
};

// Protected Route Component for Supplier
const SupplierRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, authUser } = useAuth();

  if (authUser && !user) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

// Protected Route for authenticated users (any role)
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, authUser, user } = useAuth();
  if (authUser && !user) return null;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

// Dairy Setup Route - only for users without dairy
const DairySetupRoute = () => {
  const { isAuthenticated, user, isAdmin, refreshProfile, authUser } = useAuth();
  const [hasRefreshed, setHasRefreshed] = useState(false);
  
  useEffect(() => {
    let isMounted = true;
    const refresh = async () => {
      if (isAuthenticated && !hasRefreshed) {
        await refreshProfile();
        if (isMounted) {
          setHasRefreshed(true);
        }
      }
    };
    refresh();
    return () => { isMounted = false; };
  }, [isAuthenticated, hasRefreshed]);
  
  if (authUser && !user) return null;
  
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  
  // If user already has a dairy, redirect to appropriate dashboard
  if (user?.dairyId) {
    if (user.role === 'supplier') {
      return <Navigate to="/supplier-dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  
  return <DairySetup />;
};

// Smart redirect after login - with loading state
const AuthRedirect = () => {
  const { isAuthenticated, user, authUser, isAdmin } = useAuth();
  
  // Check if this is a password recovery redirect - always show Auth for recovery
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const isRecovery = hashParams.get('type') === 'recovery' && hashParams.get('access_token');
  if (isRecovery) {
    return <Auth />;
  }

  // Check if onboarding steps are pending (rate-setup or owner-onboarding)
  const pendingRateSetup = localStorage.getItem('pending_rate_setup');
  const pendingOnboarding = localStorage.getItem('pending_owner_onboarding');
  if (pendingRateSetup || pendingOnboarding) {
    return <Auth />;
  }
  
  if (authUser && !user) return null;
  if (!isAuthenticated) return <Auth />;

  // Route based on role
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  
  if (user?.role === 'supplier') {
    return <Navigate to={user.dairyId ? '/supplier-dashboard' : '/dairy-setup'} replace />;
  }
  
  if (user?.role === 'owner') {
    if (!user.dairyId) {
      return <Navigate to="/dairy-setup" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Navigate to="/dashboard" replace />;
};

const AppRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/auth" element={<PageTransition><AuthRedirect /></PageTransition>} />
        <Route path="/dairy-setup" element={<PageTransition><DairySetupRoute /></PageTransition>} />
        
        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <PageTransition><AdminDashboard /></PageTransition>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/subscriptions"
          element={
            <AdminRoute>
              <PageTransition><AdminSubscriptions /></PageTransition>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/dairy-features/:dairyId"
          element={
            <AdminRoute>
              <PageTransition><AdminDairyFeatures /></PageTransition>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/varieties"
          element={
            <AdminRoute>
              <PageTransition><AdminVarieties /></PageTransition>
            </AdminRoute>
          }
        />
        
        
        {/* Payment Required Route */}
        <Route
          path="/payment-required"
          element={
            <ProtectedRoute>
              <PageTransition><PaymentRequired /></PageTransition>
            </ProtectedRoute>
          }
        />

        {/* Subscription Renewal (from owner settings) */}
        <Route
          path="/subscription-renewal"
          element={
            <OwnerRoute>
              <PageTransition><SubscriptionRenewal /></PageTransition>
            </OwnerRoute>
          }
        />
        
        {/* Owner Routes */}
        <Route
          path="/dashboard"
          element={
            <OwnerRoute>
              <PageTransition><Dashboard /></PageTransition>
            </OwnerRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <OwnerRoute>
              <PageTransition><Suppliers /></PageTransition>
            </OwnerRoute>
          }
        />
        <Route
          path="/add-supplier"
          element={
            <OwnerRoute>
              <PageTransition><AddSupplier /></PageTransition>
            </OwnerRoute>
          }
        />
        <Route
          path="/supplier/:id"
          element={
            <OwnerRoute>
              <PageTransition><SupplierCard /></PageTransition>
            </OwnerRoute>
          }
        />
        <Route
          path="/milk-entry"
          element={
            <OwnerRoute>
              <PageTransition><MilkEntry /></PageTransition>
            </OwnerRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <OwnerRoute>
              <PageTransition><Reports /></PageTransition>
            </OwnerRoute>
          }
        />
        <Route
          path="/hisaab-report"
          element={
            <OwnerRoute>
              <PageTransition><HisaabReport /></PageTransition>
            </OwnerRoute>
          }
        />
        <Route
          path="/customer-history"
          element={
            <OwnerRoute>
              <PageTransition><CustomerHistory /></PageTransition>
            </OwnerRoute>
          }
        />
        <Route
          path="/announcements"
          element={
            <OwnerRoute>
              <PageTransition><Announcements /></PageTransition>
            </OwnerRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <OwnerRoute>
              <PageTransition><Settings /></PageTransition>
            </OwnerRoute>
          }
        />
        <Route
          path="/fat-snf-rate-setup"
          element={
            <OwnerRoute>
              <PageTransition><FatSnfRateSetup /></PageTransition>
            </OwnerRoute>
          }
        />
        
        {/* Supplier Routes */}
        <Route
          path="/supplier-dashboard"
          element={
            <SupplierRoute>
              <PageTransition><SupplierDashboard /></PageTransition>
            </SupplierRoute>
          }
        />
        <Route
          path="/supplier-view/:id"
          element={
            <SupplierRoute>
              <PageTransition><SupplierViewCard /></PageTransition>
            </SupplierRoute>
          }
        />
        <Route
          path="/supplier-settings"
          element={
            <SupplierRoute>
              <PageTransition><SupplierSettings /></PageTransition>
            </SupplierRoute>
          }
        />
        
        {/* Shared Routes */}
        <Route
          path="/calculator"
          element={
            <ProtectedRoute>
              <PageTransition><Calculator /></PageTransition>
            </ProtectedRoute>
          }
        />
        
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <DairyProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </DairyProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;