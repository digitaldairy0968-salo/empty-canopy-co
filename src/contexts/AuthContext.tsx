import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

type UserRole = 'owner' | 'supplier' | 'admin';

const ADMIN_EMAIL = 'vishnugurjarsimal0968@gmail.com';

interface UserProfile {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  dairyId?: string;
  dairyName?: string;
  dairyCode?: string;
  hasSeenOnboarding?: boolean;
}

interface AuthDiagnostics {
  supabaseUrl: string;
  anonKeyLength: number;
  envOk: boolean;
  preAuthFetchUrl: string;
  preAuthFetchStatus: 'pending' | 'success' | 'failed';
  preAuthFetchHttpStatus?: number;
  preAuthFetchError?: string;
  lastRequestUrl?: string;
  lastRequestStatus?: number;
  lastRequestError?: string;
  lastRequestBlockedHint?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  authUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  authDiagnostics: AuthDiagnostics;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string, phone: string, role: UserRole, referralCode?: string) => Promise<{ success: boolean; error?: string }>;
  setupDairy: (dairyName: string, dairyCode: string) => Promise<boolean>;
  joinDairy: (dairyCode: string) => Promise<boolean | string>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setHasSeenOnboarding: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Local storage cache keys
const CACHE_KEY_USER = 'dairy_app_user_cache';
const CACHE_KEY_AUTH = 'dairy_app_auth_cache';
const CACHE_KEY_ONBOARDING = 'dairy_app_onboarding_seen';

const SUPABASE_URL_RUNTIME = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY_RUNTIME = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load from cache immediately - no waiting
  const cachedUser = localStorage.getItem(CACHE_KEY_USER);
  const cachedAuth = localStorage.getItem(CACHE_KEY_AUTH);

  const safeParse = <T,>(value: string | null): T | null => {
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  };

  // IMPORTANT: prevent mismatched cached profile (old user) from being used with a new auth session.
  const initialAuthUser = safeParse<User>(cachedAuth);
  const initialUser = safeParse<UserProfile>(cachedUser);
  const cacheUserIsValid = !!initialAuthUser && !!initialUser && initialUser.id === initialAuthUser.id;

  const [authUser, setAuthUser] = useState<User | null>(() => initialAuthUser);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(() => (cacheUserIsValid ? initialUser : null));
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authDiagnostics, setAuthDiagnostics] = useState<AuthDiagnostics>({
    supabaseUrl: SUPABASE_URL_RUNTIME,
    anonKeyLength: SUPABASE_ANON_KEY_RUNTIME.length,
    envOk: Boolean(SUPABASE_URL_RUNTIME && SUPABASE_ANON_KEY_RUNTIME),
    preAuthFetchUrl: SUPABASE_URL_RUNTIME ? `${SUPABASE_URL_RUNTIME}/rest/v1/` : '',
    preAuthFetchStatus: 'pending',
  });

  const isLoading = !isAuthReady;

  const detectBlockingHint = (message?: string) => {
    const raw = (message || '').toLowerCase();
    if (raw.includes('cors')) return 'Possible CORS blocking';
    if (raw.includes('iframe')) return 'Possible iframe/network policy blocking';
    if (raw.includes('failed to fetch') || raw.includes('network')) return 'Network or environment injection issue';
    return undefined;
  };

  const updateLastAuthRequest = (
    url: string,
    status?: number,
    error?: string,
    blockedHint?: string
  ) => {
    setAuthDiagnostics((prev) => ({
      ...prev,
      lastRequestUrl: url,
      lastRequestStatus: status,
      lastRequestError: error,
      lastRequestBlockedHint: blockedHint,
    }));
  };

  // If we detect bad cache at startup, clear it so routing can't misidentify role.
  useEffect(() => {
    if (initialAuthUser && initialUser && initialUser.id !== initialAuthUser.id) {
      localStorage.removeItem(CACHE_KEY_USER);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save user and authUser to cache whenever they change
  useEffect(() => {
    if (user) {
      localStorage.setItem(CACHE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(CACHE_KEY_USER);
    }
  }, [user]);

  // If auth user changes (e.g., switching accounts or immediate login after signup),
  // ensure we don't keep an old cached profile that would mis-route the user.
  useEffect(() => {
    if (authUser && user && user.id !== authUser.id) {
      setUser(null);
      localStorage.removeItem(CACHE_KEY_USER);
    }
  }, [authUser?.id]);

  useEffect(() => {
    if (authUser) {
      localStorage.setItem(CACHE_KEY_AUTH, JSON.stringify(authUser));
    } else {
      localStorage.removeItem(CACHE_KEY_AUTH);
    }
  }, [authUser]);

  // Clear all cached data when session is invalid
  const clearAllCache = () => {
    setUser(null);
    setAuthUser(null);
    setSession(null);
    localStorage.removeItem(CACHE_KEY_USER);
    localStorage.removeItem(CACHE_KEY_AUTH);
    localStorage.removeItem('subscription_cache');
  };

  const getSupabaseAuthStorageKeys = () =>
    Object.keys(localStorage).filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'));

  const clearSupabaseAuthStorage = () => {
    getSupabaseAuthStorageKeys().forEach((key) => localStorage.removeItem(key));
  };

  const runPreAuthFetchTest = async () => {
    console.log('[AUTH_DIAG] SUPABASE_URL:', SUPABASE_URL_RUNTIME || '(empty)');
    console.log('[AUTH_DIAG] SUPABASE_ANON_KEY_LENGTH:', SUPABASE_ANON_KEY_RUNTIME.length);

    const envOk = Boolean(SUPABASE_URL_RUNTIME && SUPABASE_ANON_KEY_RUNTIME);
    const testUrl = SUPABASE_URL_RUNTIME ? `${SUPABASE_URL_RUNTIME}/rest/v1/` : '';

    setAuthDiagnostics((prev) => ({
      ...prev,
      supabaseUrl: SUPABASE_URL_RUNTIME,
      anonKeyLength: SUPABASE_ANON_KEY_RUNTIME.length,
      envOk,
      preAuthFetchUrl: testUrl,
      preAuthFetchStatus: 'pending',
      preAuthFetchHttpStatus: undefined,
      preAuthFetchError: undefined,
    }));

    if (!envOk) {
      setAuthDiagnostics((prev) => ({
        ...prev,
        envOk: false,
        preAuthFetchStatus: 'failed',
        preAuthFetchError: 'Missing runtime env vars (SUPABASE_URL or SUPABASE_ANON_KEY).',
      }));
      return false;
    }

    try {
      updateLastAuthRequest(testUrl);
      console.log('[AUTH_DIAG] Pre-auth fetch URL:', testUrl);
      const response = await fetch(testUrl);
      console.log('[AUTH_DIAG] Pre-auth fetch status:', response.status);
      updateLastAuthRequest(testUrl, response.status);

      // For connectivity diagnostics, any HTTP response means network path is working.
      // 401 is expected for /rest/v1/ without auth headers.
      setAuthDiagnostics((prev) => ({
        ...prev,
        preAuthFetchStatus: 'success',
        preAuthFetchHttpStatus: response.status,
        preAuthFetchError: response.status === 401
          ? 'HTTP 401 is expected for plain /rest/v1/ without auth headers.'
          : undefined,
      }));
      return true;
    } catch (error: any) {
      const rawMessage = error?.message || String(error);
      const blockedHint = detectBlockingHint(rawMessage);
      console.error('[AUTH_DIAG] Pre-auth fetch network error:', error);
      updateLastAuthRequest(testUrl, undefined, rawMessage, blockedHint);
      setAuthDiagnostics((prev) => ({
        ...prev,
        preAuthFetchStatus: 'failed',
        preAuthFetchError: rawMessage,
      }));
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initializeSession = async () => {
      const preAuthOk = await runPreAuthFetchTest();
      if (!preAuthOk) {
        clearAllCache();
        if (isMounted) setIsAuthReady(true);
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, currentSession) => {
          if (event === 'SIGNED_OUT') {
            clearAllCache();
            setIsAuthReady(true);
            return;
          }

          setSession(currentSession);
          setAuthUser(currentSession?.user ?? null);

          if (currentSession?.user) {
            setTimeout(() => {
              fetchUserProfile(currentSession.user.id, currentSession.user.email, currentSession.user.user_metadata);
            }, 0);
          } else if (event === 'INITIAL_SESSION') {
            clearAllCache();
          }

          if (event === 'INITIAL_SESSION') {
            setIsAuthReady(true);
          }
        }
      );

      authSubscription = subscription;

      try {
        const sessionUrl = `${SUPABASE_URL_RUNTIME}/auth/v1/user`;
        updateLastAuthRequest(sessionUrl);
        console.log('[AUTH_DIAG] Session check URL:', sessionUrl);

        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[AUTH_DIAG] getSession error:', error);
          updateLastAuthRequest(
            sessionUrl,
            (error as any)?.status,
            error.message,
            detectBlockingHint(error.message)
          );
          clearAllCache();
          return;
        }

        updateLastAuthRequest(sessionUrl, 200);

        if (!currentSession) {
          if (cachedAuth || cachedUser) {
            clearAllCache();
          }
          return;
        }

        setSession(currentSession);
        setAuthUser(currentSession.user);
        await fetchUserProfile(currentSession.user.id, currentSession.user.email, currentSession.user.user_metadata);
      } catch (error: any) {
        const rawMessage = error?.message || String(error);
        console.error('[AUTH_DIAG] Error restoring auth session:', error);
        updateLastAuthRequest(
          `${SUPABASE_URL_RUNTIME}/auth/v1/user`,
          undefined,
          rawMessage,
          detectBlockingHint(rawMessage)
        );
        clearAllCache();
      } finally {
        if (isMounted) setIsAuthReady(true);
      }
    };

    initializeSession();

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  // Extra safety: if the provider is hot-reloaded or state is preserved,
  // ensure we still fetch (and backfill) the profile/role for the current auth user.
  useEffect(() => {
    if (authUser && (!user || user.id !== authUser.id)) {
      fetchUserProfile(authUser.id, authUser.email, authUser.user_metadata);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  const fetchUserProfile = async (
    userId: string,
    email?: string | null,
    userMetadata?: Record<string, unknown> | null
  ) => {
    try {
      const metaName = (userMetadata?.name as string | undefined) ?? '';
      const metaPhone = (userMetadata?.phone as string | undefined) ?? '';
      const metaRole = (userMetadata?.role as UserRole | undefined) ?? undefined;

      // Get profile
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        profileData = null;
      }

      // Some environments may not have the signup trigger running; ensure profile exists.
      if (!profileData) {
        const { error: insertProfileError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            name: metaName,
            phone: metaPhone,
          });

        // Ignore duplicates; re-fetch.
        if (insertProfileError && !String(insertProfileError.message).toLowerCase().includes('duplicate')) {
          console.error('Error creating profile:', insertProfileError);
        }

        const retry = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        profileData = retry.data ?? null;
      }

      // Get role
      let { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
      }

      // Ensure role row exists (fallback) if missing.
      if (!roleData && metaRole) {
        const { error: upsertRoleError } = await supabase
          .from('user_roles')
          .upsert(
            { user_id: userId, role: metaRole as any },
            { onConflict: 'user_id,role' }
          );

        if (upsertRoleError && !String(upsertRoleError.message).toLowerCase().includes('duplicate')) {
          console.error('Error creating role:', upsertRoleError);
        }

        const retryRole = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle();
        roleData = retryRole.data ?? null;
      }

      // Determine role - admin if email matches
      let role: UserRole = (roleData?.role as UserRole) || metaRole || 'owner';
      if (email === ADMIN_EMAIL) {
        role = 'admin';
      }

      // Get dairy info (as owner or supplier)
      let dairyId: string | undefined;
      let dairyName: string | undefined;
      let dairyCode: string | undefined;

      if (role !== 'admin') {
        // Check if user is dairy owner
        const { data: ownedDairy } = await supabase
          .from('dairies')
          .select('id, name, code')
          .eq('owner_id', userId)
          .maybeSingle();

        if (ownedDairy) {
          dairyId = ownedDairy.id;
          dairyName = ownedDairy.name;
          dairyCode = ownedDairy.code;
        } else {
          // Check if user is a supplier with linked account
          const { data: supplierData } = await supabase
            .from('suppliers')
            .select('dairy_id, dairies(name, code)')
            .eq('user_id', userId)
            .maybeSingle();

          if (supplierData) {
            dairyId = supplierData.dairy_id;
            const dairy = supplierData.dairies as unknown as { name: string; code: string };
            dairyName = dairy?.name;
            dairyCode = dairy?.code;
          } else if (role === 'supplier' && profileData?.phone) {
            // Auto-link supplier by phone number if not already linked
            const { data: unlinkedSupplier } = await supabase
              .from('suppliers')
              .select('id, dairy_id, dairies(name, code)')
              .eq('phone', profileData.phone)
              .is('user_id', null)
              .maybeSingle();

            if (unlinkedSupplier) {
              // Link the supplier record to this user
              await supabase
                .from('suppliers')
                .update({ user_id: userId })
                .eq('id', unlinkedSupplier.id);

              dairyId = unlinkedSupplier.dairy_id;
              const dairy = unlinkedSupplier.dairies as unknown as { name: string; code: string };
              dairyName = dairy?.name;
              dairyCode = dairy?.code;
            }
          }
        }
      }

      // Check if user has seen onboarding
      const hasSeenOnboarding = localStorage.getItem(CACHE_KEY_ONBOARDING) === 'true';

      setUser({
        id: userId,
        phone: (profileData as any)?.phone || metaPhone || '',
        name: (profileData as any)?.name || metaName || '',
        role,
        dairyId,
        dairyName,
        dairyCode,
        hasSeenOnboarding,
      });
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (authDiagnostics.preAuthFetchStatus === 'failed') {
      return {
        success: false,
        error: `Pre-auth fetch failed: ${authDiagnostics.preAuthFetchError || 'Unknown network error'}`,
      };
    }

    try {
      const requestUrl = `${SUPABASE_URL_RUNTIME}/auth/v1/token?grant_type=password`;
      console.log('[AUTH_DIAG] Login request URL:', requestUrl);
      updateLastAuthRequest(requestUrl);

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        const status = (error as any)?.status;
        const blockedHint = detectBlockingHint(error.message);
        console.error('[AUTH_DIAG] Login error:', { url: requestUrl, status, error: error.message, blockedHint });
        updateLastAuthRequest(requestUrl, status, error.message, blockedHint);
        return { success: false, error: error.message };
      }

      updateLastAuthRequest(requestUrl, 200);
      console.log('[AUTH_DIAG] Login status: 200');
      return { success: true };
    } catch (error: any) {
      const serialized = error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error;
      const message = error?.message || String(error);
      const blockedHint = detectBlockingHint(message);
      const requestUrl = `${SUPABASE_URL_RUNTIME}/auth/v1/token?grant_type=password`;

      console.error('[AUTH_DIAG] Login network exception:', { url: requestUrl, error: message, blockedHint });
      updateLastAuthRequest(requestUrl, undefined, message, blockedHint);
      return { success: false, error: message };
    }
  };

  const signup = async (email: string, password: string, name: string, phone: string, role: UserRole, referralCode?: string): Promise<{ success: boolean; error?: string }> => {
    if (authDiagnostics.preAuthFetchStatus === 'failed') {
      return {
        success: false,
        error: `Pre-auth fetch failed: ${authDiagnostics.preAuthFetchError || 'Unknown network error'}`,
      };
    }

    try {
      const requestUrl = `${SUPABASE_URL_RUNTIME}/auth/v1/signup`;
      console.log('[AUTH_DIAG] Signup request URL:', requestUrl);
      updateLastAuthRequest(requestUrl);

      const metaData: Record<string, string> = {
        phone,
        name,
        role,
      };
      if (referralCode) {
        metaData.referred_by_code = referralCode.toUpperCase();
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metaData,
        },
      });

      if (error) {
        const status = (error as any)?.status;
        console.error('[AUTH_DIAG] Signup error:', { url: requestUrl, status, error: error.message });
        updateLastAuthRequest(requestUrl, status, error.message);
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'Could not create account' };
      }

      if (data.user.identities && data.user.identities.length === 0) {
        return { success: false, error: 'This email is already registered' };
      }

      updateLastAuthRequest(requestUrl, 200);
      console.log('[AUTH_DIAG] Signup status: 200');
      return { success: true };
    } catch (error: any) {
      const serialized = error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error;
      const message = error?.message || String(error);
      const blockedHint = detectBlockingHint(message);
      const requestUrl = `${SUPABASE_URL_RUNTIME}/auth/v1/signup`;

      console.error('[AUTH_DIAG] Signup network exception:', { url: requestUrl, error: message });
      updateLastAuthRequest(requestUrl, undefined, message);
      return { success: false, error: message };
    }
  };

  const setupDairy = async (dairyName: string, dairyCode: string): Promise<boolean> => {
    if (!authUser || user?.role !== 'owner') return false;

    try {
      // Check if user already owns a dairy
      const { data: existingOwned } = await supabase
        .from('dairies')
        .select('id')
        .eq('owner_id', authUser.id)
        .maybeSingle();

      if (existingOwned) {
        console.log('User already owns a dairy');
        return false;
      }

      // If code is provided, check uniqueness
      const actualCode = dairyCode.trim() || null;
      if (actualCode) {
        const { data: codeExists, error: checkError } = await supabase
          .rpc('check_dairy_code_exists', { dairy_code: actualCode });

        if (checkError) {
          console.error('Error checking dairy code:', checkError);
          return false;
        }

        if (codeExists) {
          console.log('Dairy code already exists');
          return false;
        }
      }

      // Create new dairy (code can be null - admin will generate it later)
      const insertPayload: any = {
        name: dairyName,
        owner_id: authUser.id,
      };
      if (actualCode) {
        insertPayload.code = actualCode;
      }

      const { data: newDairy, error } = await supabase
        .from('dairies')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        console.error('Error creating dairy:', error);
        return false;
      }

      // Create rate settings using values from RateSetup (or defaults)
      const initialFatRate = parseFloat(localStorage.getItem('initial_fat_rate') || '8');
      const initialLiterRate = parseFloat(localStorage.getItem('initial_liter_rate') || '50');
      
      await supabase
        .from('rate_settings')
        .insert({
          dairy_id: newDairy.id,
          rate_type: 'per_fat',
          rate_value: initialFatRate,
          liter_rate: initialLiterRate,
        });
      
      // Clear the temporary localStorage values
      localStorage.removeItem('initial_fat_rate');
      localStorage.removeItem('initial_liter_rate');

      // Refresh profile to get dairy info
      await fetchUserProfile(authUser.id, authUser.email, authUser.user_metadata);

      return true;
    } catch (error) {
      console.error('Error in setupDairy:', error);
      return false;
    }
  };

  const joinDairy = async (dairyCode: string): Promise<boolean | string> => {
    if (!authUser || user?.role !== 'supplier') return 'अमान्य उपयोगकर्ता / Invalid user';

    try {
      // Use SECURITY DEFINER RPC that bypasses RLS to find dairy + match phone + link supplier
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('link_supplier_to_dairy_by_code' as any, { _dairy_code: dairyCode });

      if (rpcError) {
        console.error('Error in link_supplier_to_dairy_by_code:', rpcError);
        return 'डेयरी से जुड़ने में त्रुटि / Error joining dairy';
      }

      // RPC returns TABLE(linked boolean, error_code text) — array of rows
      const result = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
      const linked = result?.linked;
      const errorCode = result?.error_code;

      if (linked === true) {
        // Successfully linked! Refresh profile to get dairy info
        await fetchUserProfile(authUser.id, authUser.email, authUser.user_metadata);
        return true;
      }

      // Handle specific error codes with user-friendly messages
      if (errorCode === 'invalid_code') {
        return 'यह डेयरी कोड गलत है। कृपया सही 12 अंकों का कोड डालें। / Invalid dairy code. Please enter the correct 12-digit code.';
      }
      if (errorCode === 'phone_not_found') {
        return `आपका फोन नंबर इस डेयरी में नहीं मिला। पहले मालिक से अपना नंबर जुड़वाएं। / Your phone number is not found in this dairy. Ask the owner to add your number first.`;
      }
      if (errorCode === 'already_linked_other') {
        return 'यह नंबर पहले से किसी और अकाउंट से जुड़ा है। / This number is already linked to another account.';
      }
      if (errorCode === 'phone_missing') {
        return 'आपके अकाउंट में फोन नंबर नहीं है। / Phone number missing in your account.';
      }
      if (errorCode === 'not_supplier') {
        return 'आपका अकाउंट सप्लायर नहीं है। / Your account is not a supplier.';
      }
      if (errorCode === 'code_disabled') {
        return 'इस डेयरी का कोड अभी बंद है। डेयरी मालिक या एडमिन से संपर्क करें। / This dairy code is currently disabled. Contact dairy owner or admin.';
      }

      return 'कुछ गलत हो गया / Something went wrong';
    } catch (error) {
      console.error('Error in joinDairy:', error);
      return 'कुछ गलत हो गया / Something went wrong';
    }
  };

  const logout = async () => {
    // Clear state and cache FIRST for instant UI response
    setUser(null);
    setAuthUser(null);
    setSession(null);
    localStorage.removeItem(CACHE_KEY_USER);
    localStorage.removeItem(CACHE_KEY_AUTH);
    localStorage.removeItem(CACHE_KEY_ONBOARDING);
    localStorage.removeItem('subscription_cache');
    localStorage.removeItem('pending_rate_setup');
    localStorage.removeItem('pending_owner_onboarding');
    // Also remove persisted auth tokens directly to prevent stale refresh_token loops
    clearSupabaseAuthStorage();
    // Use local scope to avoid waiting for network call to Supabase
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // Ignore errors - we already cleared local state
    }
  };

  const setHasSeenOnboarding = () => {
    localStorage.setItem(CACHE_KEY_ONBOARDING, 'true');
    if (user) {
      setUser({ ...user, hasSeenOnboarding: true });
    }
  };

  const refreshProfile = async () => {
    if (authUser) {
      await fetchUserProfile(authUser.id, authUser.email, authUser.user_metadata);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authUser,
        // Must match ids; otherwise a stale cached profile could incorrectly show owner screens to suppliers.
        isAuthenticated: !!authUser && !!user && user.id === authUser.id,
        isLoading,
        isAdmin: user?.role === 'admin',
        authDiagnostics,
        login,
        signup,
        setupDairy,
        joinDairy,
        logout,
        refreshProfile,
        setHasSeenOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};