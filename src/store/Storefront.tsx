import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";
import { storeSupabase } from "../lib/storeSupabase";

type Product = {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  is_active: boolean;
  slug: string | null;
  category: string | null;
  image_url: string | null;
};

type CartItem = Product & {
  quantity: number;
};

const BUSINESS_ID = import.meta.env.VITE_STORE_BUSINESS_ID;

export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedCart = localStorage.getItem("ai_store_cart");

    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch {
        localStorage.removeItem("ai_store_cart");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ai_store_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError("");

    if (!storeSupabase) {
      setError("Store database is not configured.");
      setLoading(false);
      return;
    }

    if (!BUSINESS_ID) {
      setError("Store business is not configured yet.");
      setLoading(false);
      return;
    }

    const { data, error } = await storeSupabase
      .from("products")
      .select(
        `
        id,
        business_id,
        name,
        description,
        price,
        compare_at_price,
        stock_quantity,
        is_active,
        slug,
        category,
        image_url
        `
      )
      .eq("business_id", BUSINESS_ID)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError("Failed to load products.");
      setProducts([]);
    } else {
      setProducts((data || []) as Product[]);
    }

    setLoading(false);
  }

  const categories = useMemo(() => {
    const values = products
      .map((product) => product.category)
      .filter(Boolean) as string[];

    return ["All", ...Array.from(new Set(values))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase().trim();

    return products.filter((product) => {
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term);

      const matchesCategory =
        category === "All" || product.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const cartTotal = cart.reduce(
    (total, item) => total + Number(item.price) * item.quantity,
    0
  );

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  function addToCart(product: Product) {
    if (product.stock_quantity <= 0) return;

    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + 1,
                  product.stock_quantity
                ),
              }
            : item
        );
      }

      return [...current, { ...product, quantity: 1 }];
    });

    setCartOpen(true);
  }

  function increaseQuantity(id: string) {
    setCart((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.min(
                item.quantity + 1,
                item.stock_quantity
              ),
            }
          : item
      )
    );
  }

  function decreaseQuantity(id: string) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(id: string) {
    setCart((current) => current.filter((item) => item.id !== id));
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat("en-TZ", {
      style: "currency",
      currency: "TZS",
      maximumFractionDigits: 0,
    }).format(price);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <div className="flex items-center gap-2 text-xl font-bold">
              <Sparkles className="h-6 w-6" />
              AI Store
            </div>
            <p className="text-xs text-slate-500">
              Smart products. Simple shopping.
            </p>
          </div>

          <button
            onClick={() => setCartOpen(true)}
            className="relative rounded-xl border bg-white p-3 shadow-sm transition hover:bg-slate-100"
            aria-label="Open cart"
          >
            <ShoppingCart className="h-5 w-5" />

            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-1 text-xs font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-10">
        <div className="rounded-3xl bg-slate-900 px-6 py-10 text-white md:px-10">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
              Trending products
            </p>

            <h1 className="text-3xl font-bold md:text-5xl">
              Discover products worth buying.
            </h1>

            <p className="mt-4 text-slate-300">
              Find trending products and shop easily from one place.
            </p>

            <div className="mt-6 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-slate-900">
              <Search className="h-5 w-5 text-slate-400" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full bg-transparent outline-none
