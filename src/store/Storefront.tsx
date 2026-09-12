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

    if (!savedCart) return;

    try {
      const parsed = JSON.parse(savedCart);

      if (Array.isArray(parsed)) {
        setCart(parsed);
      }
    } catch {
      localStorage.removeItem(CART_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      CART_KEY,
      JSON.stringify(cart)
    );
  }, [cart]);

  useEffect(() => {
    async function loadProducts() {
      setLoading(true);
      setError("");

      if (!storeSupabase) {
        setError(
          "Store database is not configured."
        );
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

        setProducts(
          (data || []) as Product[]
        );
      } catch (err) {
        console.error(
          "Product loading error:",
          err
        );

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
          Boolean(value?.trim())
      );

    return [
      "All",
      ...Array.from(new Set(values)),
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const searchTerm =
      search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !searchTerm ||
        product.name
          .toLowerCase()
          .includes(searchTerm) ||
        Boolean(
          product.description
            ?.toLowerCase()
            .includes(searchTerm)
        );

      const matchesCategory =
        category === "All" ||
        product.category === category;

      return (
        matchesSearch &&
        matchesCategory
      );
    });
  }, [products, search, category]);

  const cartCount = cart.reduce(
    (total, item) =>
      total + item.quantity,
    0
  );

  const cartTotal = cart.reduce(
    (total, item) =>
      total +
      Number(item.price) * item.quantity,
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

  function increaseQuantity(
    productId: string
  ) {
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

  function decreaseQuantity(
    productId: string
  ) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === productId
            ? {
                ...item,
                quantity:
                  item.quantity - 1,
              }
            : item
        )
        .filter(
          (item) => item.quantity > 0
        )
    );
  }

  function removeFromCart(
    productId: string
  ) {
    setCart((current) =>
      current.filter(
        (item) => item.id !== productId
      )
    );
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat(
      "en-TZ",
      {
        style: "currency",
        currency: "TZS",
        maximumFractionDigits: 0,
      }
    ).format(price);
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
      {/* HEADER */}
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
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search products..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-slate-400 focus:bg-white"
            />
          </div>

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800"
            aria-label="Open shopping cart"
          >
            <ShoppingCart size={20} />

            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-200">
              AI-powered shopping
            </span>

            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Discover products
              worth buying.
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Explore useful products,
              compare prices, and shop
              smarter from one simple
              storefront.
            </p>

            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("products")
                  ?.scrollIntoView({
                    behavior: "smooth",
                  })
              }
              className="mt-7 rounded-xl bg-white px-5 py-3 font-semibold text-slate-900 hover:bg-slate-100"
            >
              Shop now
            </button>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-4">
          <div className="flex min-w-max gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() =>
                  setCategory(item)
                }
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  category === item
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCTS */}
      <main
        id="products"
        className="mx-auto max-w-7xl px-4 py-10"
      >
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              Store collection
            </p>

            <h2 className="mt-1 text-2xl font-bold text-slate-900">
              Featured products
            </h2>
          </div>

          <p className="text-sm text-slate-500">
            {filteredProducts.length}{" "}
            product
            {filteredProducts.length === 1
              ? ""
              : "s"}
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-60 items-center justify-center">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2
                size={22}
                className="animate-spin"
              />
              <span>
                Loading products...
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="font-semibold text-red-700">
              Store unavailable
            </p>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>

            <a
              href="/store/login"
              className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Store login
            </a>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Store size={24} />
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-900">
              No products found
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Try another search or category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map(
              (product) => {
                const outOfStock =
                  product.stock_quantity <= 0;

                return (
                  <article
                    key={product.id}
                    className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-100">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-400">
                          <Store size={42} />
                        </div>
                      )}

                      {product.category && (
                        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                          {product.category}
                        </span>
                      )}

                      {outOfStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900">
                            Out of stock
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      <h3 className="line-clamp-2 font-bold text-slate-900">
                        {product.name}
                      </h3>

                      {product.description && (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                          {product.description}
                        </p>
                      )}

                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-slate-900">
                            {formatPrice(
                              Number(product.price)
                            )}
                          </p>

                          {product.compare_at_price &&
                            product.compare_at_price >
                              product.price && (
                              <p className="text-xs text-slate-400 line-through">
                                {formatPrice(
                                  Number(
                                    product.compare_at_price
                                  )
                                )}
                              </p>
                            )}
                        </div>

                        <button
                          type="button"
                          disabled={outOfStock}
                          onClick={() =>
                            addToCart(product)
                          }
                          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <Plus size={17} />
                          Add
                        </button>
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </main>

      {/* CART */}
      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close cart"
            onClick={() => setCartOpen(false)}
            className="absolute inset-0 bg-black/40"
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">
                  Your cart
                </h2>

                <p className="text-xs text-slate-500">
                  {cartCount} item
                  {cartCount === 1 ? "" : "s"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Close cart"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <ShoppingCart size={28} />
                  </div>

                  <h3 className="mt-4 font-bold text-slate-900">
                    Your cart is empty
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Add products to start shopping.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <div className="flex gap-3">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-slate-400">
                              <Store size={24} />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-3">
                            <h3 className="line-clamp-2 text-sm font-bold text-slate-900">
                              {item.name}
                            </h3>

                            <button
                              type="button"
                              onClick={() =>
                                removeFromCart(
                                  item.id
                                )
                              }
                              className="shrink-0 text-slate-400 hover:text-red-500"
                              aria-label={`Remove ${item.name}`}
                            >
                              <X size={17} />
                            </button>
                          </div>

                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {formatPrice(
                              Number(item.price)
                            )}
                          </p>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center rounded-lg border border-slate-200">
                              <button
                                type="button"
                                onClick={() =>
                                  decreaseQuantity(
                                    item.id
                                  )
                                }
                                className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100"
                                aria-label="Decrease quantity"
                              >
                                <Minus size={15} />
                              </button>

                              <span className="w-8 text-center text-sm font-semibold">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  increaseQuantity(
                                    item.id
                                  )
                                }
                                disabled={
                                  item.quantity >=
                                  item.stock_quantity
                                }
                                className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Increase quantity"
                              >
                                <Plus size={15} />
                              </button>
                            </div>

                            <p className="text-sm font-bold text-slate-900">
                              {formatPrice(
                                Number(item.price) *
                                  item.quantity
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-slate-200 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Total
                  </span>

                  <span className="text-xl font-black text-slate-900">
                    {formatPrice(cartTotal)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={checkout}
                  className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800"
                >
                  Proceed to checkout
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
