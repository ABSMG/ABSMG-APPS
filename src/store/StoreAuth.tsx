import { FormEvent, useState } from "react";
import { storeSupabase } from "../lib/storeSupabase";

type StoreAuthProps = {
  onAuthenticated?: () => void;
};

export default function StoreAuth({
  onAuthenticated,
}: StoreAuthProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function redirectToStore(userId: string) {
    if (!storeSupabase) {
      throw new Error(
        "Store database is not configured. Check Render environment variables."
      );
    }

    const { data: business, error: businessError } =
      await storeSupabase
        .from("businesses")
        .select("id")
        .eq("owner_id", userId)
        .limit(1)
        .maybeSingle();

    if (businessError) {
      throw businessError;
    }

    if (business?.id) {
      localStorage.setItem(
        "store_business_id",
        business.id
      );

      window.location.assign("/store/admin");
      return;
    }

    localStorage.removeItem("store_business_id");
    window.location.assign("/store/setup");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    if (!storeSupabase) {
      setError(
        "Store database is not configured."
      );
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim();
    const cleanName = name.trim();

    if (!cleanEmail || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      setLoading(false);
      return;
    }

    if (mode === "signup" && !cleanName) {
      setError("Please enter your full name.");
      setLoading(false);
      return;
    }

    try {
      if (mode === "signup") {
        const { data, error: signupError } =
          await storeSupabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                full_name: cleanName,
              },
            },
          });

        if (signupError) {
          throw signupError;
        }

        if (data.session && data.user) {
          await redirectToStore(data.user.id);
          return;
        }

        setMessage(
          "Account created successfully. Check your email to confirm your account, then log in."
        );

        setMode("login");
        setPassword("");
        return;
      }

      const { data, error: loginError } =
        await storeSupabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        throw loginError;
      }

      if (!data.session || !data.user) {
        throw new Error(
          "Login succeeded, but no active session was created."
        );
      }

      await redirectToStore(data.user.id);
      return;
    } catch (err) {
      console.error(
        "Store authentication error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }

    onAuthenticated?.();
  }

  function switchMode(
    nextMode: "login" | "signup"
  ) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#f1f5f9",
        color: "#0f172a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          background: "#ffffff",
          color: "#0f172a",
          borderRadius: "24px",
          padding: "32px",
          boxSizing: "border-box",
          boxShadow:
            "0 20px 60px rgba(15, 23, 42, 0.15)",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 16px",
              borderRadius: "18px",
              background: "#0f172a",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
            }}
          >
            🛍️
          </div>

          <h1
            style={{
              margin: 0,
              color: "#0f172a",
              fontSize: "28px",
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            {mode === "login"
              ? "Welcome back"
              : "Create your Store account"}
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Manage your AI-powered online store.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {mode === "signup" && (
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "7px",
                  color: "#334155",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                Full name
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Your full name"
                autoComplete="name"
                required
                style={{
                  width: "100%",
                  height: "48px",
                  padding: "0 14px",
                  boxSizing: "border-box",
                  background: "#ffffff",
                  color: "#0f172a",
                  border: "1px solid #cbd5e1",
                  borderRadius: "12px",
                  fontSize: "16px",
                  outline: "none",
                }}
              />
            </div>
          )}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                color: "#334155",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              autoComplete="email"
              required
              style={{
                width: "100%",
                height: "48px",
                padding: "0 14px",
                boxSizing: "border-box",
                background: "#ffffff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                fontSize: "16px",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "7px",
                color: "#334155",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter your password"
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={6}
              required
              style={{
                width: "100%",
                height: "48px",
                padding: "0 14px",
                boxSizing: "border-box",
                background: "#ffffff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                borderRadius: "12px",
                fontSize: "16px",
                outline: "none",
              }}
            />

            {mode === "signup" && (
              <p
                style={{
                  margin: "6px 0 0",
                  color: "#64748b",
                  fontSize: "12px",
                }}
              >
                Password must contain at least 6 characters.
              </p>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: "12px",
                borderRadius: "12px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {message && (
            <div
              style={{
                padding: "12px",
                borderRadius: "12px",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#15803d",
                fontSize: "14px",
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: "50px",
              border: "none",
              borderRadius: "12px",
              background: loading
                ? "#64748b"
                : "#0f172a",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: loading
                ? "not-allowed"
                : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? mode === "login"
                ? "Logging in..."
                : "Creating account..."
              : mode === "login"
              ? "Login"
              : "Create account"}
          </button>
        </form>

        {/* Switch */}
        <div
          style={{
            marginTop: "24px",
            textAlign: "center",
            color: "#475569",
            fontSize: "14px",
          }}
        >
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#0f172a",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#0f172a",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Login
              </button>
            </>
          )}
        </div>

        {/* Back */}
        <div
          style={{
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid #e2e8f0",
            textAlign: "center",
          }}
        >
          <a
            href="/store"
            style={{
              color: "#64748b",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            ← Back to Store
          </a>
        </div>
      </div>
    </div>
  );
}
