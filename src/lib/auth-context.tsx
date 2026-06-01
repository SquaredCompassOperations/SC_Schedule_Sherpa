import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "team" | "client";

export type AuthState = {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  fullName: string | null;
  company: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      supabase.from("profiles").select("full_name, company").eq("id", uid).maybeSingle(),
    ]);
    setRole((roleRow?.role as AppRole | undefined) ?? "client");
    setFullName(profileRow?.full_name ?? null);
    setCompany(profileRow?.company ?? null);
  };

  useEffect(() => {
    // Synchronous listener first
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        // Defer profile fetch
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setRole(null);
        setFullName(null);
        setCompany(null);
      }
    });

    // Then existing session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        fullName,
        company,
        loading,
        signOut,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
