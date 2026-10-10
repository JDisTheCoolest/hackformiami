import { LoaderCircle, LogOut, Eye, EyeOff } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout, buttonClass, fieldClass } from "@/components/auth/AuthLayout";
import { Wordmark } from "@/components/brand/Wordmark";
import { useAuth } from "@/lib/auth";
import { API_BASE } from "@/lib/config";
import { isSupabaseConfigured, safeRedirectPath, supabase } from "@/lib/supabase";

function AuthLoader() {
  return <main className="grid min-h-dvh place-items-center bg-abyss text-cyan"><LoaderCircle className="size-7 animate-spin" aria-label="Loading session" /></main>;
}

export function ProtectedRoute() {
  const { user, session, loading, signOut } = useAuth();
  const location = useLocation();
  const [verification, setVerification] = useState<"checking" | "verified" | "failed">("checking");

  useEffect(() => {
    if (!session) {
      setVerification("checking");
      return;
    }
    const controller = new AbortController();
    void fetch(`${API_BASE}/api/auth/me`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" },
    }).then(async (response) => {
      if (response.ok) return setVerification("verified");
      if (response.status === 401) await signOut();
      setVerification("failed");
    }).catch(() => {
      if (!controller.signal.aborted) setVerification("failed");
    });
    return () => controller.abort();
  }, [session, signOut]);

  if (loading) return <AuthLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (verification === "checking") return <AuthLoader />;
  if (verification === "failed") return <main className="grid min-h-dvh place-items-center bg-abyss px-4 text-center text-foam"><div><h1 className="text-3xl font-semibold">We couldn’t verify your session.</h1><p className="mt-3 text-mist">Check that the 4forces API is running, then try again.</p><button onClick={() => window.location.reload()} className="mt-6 h-11 rounded-xl bg-foam px-5 font-semibold text-abyss">Try again</button></div></main>;
  return <Outlet />;
}

export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoader />;
  return user ? <Navigate to="/app/" replace /> : <Outlet />;
}

function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl border border-flare/35 bg-flare/10 px-4 py-3 text-sm text-[#ffb6a7]">{message}</p>;
}

function hasPkceVerifier() {
  try {
    const projectRef = new URL(import.meta.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
    return Boolean(window.localStorage.getItem(`sb-${projectRef}-auth-token-code-verifier`));
  } catch {
    return false;
  }
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isSupabaseConfigured) { setError("Sign-in is temporarily unavailable while authentication is being configured."); return; }
    setError("");
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (authError) return setError(authError.message);
    navigate(safeRedirectPath(params.get("next"), "/app/"), { replace: true });
  }

  return <AuthLayout eyebrow="Welcome back" title="Sign in" description="Access Miami’s live force map and community reporting tools." footer={<>New to 4forces? <Link className="font-medium text-cyan hover:text-foam" to="/signup">Create an account</Link></>}>
    <form onSubmit={submit} className="space-y-5">
      <ErrorMessage message={!isSupabaseConfigured ? "Authentication setup is pending. The public 4forces website remains available." : error} />
      <label className="block"><span className="mb-2 block text-sm font-medium text-foam">Email</span><input className={fieldClass} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <label className="block"><span className="mb-2 block text-sm font-medium text-foam">Password</span><span className="relative block"><input className={`${fieldClass} pr-12`} type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-mist hover:text-foam" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></span></label>
      <button className={buttonClass} disabled={loading}>{loading && <LoaderCircle className="size-4 animate-spin" />} {loading ? "Signing in…" : "Sign in"}</button>
    </form>
  </AuthLayout>;
}

export function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // The Confirm signup email template must send token_hash + type=email here.
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setLoading(false);
    if (authError) return setError(authError.message);
    if (data.session) navigate("/app/", { replace: true });
    else setVerificationEmail(email.trim());
  }

  if (verificationEmail) return <AuthLayout eyebrow="Check your inbox" title="Verify your email" description={`We sent a confirmation link to ${verificationEmail}. Open it to finish creating your account.`} footer={<Link className="font-medium text-cyan hover:text-foam" to="/login">Return to sign in</Link>}><div className="rounded-xl border border-cyan/25 bg-cyan/10 p-4 text-sm leading-6 text-foam">The link will return you to 4forces and securely finish signing you in.</div></AuthLayout>;

  return <AuthLayout eyebrow="Join the network" title="Create account" description="Help your neighborhood see local risks sooner." footer={<>Already have an account? <Link className="font-medium text-cyan hover:text-foam" to="/login">Sign in</Link></>}>
    <form onSubmit={submit} className="space-y-5">
      <ErrorMessage message={error} />
      <label className="block"><span className="mb-2 block text-sm font-medium text-foam">Email</span><input className={fieldClass} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
      <label className="block"><span className="mb-2 block text-sm font-medium text-foam">Password</span><input className={fieldClass} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /><span className="mt-2 block text-xs text-dim">At least 8 characters</span></label>
      <label className="block"><span className="mb-2 block text-sm font-medium text-foam">Confirm password</span><input className={fieldClass} type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
      <button className={buttonClass} disabled={loading}>{loading && <LoaderCircle className="size-4 animate-spin" />} {loading ? "Creating account…" : "Create account"}</button>
    </form>
  </AuthLayout>;
}

export function ConfirmPage() {
  const [state, setState] = useState<"checking" | "signin" | "error">("checking");
  const [message, setMessage] = useState("Confirming your email…");
  const navigate = useNavigate();

  useEffect(() => {
    async function confirm() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      if (tokenHash && type === "email") {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
        if (error) {
          setState("error");
          setMessage("This confirmation link is invalid or has expired. Request a new confirmation email, then try again.");
        } else if (data.session) {
          navigate("/app/", { replace: true });
        } else {
          setState("signin");
          setMessage("Your email is confirmed. Please sign in to continue.");
        }
        return;
      }
      if (code) {
        if (!hasPkceVerifier()) {
          setState("signin");
          setMessage("This older confirmation link was opened without its original browser session. Please sign in, or request a new confirmation email.");
          return;
        }
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data.session) {
          navigate("/app/", { replace: true });
          return;
        }
        setState("signin");
        setMessage("Your email may already be confirmed, but this link was opened without its original browser session. Please sign in to continue.");
        return;
      }
      setState("error");
      setMessage("This confirmation link is incomplete. Please request a new confirmation email.");
    }
    void confirm();
  }, [navigate]);

  return <AuthLayout eyebrow="Account confirmation" title={state === "error" ? "We couldn’t confirm your email" : state === "signin" ? "Email confirmed" : "Almost there"} description={message} footer={<Link className="font-medium text-cyan hover:text-foam" to="/login">Return to sign in</Link>}>{state === "checking" && <div className="flex justify-center"><LoaderCircle className="size-6 animate-spin text-cyan" aria-label="Confirming email" /></div>}{state !== "checking" && <Link to="/login" className={buttonClass}>Return to sign in</Link>}</AuthLayout>;
}

export function AppHome() {
  const { user, signOut } = useAuth();
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function logout() {
    setError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign out.");
    }
  }
  return <main className="min-h-dvh bg-abyss px-4 py-6 text-foam sm:px-6 lg:px-10"><div className="mx-auto max-w-[1440px]"><header className="flex flex-wrap items-center justify-between gap-4 border-b hairline pb-6"><Wordmark className="text-2xl" /><div className="flex items-center gap-3"><span className="hidden text-sm text-mist sm:block">{user?.email}</span><button onClick={logout} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-foam/20 px-4 text-sm font-medium hover:bg-foam/10"><LogOut className="size-4" /> Log out</button></div></header>{error && <div className="mt-5"><ErrorMessage message={error} /></div>}<section className="grid min-h-[70vh] place-items-center py-16 text-center"><div><p className="label-sm uppercase tracking-[0.18em] text-cyan">Authenticated workspace</p><h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">Welcome to 4forces.</h1><p className="mx-auto mt-5 max-w-xl text-lg text-mist">Your session is active. The app interface can be developed here without changing the authentication boundary.</p></div></section></div></main>;
}
