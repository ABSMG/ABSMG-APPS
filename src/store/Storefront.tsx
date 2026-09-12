import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  X,
  Store,
  Loader2,
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

const CART_KEY = "ai_store_cart";
const BUSINESS_KEY = "store_business_id";

export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const businessId =
    localStorage.getItem(BUSINESS_KEY) || "";

  useEffect(() => {
    const savedCart = localStorage.getItem(CART_KEY);

    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch {
        localStorage.removeItem(CART_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setError("");

      if (!storeSupabase) {
        setError("Store database is not configured.");
        setLoading(false);
        return;
      }

      if (!businessId) {
        setError(
          "Store has not been set up yet. Please create your store first."
        );
        setLoading(false);
        return;
      }

      try {
        const { data, error: productsError } =
          await storeSupabase
            .from("products")
            .select(
              "id,business_id,name,description,price,compare_at_price,stock_quantity,is_active,slug,category,image_url"
            )
            .eq("business_id", businessId)
            .eq("is_active", true)
            .order("created_at", {
              ascending: false,
            });

        if (productsError) {
          throw productsError;
        }

        setProducts(data || []);
      } catch (err) {
        console.error("Product loading error:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load products."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, [businessId]);

  const categories = useMemo(() => {
    const values = products
      .map((product) => product.category)
      .filter(
        (value): value is string =>
          Boolean(value && value.trim())
      );

    return ["All", ...Array.from(new Set(values))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !searchTerm ||
        product.name.toLowerCase().includes(searchTerm) ||
        product.description
          ?.toLowerCase()
          .includes(searchTerm);

      const matchesCategory =
        category === "All" ||
        product.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  function addToCart(product: Product) {
    if (product.stock_quantity <= 0) {
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) => item.id === product.id
      );

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

      return [
        ...current,
        {
          ...product,
          quantity: 1,
        },
      ];
    });

    setCartOpen(true);
  }

  function increaseQuantity(productId: string) {
    setCart((current) =>
      current.map((item) =>
        item.id === productId
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

  function decreaseQuantity(productId: string) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) =>
      current.filter((item) => item.id !== productId)
    );
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat("en-TZ", {
      style: "currency",
      currency: "TZS",
      maximumFractionDigits: 0,
    }).format(price);
  }

  function checkout() {
    if (cart.length === 0) {
      return;
    }

    alert(
      "Checkout will be connected to secure order processing in the next step."
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <a
            href="/store"
            className="flex items-center gap-2 text-slate-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Store size={20} />
            </div>

            <div>
              <h1 className="font-bold">
                OpportunityBridge Store
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Smart shopping powered by AI
              </p>
            </div>
          </a>

          <div className="relative ml-auto flex-1 md:max-w-xl">
            <Search
             
