import { supabase } from '@/src/config/supabase';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export type UserProfile = {
  id: string;
  name: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  avatar_url?: string | null;
  notifications_enabled?: boolean;
  privacy_profile_visible?: boolean;
  privacy_posts_visible?: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null; userCreated?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInAnonymous: (name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Flag to prevent re-fetching profile during password update
  const isUpdatingPasswordRef = useRef(false);
  // Track if initial load is complete
  const initialLoadCompleteRef = useRef(false);
  // Track if profile exists (to avoid stale closure)
  const hasProfileRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchOrCreateProfile(session.user).then(() => {
          initialLoadCompleteRef.current = true;
        });
      } else {
        setLoading(false);
        initialLoadCompleteRef.current = true;
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session) => {
      if (!isMounted) return;
      
      console.log('Auth event:', event);
      
      // Always update session and user
      setSession(session);
      setUser(session?.user ?? null);
      
      // Handle different events appropriately
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        hasProfileRef.current = false;
        setLoading(false);
        isUpdatingPasswordRef.current = false;
        return;
      }
      
      // Skip profile re-fetch for USER_UPDATED if we're updating password
      // (profile data doesn't change during password update)
      if (event === 'USER_UPDATED' && isUpdatingPasswordRef.current) {
        console.log('Skipping profile fetch during password update');
        return;
      }
      
      // Skip redundant fetches after initial load for TOKEN_REFRESHED
      if (event === 'TOKEN_REFRESHED' && initialLoadCompleteRef.current && hasProfileRef.current) {
        console.log('Skipping profile fetch for token refresh');
        return;
      }
      
      if (session?.user) {
        await fetchOrCreateProfile(session.user);
      } else {
        setProfile(null);
        hasProfileRef.current = false;
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchOrCreateProfile = async (authUser: User) => {
    try {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (existingProfile) {
        setProfile(existingProfile);
        hasProfileRef.current = true;
        setLoading(false);
        return;
      }

      // Create new profile if it doesn't exist
      const newProfile = {
        id: authUser.id,
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Anonymous',
        email: authUser.email || null,
        is_admin: false,
        notifications_enabled: true,
        privacy_profile_visible: true,
        privacy_posts_visible: true,
      };

      const { data: createdProfile, error: createError } = await supabase
        .from('users')
        .insert([newProfile])
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
      } else {
        setProfile(createdProfile);
        hasProfileRef.current = true;
      }
    } catch (error) {
      console.error('Error in fetchOrCreateProfile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setProfile(data);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile?.id) {
      return { error: new Error('No profile found') };
    }

    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', profile.id);

      if (error) {
        return { error: error as Error };
      }

      // Update local state
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ error: Error | null }> => {
    if (!newPassword || newPassword.length < 6) {
      return { error: new Error('Password must be at least 6 characters') };
    }

    // Set flag to prevent auth listener from re-fetching profile
    isUpdatingPasswordRef.current = true;

    try {
      // Quick session check - password reset should have established session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        isUpdatingPasswordRef.current = false;
        return { error: new Error('Session not found. Please restart the password reset process.') };
      }

      // Update password with timeout protection
      const updatePromise = supabase.auth.updateUser({
        password: newPassword,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Password update request timed out')), 8000)
      );

      const { data, error } = await Promise.race([updatePromise, timeoutPromise]) as any;

      if (error) {
        isUpdatingPasswordRef.current = false;
        return { error: error as Error };
      }

      // Clear the flag
      isUpdatingPasswordRef.current = false;

      return { error: null };
    } catch (error: any) {
      console.error('Unexpected error in updatePassword:', error);
      isUpdatingPasswordRef.current = false;
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: 'https://aedrianofficial.github.io/taleforge-confirm/',
        },
      });
      
      if (data?.user?.id) {
        return { error: null, userCreated: true };
      }
      
      return { error, userCreated: false };
    } catch (error) {
      return { error: error as Error, userCreated: false };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInAnonymous = async (name: string) => {
    try {
      const { error } = await supabase.auth.signInAnonymously({
        options: {
          data: { name },
        },
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const resetPassword = async (email: string): Promise<{ error: Error | null }> => {
    try {
      // For Expo Go development, use a web redirect that can handle the deep link
      // This web page will redirect to the app using window.location.href
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://aedrianofficial.github.io/taleforge-password-reset/',
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    console.log('Signing out...');
    // Clear any pending flags
    isUpdatingPasswordRef.current = false;
    hasProfileRef.current = false;

    try {
      // Clear local state first to ensure immediate UI response
      setProfile(null);
      setUser(null);
      setSession(null);

      // Then sign out from Supabase
      await supabase.auth.signOut();
      console.log('Sign out complete');
    } catch (error) {
      console.error('Error during sign out:', error);
      // Still clear local state even if Supabase call fails
      setProfile(null);
      setUser(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signUp,
        signIn,
        signInAnonymous,
        signOut,
        updateProfile,
        updatePassword,
        resetPassword,
        refreshProfile,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
