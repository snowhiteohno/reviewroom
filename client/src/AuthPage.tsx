import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import { Flower2, ArrowUpRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "./lib/auth";
import type { User } from "./lib/types";
export default function AuthPage({ register = false }: { register?: boolean }) {
  const { user, setUser } = useAuth(),
    navigate = useNavigate(),
    location = useLocation();
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const from =
    typeof location.state?.from === "string" &&
    location.state.from.startsWith("/") &&
    !location.state.from.startsWith("//") &&
    !/^\/(login|register)/.test(location.state.from)
      ? location.state.from
      : "/";
  if (user) return <Navigate to={from} replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        "/api/auth/" + (register ? "register" : "login"),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: name, email, password }),
        },
      );
      const data = (await res.json()) as { user: User; error?: string };
      if (!res.ok) throw new Error(data.error || "Please try again.");
      setUser(data.user);
      navigate(from, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-art">
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Flower2 size={31} strokeWidth={1.5} />
          </span>
          <span>
            reviewroom<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="auth-art-content">
          <span className="eyebrow">A LITTLE SPACE TO CREATE</span>
          <h1>
            Good work.
            <br />
            Thoughtful feedback.
          </h1>
          <p>Bring your designs, your people, and your next idea together.</p>
          <div className="auth-art-frame">
            <span className="note-tape" />
            <img src="/samples/flora-v2.svg" alt="Flora studio brand design" />
            <span className="auth-art-caption">
              A fresh perspective makes all the difference.
            </span>
          </div>
        </div>
        <span className="auth-bottom">
          <Flower2 size={16} strokeWidth={1.2} /> Made for the creative process.
        </span>
      </section>
      <section className="auth-form-panel">
        <div className="auth-form-card">
          <span className="auth-flower">
            <Flower2 size={36} strokeWidth={1.2} />
          </span>
          <span className="eyebrow">
            {register ? "MAKE YOURSELF AT HOME" : "YOUR STUDIO IS WAITING"}
          </span>
          <h2>{register ? "A space of your own." : "Welcome back."}</h2>
          <p>
            {register
              ? "Create an account and make room for your ideas."
              : "Sign in to pick up where you left off."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label className="field-label">
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={60}
                  placeholder="Mallika"
                />
              </label>
            )}
            <label className="field-label">
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
                placeholder="you@example.com"
              />
            </label>
            <label className="field-label">
              Password
              <div className="password-field">
                <input
                  type={show ? "text" : "password"}
                  name="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={register ? 8 : 1}
                  maxLength={72}
                  placeholder={
                    register ? "At least 8 characters" : "Your password"
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button primary full-width auth-submit"
              disabled={busy}
            >
              {busy ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <ArrowUpRight size={17} />
              )}{" "}
              {busy
                ? "One moment"
                : register
                  ? "Create your studio"
                  : "Sign in"}
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to ReviewRoom?"}{" "}
            <Link
              to={register ? "/login" : "/register"}
              state={{ from }}
              onClick={() => setError("")}
            >
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <div className="auth-footnote">
            <Flower2 size={15} strokeWidth={1.2} />
            <span>Your designs have a home here.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
