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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    if (!storeSupabase) {
      setError("Store database is not configured.");
      setLoading(false);
      return;
    }

    if (!email || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { data, error } = await storeSupabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) {
        setError(error.message);
      } else if (data.session) {
        setMessage("Account created successfully.");
        onAuthenticated?.();
      } else {
        setMessage(
          "Account created. Check your email to confirm your account."
        );
      }
    } else {
      const { error } =
        await storeSupabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        setError(error.message);
      } else {
        setMessage("Login successful.");
        onAuthenticated?.();
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
            🛍️
          </div>

          <h1 className="text-2xl font-bold">
            {mode === "login"
              ? "Welcome back"
              : "Create your Store account"}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage your AI-powered online store.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Full name
              </label>

              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="••••••••"
              minLength={6}
              className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-slate-300"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          {mode === "login" ? (
            <p>
              Don't have an account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setMessage("");
                }}
                className="font-semibold underline"
              >
                Create one
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setError("");
                  setMessage("");
                }}
                className="font-semibold underline"
             
