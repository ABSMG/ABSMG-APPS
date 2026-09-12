import { FormEvent, useState } from "react";
import { storeSupabase } from "../lib/storeSupabase";

type ProductFormProps = {
  onSaved?: () => void;
  onCancel?: () => void;
};

export default function ProductForm({
  onSaved,
  onCancel,
}: ProductFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] =
    useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

    const businessId =
      localStorage.getItem("store_business_id");

    if (!businessId) {
      setError(
        "No store found. Please complete store setup first."
      );
      setLoading(false);
      return;
    }

    const cleanName = name.trim();
    const numericPrice = Number(price);
    const numericCompareAtPrice = compareAtPrice
      ? Number(compareAtPrice)
      : null;
    const numericStock = Number(stockQuantity);

    if (!cleanName) {
      setError("Product name is required.");
      setLoading(false);
      return;
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError("Please enter a valid product price.");
      setLoading(false);
      return;
    }

    if (
      !Number.isInteger(numericStock) ||
      numericStock < 0
    ) {
      setError(
        "Stock quantity must be a whole number of 0 or more."
      );
      setLoading(false);
      return;
    }

    if (
      numericCompareAtPrice !== null &&
      (!Number.isFinite(numericCompareAtPrice) ||
        numericCompareAtPrice <= 0)
    ) {
      setError("Please enter a valid compare-at price.");
      setLoading(false);
      return;
    }

    try {
      const slugBase = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const slug = `${slugBase}-${Date.now()}`;

      const { error: insertError } =
        await storeSupabase.from("products").insert({
          business_id: businessId,
          name: cleanName,
          description:
            description.trim() || null,
          price: numericPrice,
          compare_at_price:
            numericCompareAtPrice,
          stock_quantity: numericStock,
          is_active: isActive,
          category: category.trim() || null,
          image_url: imageUrl.trim() || null,
          slug,
        });

      if (insertError) {
        throw insertError;
      }

      setMessage("Product created successfully.");

      setName("");
      setDescription("");
      setPrice("");
      setCompareAtPrice("");
      setStockQuantity("0");
      setCategory("");
      setImageUrl("");
      setIsActive(true);

      onSaved?.();
    } catch (err) {
      console.error("Product creation error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create product."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">
          Add Product
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Add a product to your online store.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {/* Product name */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Product name
          </label>

          <input
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            placeholder="Wireless Lavalier Microphone"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Description
          </label>

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(event.target.value)
            }
            placeholder="Describe the product..."
            rows={4}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        {/* Prices */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Selling price (TZS)
            </label>

            <input
              type="number"
              min="1"
              step="1"
              value={price}
              onChange={(event) =>
                setPrice(event.target.value)
              }
              placeholder="65000"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Compare-at price (TZS)
            </label>

            <input
              type="number"
              min="1"
              step="1"
              value={compareAtPrice}
              onChange={(event) =>
                setCompareAtPrice(event.target.value)
              }
              placeholder="85000"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>

        {/* Stock and category */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Stock quantity
            </label>

            <input
              type="number"
              min="0"
              step="1"
              value={stockQuantity}
              onChange={(event) =>
                setStockQuantity(event.target.value)
              }
              placeholder="100"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Category
            </label>

            <input
              type="text"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              placeholder="Electronics"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            />
          </div>
        </div>

        {/* Image */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Product image URL
          </label>

          <input
            type="url"
            value={imageUrl}
            onChange={(event) =>
              setImageUrl(event.target.value)
            }
            placeholder="https://example.com/product.jpg"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />

          <p className="mt-1 text-xs text-slate-400">
            Image upload/storage will be connected later.
          </p>
        </div>

        {/* Active */}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) =>
              setIsActive(event.target.checked)
            }
            className="h-4 w-4"
          />

          <div>
            <p className="text-sm font-medium text-slate-800">
              Product is active
            </p>

            <p className="text-xs text-slate-500">
              Active products are visible in the storefront.
            </p>
          </div>
        </label>

        {/* Messages */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Saving product..."
              : "Create Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
