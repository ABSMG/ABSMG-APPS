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
        "Store database is not configured. Check the Render environment variables."
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
        "Store database is not configured. Please check the Render environment variables."
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
      setError("Password must contain at least 6 characters.");
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
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl shadow-lg">
              🛍️
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {mode === "login"
                ? "Welcome back"
                : "Create your Store account"}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage your AI-powered online store.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {mode === "signup" && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  required
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
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
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
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
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                required
              />

              {mode === "signup" && (
                <p className="mt-2 text-xs text-slate-500">
                  Password must contain at least 6 characters.
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <strong className="font-semibold">
                  Error:
                </strong>{" "}
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 px-4 py-3.5 font-semibold text-white shadow-lg transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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

          <div className="mt-6 text-center text-sm text-slate-600">
            {mode === "login" ? (
              <p>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-semibold text-slate-900 underline underline-offset-4 hover:text-slate-600"
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
                  className="font-semibold text-slate-900 underline underline-offset-4 hover:text-slate-600"
                >
                  Login
                </button>
              </p>
            )}
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5 text-center">
            <a
              href="/store"
              className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              ← Back to Store
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
