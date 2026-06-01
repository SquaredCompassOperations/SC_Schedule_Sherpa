import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — ScheduleBuilder" }] }),
  component: SignupPage,
});

function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, company },
      },
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setOk(true);
  };

  const onGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) setErr(result.error.message ?? "Google sign-in failed");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm border border-border rounded-sm bg-card p-6">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          ScheduleBuilder
        </div>
        <h1 className="text-2xl font-bold text-foreground mt-1">Create account</h1>
        <p className="text-xs text-muted-foreground mt-1">
          New users start in the client portal. Team access is granted by an admin.
        </p>

        {ok ? (
          <div className="mt-6 text-sm text-foreground">
            Check your email to confirm your account, then{" "}
            <Link to="/login" className="text-primary font-bold">
              sign in
            </Link>
            .
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              <Field label="Full name" value={fullName} onChange={setFullName} required />
              <Field label="Company" value={company} onChange={setCompany} />
              <Field label="Email" type="email" value={email} onChange={setEmail} required />
              <Field label="Password" type="password" value={password} onChange={setPassword} required />
              {err && (
                <div className="text-xs text-destructive border border-destructive/40 bg-destructive/10 rounded-sm px-2 py-1">
                  {err}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-2 text-xs font-bold uppercase tracking-widest rounded-sm disabled:opacity-50"
              >
                {loading ? "Creating…" : "Sign Up"}
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
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-bold">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-mono uppercase text-muted-foreground">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded-sm bg-background text-sm mt-1"
      />
    </div>
  );
}
