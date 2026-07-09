import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { signInWithGoogle } from "@/lib/google-auth";
import { isAdminRole } from "@/lib/rbac";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — ScheduleBuilder" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user && role) {
    navigate({ to: isAdminRole(role) ? "/" : "/client", replace: true });
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setErr(error.message);
  };

  const onGoogle = async () => {
    setErr(null);
    setLoading(true);
    const { error } = await signInWithGoogle(window.location.origin);
    setLoading(false);
    if (error) setErr(error.message ?? "Google sign-in failed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm border border-border rounded-sm bg-card p-6 shadow-sm">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          ScheduleBuilder
        </div>
        <h1 className="text-2xl font-bold text-foreground mt-1">Sign in</h1>
        <p className="text-xs text-muted-foreground mt-1">Team or client portal access.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <label className="text-[10px] font-mono uppercase text-muted-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm mt-1"
            />
          </div>
          {err && (
            <div className="text-xs text-destructive border border-destructive/40 bg-destructive/10 rounded-sm px-2 py-1">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-2 text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div className="flex items-center gap-2 my-4">
          <div className="h-px bg-border grow" />
          <span className="text-[10px] text-muted-foreground font-mono uppercase">or</span>
          <div className="h-px bg-border grow" />
        </div>

        <button
          onClick={onGoogle}
          className="w-full border border-border py-2 text-xs font-medium rounded-sm hover:bg-muted"
        >
          Continue with Google
        </button>

        <p className="text-[11px] text-muted-foreground mt-4 text-center">
          No account?{" "}
          <Link to="/signup" className="text-primary font-bold">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
