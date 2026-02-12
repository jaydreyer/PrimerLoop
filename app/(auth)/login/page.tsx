"use client";

import { createBrowserClient } from "@supabase/ssr";
import { FormEvent, useMemo, useState } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!supabase) {
      setError("Supabase env vars are missing in this environment.");
      return;
    }

    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    setSuccess("Magic link sent. Check your inbox and open the link on this device.");
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: 20 }}>
      <h1 style={{ marginBottom: 8 }}>PrimerLoop Login</h1>
      <p style={{ marginTop: 0, color: "#444" }}>Sign in with a magic link.</p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <label htmlFor="email" style={{ fontSize: 14, color: "#333" }}>
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          style={{
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 15,
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            border: 0,
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 15,
            background: loading ? "#6b7280" : "#111",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending..." : "Send magic link"}
        </button>
      </form>

      {error ? (
        <p style={{ marginTop: 14, color: "#9f1d1d" }}>{error}</p>
      ) : null}

      {success ? (
        <p style={{ marginTop: 14, color: "#0f5132" }}>{success}</p>
      ) : null}
    </main>
  );
}
