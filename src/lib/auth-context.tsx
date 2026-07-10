import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearGoogleProviderTokens, persistGoogleProviderTokens } from "@/lib/google-auth";
import { clearProtectedWorkspaceQueries } from "@/lib/offer-workspace-query";
import { normalizeAppRole, type AppRole } from "@/lib/rbac";

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
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionUserIdRef = useRef<string | null | undefined>(undefined);

  const loadProfile = async (uid: string) => {
    const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
      supabase.from("profiles").select("full_name, company").eq("id", uid).maybeSingle(),
    ]);
    setRole(normalizeAppRole(roleRow?.role));
    setFullName(profileRow?.full_name ?? null);
    setCompany(profileRow?.company ?? null);
  };

  useEffect(() => {
    const syncSession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (sessionUserIdRef.current !== nextUserId) {
        clearProtectedWorkspaceQueries(queryClient);
        sessionUserIdRef.current = nextUserId;
      }
      setSession(nextSession);
    };

    // Synchronous listener first
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      syncSession(s);
      if (event === "SIGNED_OUT") {
        clearGoogleProviderTokens();
      } else {
        persistGoogleProviderTokens(s);
      }
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
      syncSession(data.session);
      persistGoogleProviderTokens(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const signOut = async () => {
    clearProtectedWorkspaceQueries(queryClient);
    sessionUserIdRef.current = null;
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
