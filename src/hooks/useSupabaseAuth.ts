import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'owner' | 'supplier';

export interface UserProfile {
  id: string;
  userId: string;
  phone: string;
  name: string;
  role: UserRole;
  dairyId?: string;
  dairyName?: string;
  dairyCode?: string;
}

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Get profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      // Get role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching role:', roleError);
      }

      // Get dairy info (as owner or supplier)
      let dairyId: string | undefined;
      let dairyName: string | undefined;
      let dairyCode: string | undefined;

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
        }
      }

      setProfile({
        id: profileData?.id || '',
        userId: userId,
        phone: profileData?.phone || '',
        name: profileData?.name || '',
        role: (roleData?.role as UserRole) || 'owner',
        dairyId,
        dairyName,
        dairyCode,
      });
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    phone: string,
    name: string,
    role: UserRole
  ): Promise<{ error: string | null }> => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          phone,
          name,
          role,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id);
    }
  };

  return {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  };
}
