import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DairyProvider } from "@/contexts/DairyContext";
import React, { Suspense, useState, useEffect, lazy } from "react";

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DairySetup from "./pages/DairySetup";

// Lazy load all heavy pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SupplierDashboard = lazy(() => import("./pages/SupplierDashboard"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const AddSupplier = lazy(() => import("./pages/AddSupplier"));
const SupplierCard = lazy(() => import("./pages/SupplierCard"));
const SupplierViewCard = lazy(() => import("./pages/SupplierViewCard"));
const MilkEntry = lazy(() => import("./pages/MilkEntry"));
const HisaabReport = lazy(() => import("./pages/HisaabReport"));
const CustomerHistory = lazy(() => import("./pages/CustomerHistory"));
const Calculator = lazy(() => import("./pages/Calculator"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const FatSnfRateSetup = lazy(() => import("./pages/FatSnfRateSetup"));
const SupplierSettings = lazy(() => import("./pages/SupplierSettings"));
const Announcements = lazy(() => import("./pages/Announcements"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminSubscriptions = lazy(() => import("./pages/AdminSubscriptions"));
const AdminDairyFeatures = lazy(() => import("./pages/AdminDairyFeatures"));
const AdminVarieties = lazy(() => import("./pages/AdminVarieties"));
const PaymentRequired = lazy(() => import("./pages/PaymentRequired"));
const SubscriptionRenewal = lazy(() => import("./pages/SubscriptionRenewal"));
const NotFound = lazy(() => import("./pages/NotFound"));


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
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<AuthRedirect />} />
        <Route path="/dairy-setup" element={<DairySetupRoute />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
        <Route path="/admin/dairy-features/:dairyId" element={<AdminRoute><AdminDairyFeatures /></AdminRoute>} />
        <Route path="/admin/varieties" element={<AdminRoute><AdminVarieties /></AdminRoute>} />
        
        {/* Payment Required Route */}
        <Route path="/payment-required" element={<ProtectedRoute><PaymentRequired /></ProtectedRoute>} />
        <Route path="/subscription-renewal" element={<OwnerRoute><SubscriptionRenewal /></OwnerRoute>} />
        
        {/* Owner Routes */}
        <Route path="/dashboard" element={<OwnerRoute><Dashboard /></OwnerRoute>} />
        <Route path="/suppliers" element={<OwnerRoute><Suppliers /></OwnerRoute>} />
        <Route path="/add-supplier" element={<OwnerRoute><AddSupplier /></OwnerRoute>} />
        <Route path="/supplier/:id" element={<OwnerRoute><SupplierCard /></OwnerRoute>} />
        <Route path="/milk-entry" element={<OwnerRoute><MilkEntry /></OwnerRoute>} />
        <Route path="/reports" element={<OwnerRoute><Reports /></OwnerRoute>} />
        <Route path="/hisaab-report" element={<OwnerRoute><HisaabReport /></OwnerRoute>} />
        <Route path="/customer-history" element={<OwnerRoute><CustomerHistory /></OwnerRoute>} />
        <Route path="/announcements" element={<OwnerRoute><Announcements /></OwnerRoute>} />
        <Route path="/settings" element={<OwnerRoute><Settings /></OwnerRoute>} />
        <Route path="/fat-snf-rate-setup" element={<OwnerRoute><FatSnfRateSetup /></OwnerRoute>} />
        
        {/* Supplier Routes */}
        <Route path="/supplier-dashboard" element={<SupplierRoute><SupplierDashboard /></SupplierRoute>} />
        <Route path="/supplier-view/:id" element={<SupplierRoute><SupplierViewCard /></SupplierRoute>} />
        <Route path="/supplier-settings" element={<SupplierRoute><SupplierSettings /></SupplierRoute>} />
        
        {/* Shared Routes */}
        <Route path="/calculator" element={<ProtectedRoute><Calculator /></ProtectedRoute>} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
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