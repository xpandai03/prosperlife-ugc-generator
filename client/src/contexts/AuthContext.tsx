import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ user: User | null; error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Skip email confirmation for MVP
          // Note: This only works if auto-confirm is enabled in Supabase Dashboard
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Signup failed",
          description: error.message,
        });
        return { user: null, error };
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        toast({
          title: "Check your email",
          description: "Please check your email to confirm your account before logging in.",
        });
      } else {
        toast({
          title: "Account created",
          description: "You have successfully signed up and are now logged in.",
        });
      }

      return { user: data.user, error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        variant: "destructive",
        title: "Signup failed",
        description: authError.message || "An unexpected error occurred",
      });
      return { user: null, error: authError };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Special handling for email not confirmed error
        if (error.message.toLowerCase().includes('email not confirmed')) {
          toast({
            variant: "destructive",
            title: "Email not confirmed",
            description: "Please check your email and click the confirmation link. If auto-confirm is enabled, contact support.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Login failed",
            description: error.message,
          });
        }
        return { user: null, error };
      }

      toast({
        title: "Welcome back",
        description: "You have successfully logged in.",
      });

      return { user: data.user, error: null };
    } catch (error) {
      const authError = error as AuthError;
      toast({
        variant: "destructive",
        title: "Login failed",
        description: authError.message || "An unexpected error occurred",
      });
      return { user: null, error: authError };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          variant: "destructive",
          title: "Logout failed",
          description: error.message,
        });
        return;
      }

      toast({
        title: "Logged out",
        description: "You have successfully logged out.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Logout failed",
        description: "An unexpected error occurred",
      });
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
