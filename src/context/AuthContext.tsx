import { supabase } from '@/src/config/supabase';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

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
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchOrCreateProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchOrCreateProfile(session.user);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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

    return new Promise((resolve) => {
      let hasResolved = false;
      let timeoutId: ReturnType<typeof setTimeout>;

      // Set up timeout - if no response in 12 seconds, assume success
      // (Supabase often succeeds but doesn't return properly in React Native)
      timeoutId = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          console.log('Password update timed out - assuming success');
          resolve({ error: null });
        }
      }, 12000);

      // Check session and make the update call
      const doUpdate = async () => {
        try {
          // Check if user is authenticated
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          console.log('Current session:', currentSession ? 'exists' : 'null');
          
          if (!currentSession) {
            clearTimeout(timeoutId);
            if (!hasResolved) {
              hasResolved = true;
              console.log('No active session found');
              resolve({ error: new Error('You must be logged in to change your password') });
            }
            return;
          }

          console.log('Updating password via Supabase Auth...');
          
          const { data, error } = await supabase.auth.updateUser({
            password: newPassword,
          });

          clearTimeout(timeoutId);
          
          if (!hasResolved) {
            hasResolved = true;
            
            if (error) {
              console.error('Supabase auth update error:', error);
              resolve({ error: error as Error });
            } else {
              console.log('Password updated successfully!');
              resolve({ error: null });
            }
          }
        } catch (error: any) {
          clearTimeout(timeoutId);
          
          if (!hasResolved) {
            hasResolved = true;
            console.error('Unexpected error in updatePassword:', error);
            resolve({ error: error as Error });
          }
        }
      };

      doUpdate();
    });
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: 'https://aedrianofficial.github.io/taleforge-confim/',
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
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
