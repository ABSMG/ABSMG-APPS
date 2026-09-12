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
      throw new Error("Store database is not configured.");
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

      window.location.href = "/store/admin";
      return;
    }

    localStorage.removeItem("store_business_id");

    window.location.href = "/store/setup";
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    if (!storeSupabase) {
      setError("Store database is not configured.");
      setLoading(false);
      return;
    }

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    if (mode === "signup" && !name.trim()) {
      setError("Please enter your full name.");
      setLoading(false);
      return;
    }

    try {
      if (mode === "signup") {
        const { data, error } =
          await storeSupabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                full_name: name.trim(),
              },
            },
          });

        if (error) {
          throw error;
        }

        if (data.session && data.user) {
          await redirectToStore(data.user.id);
          return;
        }

        setMessage(
          "Account created successfully. Please check your email and confirm your account before logging in."
        );
      } else {
        const { data, error } =
          await storeSupabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) {
          throw error;
        }

        if (!data.session || !data.user) {
          throw new Error(
            "Login succeeded, but no active session was created."
          );
        }

        await redirectToStore(data.user.id);
        return;
      }

      onAuthenticated?.();
    } catch (err) {
      console.error("Store authentication error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(
    nextMode: "login" | "signup"
  ) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
            🛍️
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            {mode === "login"
              ? "Welcome back"
              : "Create your Store account"}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage your AI-powered online store.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Full name
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Your name"
                autoComplete="name"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                required
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
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
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="••••••••"
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
              minLength={6}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              required
            />

            {mode === "signup" && (
              <p className="mt-1 text-xs text-slate-400">
                Password must contain at least 6 characters.
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Success */}
          {message && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              {message}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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

        {/* Mode switch */}
        <div className="mt-6 text-center text-sm text-slate-600">
          {mode === "login" ? (
            <p>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-semibold text-slate-900 underline underline-offset-2"
              >
                Create one
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-semibold text-slate-900 underline underline-offset-2"
              >
                Login
              </button>
            </p>
          )}
        </div>

        {/* Store link */}
        <div className="mt-6 border-t border-slate-100 pt-5 text-center">
          <a
            href="/store"
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to Store
          </a>
        </div>
      </div>
    </div>
  );
}
