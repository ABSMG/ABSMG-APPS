import { useEffect, useState } from "react";
import {
  BarChart3,
  Package,
  ShoppingCart,
  Plus,
  LogOut,
  Store,
  RefreshCw,
} from "lucide-react";
import { storeSupabase } from "../lib/storeSupabase";

import ProductForm from "./ProductForm.tsx"; Product = {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  category: string | null;
  image_url: string | null;
};

export default function StoreAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [storeName, setStoreName] = useState("OpportunityBridge Store");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const businessId =
    localStorage.getItem("store_business_id") || "";

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    if (!storeSupabase) {
      setMessage("Store database is not configured.");
      setLoading(false);
      return;
    }

    if (!businessId) {
      setMessage(
        "No store found. Please complete store setup first."
      );
      setLoading(false);
      return;
    }

    try {
      const {
        data: business,
        error: businessError,
      } = await storeSupabase
        .from("businesses")
        .select("name")
        .eq("id", businessId)
        .single();

      if (businessError) {
        throw businessError;
      }

      setStoreName(
        business?.name || "OpportunityBridge Store"
      );

      const {
        data: productData,
        error: productError,
      } = await storeSupabase
        .from("products")
        .select(
          "id,name,price,stock_quantity,is_active,category,image_url"
        )
        .eq("business_id", businessId)
        .order("created_at", {
          ascending: false,
        });

      if (productError) {
        throw productError;
      }

      setProducts(productData || []);
    } catch (error) {
      console.error("Dashboard error:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to load dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function logout() {
    if (storeSupabase) {
      await storeSupabase.auth.signOut();
    }

    localStorage.removeItem("store_business_id");
    window.location.href = "/store/login";
  }

  const activeProducts = products.filter(
    (product) => product.is_active
  ).length;

  const totalStock = products.reduce(
    (total, product) =>
      total + (product.stock_quantity || 0),
    0
  );

  const inventoryValue = products.reduce(
    (total, product) =>
      total +
      Number(product.price || 0) *
        Number(product.stock_quantity || 0),
    0
  );

  function formatPrice(price: number) {
    return new Intl.NumberFormat("en-TZ", {
      style: "currency",
      currency: "TZS",
      maximumFractionDigits: 0,
    }).format(price);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Store size={21} />
            </div>

            <div>
              <h1 className="font-bold text-slate-900">
                {storeName}
              </h1>

              <p className="text-xs text-slate-500">
                Store Admin Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadDashboard}
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-slate-100"
              title="Refresh"
            >
              <RefreshCw
                size={18}
                className={
                  loading ? "animate-spin" : ""
                }
              />
            </button>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <LogOut size={17} />
              <span className="hidden sm:inline">
                Logout
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">
            Dashboard
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Manage your store and monitor your inventory.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {message}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Total Products
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {products.length}
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <Package
                  size={22}
                  className="text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Active Products
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {activeProducts}
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <BarChart3
                  size={22}
                  className="text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Stock Units
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {totalStock}
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <ShoppingCart
                  size={22}
                  className="text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Inventory Value
                </p>

                <p className="mt-2 text-xl font-bold text-slate-900">
                  {formatPrice(inventoryValue)}
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <BarChart3
                  size={22}
                  className="text-slate-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Quick Actions
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Manage the most important parts of your store.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  alert(
                    "Product creation will be connected in the next step."
                  )
                }
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Plus size={17} />
                Add Product
              </button>

              <button
                type="button"
                onClick={() =>
                  (window.location.href = "/store")
                }
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                View Store
              </button>
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="text-lg font-bold text-slate-900">
              Products
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Your current store inventory.
            </p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="p-10 text-center">
              <Package
                size={42}
                className="mx-auto text-slate-300"
              />

              <h4 className="mt-4 font-semibold text-slate-900">
                No products yet
              </h4>

              <p className="mt-2 text-sm text-slate-500">
                Add your first product to start selling.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-4">
                      Product
                    </th>

                    <th className="px-6 py-4">
                      Category
                    </th>

                    <th className="px-6 py-4">
                      Price
                    </th>

                    <th className="px-6 py-4">
                      Stock
                    </th>

                    <th className="px-6 py-4">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-100">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Package
                                  size={20}
                                  className="text-slate-300"
                                />
                              </div>
                            )}
                          </div>

                          <span className="font-medium text-slate-900">
                            {product.name}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-500">
                        {product.category || "—"}
                      </td>

                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatPrice(product.price)}
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {product.stock_quantity}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            product.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {product.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
