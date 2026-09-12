import { FormEvent, useState } from "react";
import { storeSupabase } from "../lib/storeSupabase";

type StoreSetupProps = {
  onComplete?: (businessId: string) => void;
};

export default function StoreSetup({ onComplete }: StoreSetupProps) {
  const [name, setName] = useState("OpportunityBridge Store");
  const [description, setDescription] = useState(
    "Smart online store for quality products and digital shopping."
  );
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!storeSupabase) {
      setMessage("Store Supabase is not configured yet.");
      return;
    }

    if (!name.trim()) {
      setMessage("Please enter a store name.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await storeSupabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setMessage("Please log in first.");
        return;
      }

      const { data, error } = await storeSupabase
        .from("businesses")
        .insert({
          owner_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          currency: "TZS",
          whatsapp_number: whatsappNumber.trim() || null,
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      localStorage.setItem("store_business_id", data.id);

      setMessage("Store created successfully!");

      onComplete?.(data.id);
    } catch (error) {
      console.error("Store setup error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to create store."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">
              Set Up Your Store
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Create your OpportunityBridge online store.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Store name
              </label>

              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="OpportunityBridge Store"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Description
              </label>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                placeholder="Tell customers about your store"
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                WhatsApp number
              </label>

              <input
                type="tel"
                value={whatsappNumber}
                onChange={(event) =>
                  setWhatsappNumber(event.target.value)
                }
                placeholder="+255..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Currency
              </label>

              <input
                type="text"
                value="TZS"
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating store..." : "Create Store"}
            </button>

            {message && (
              <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
