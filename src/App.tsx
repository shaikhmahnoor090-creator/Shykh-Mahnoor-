import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Search, MapPin, ArrowRight, Database } from 'lucide-react';
import { DEFAULT_MISMU_DB } from './data/defaultDb';
import { DEFAULT_CATEGORIES, type MismuDatabase, type Order, type Product, type ProductCategory } from './types/store';
import { assetUrl, formatPKR } from './utils/format';
import { MismuLogo } from './components/MismuLogo';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartCheckoutDrawer, type CartItem } from './components/CartCheckoutDrawer';
import { TcsRatesAndTracker } from './components/TcsRatesAndTracker';
import { StoreDbManager } from './components/StoreDbManager';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { fetchStoreDb } from './utils/storeApi';

export default function App() {
  const [db, setDb] = useState<MismuDatabase>(DEFAULT_MISMU_DB);
  const [view, setView] = useState<'store' | 'admin'>('store');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ProductCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<string>('city-khi');

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = window.localStorage.getItem('mismu_cart_v2');
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [drawerInitialStep, setDrawerInitialStep] = useState<'bag' | 'checkout'>('bag');
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [trackingQuery, setTrackingQuery] = useState<string | undefined>(undefined);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchStoreDb().then((data) => {
      if (mounted && data && Array.isArray(data.products)) {
        setDb(data);
        if (data.cities.length > 0 && !data.cities.some((c) => c.id === selectedCityId)) {
          setSelectedCityId(data.cities[0].id);
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('mismu_cart_v2', JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  const selectedCity = useMemo(
    () => db.cities.find((c) => c.id === selectedCityId) || db.cities[0],
    [db.cities, selectedCityId]
  );

  const categories = useMemo<Array<'All' | ProductCategory>>(() => {
    const seen = new Set<string>(DEFAULT_CATEGORIES);
    for (const p of db.products) {
      const c = p.category?.trim();
      if (c) seen.add(c);
    }
    return ['All', ...Array.from(seen)];
  }, [db.products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return db.products.filter((p) => {
      const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [db.products, selectedCategory, searchQuery]);

  const totalBagCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleAddToCart = (product: Product, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, product, quantity: Math.min(product.stock, i.quantity + qty) }
            : i
        );
      }
      return [...prev, { product, quantity: Math.min(product.stock, qty) }];
    });
  };

  const handleBuyNow = (product: Product, qty = 1) => {
    handleAddToCart(product, qty);
    setDrawerInitialStep('checkout');
    setIsCartOpen(true);
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const handleOrderCreated = (order: Order) => {
    fetchStoreDb()
      .then((fresh) => setDb(fresh))
      .catch(() => {
        setDb((prev) => ({ ...prev, orders: [order, ...prev.orders] }));
      });
  };

  const navigateSection = (sectionId: string) => {
    setView('store');
    window.setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const handleTrackFromReceipt = (trackingId: string) => {
    setTrackingQuery(trackingId);
    navigateSection('track-order');
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Sticky Single-Row 3-Zone Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setView('store');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600 rounded-md"
          >
            <MismuLogo size="md" />
          </a>

          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <button
              type="button"
              onClick={() => navigateSection('shop-collection')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Shop
            </button>
            <button
              type="button"
              onClick={() => navigateSection('tcs-delivery')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              TCS Rates
            </button>
            <button
              type="button"
              onClick={() => navigateSection('track-order')}
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Track Order
            </button>
            <button
              type="button"
              onClick={() => setView(view === 'admin' ? 'store' : 'admin')}
              className={`hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                view === 'admin' ? 'text-orange-600 font-semibold underline' : ''
              }`}
            >
              Store DB
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setDrawerInitialStep('bag');
                setIsCartOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="tabular-nums">Bag ({totalBagCount})</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {view === 'admin' ? (
          <StoreDbManager
            db={db}
            onDbUpdated={(nextDb) => setDb(nextDb)}
            onBackToStore={() => setView('store')}
          />
        ) : (
          <>
            {/* Section 1: Bright Storefront Hero */}
            <section id="top" className="bg-gradient-to-b from-orange-50/60 via-white to-white pt-10 pb-12 border-b border-slate-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                  <div className="lg:col-span-6 flex flex-col justify-center py-2">
                    <p className="text-xs font-semibold text-orange-600 mb-3">
                      {db.paymentSettings.storeTagline}
                    </p>
                    <h1
                      className="font-display font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-4"
                      style={{
                        fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
                        textWrap: 'balance',
                      }}
                    >
                      Cosmetics &amp; beauty parlour essentials, delivered nationwide.
                    </h1>
                    <p className="text-base text-slate-600 max-w-xl leading-relaxed mb-7">
                      Shop original makeup, skincare, haircare, and salon tools at Mismu. Pay effortlessly with EasyPaisa, JazzCash, or Cash on Delivery with transparent city-by-city TCS shipping rates.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mb-6">
                      <button
                        type="button"
                        onClick={() => navigateSection('shop-collection')}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                      >
                        Shop Collection
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      <PWAInstallButton />

                      <button
                        type="button"
                        onClick={() => setView('admin')}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors whitespace-nowrap"
                      >
                        <Database className="w-4 h-4 text-orange-600" />
                        Store DB
                      </button>
                    </div>

                    {/* Active City TCS Quick Picker */}
                    {selectedCity && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 text-sm">
                          <MapPin className="w-4 h-4 text-orange-600 shrink-0" />
                          <span className="text-slate-600">Shipping to</span>
                          <select
                            aria-label="Select delivery city"
                            value={selectedCity.id}
                            onChange={(e) => setSelectedCityId(e.target.value)}
                            className="font-semibold text-slate-900 bg-white border border-slate-200 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:border-orange-500"
                          >
                            {db.cities.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.city}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="text-xs sm:text-right text-slate-600 font-mono tabular-nums">
                          TCS Standard:{' '}
                          <span className="font-bold text-slate-900">
                            {formatPKR(selectedCity.standardFee)}
                          </span>{' '}
                          · {selectedCity.estimatedDays}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-6">
                    <div className="h-full min-h-[280px] lg:min-h-[400px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                      {!heroImgFailed ? (
                        <img
                          src={assetUrl('/src/assets/images/hero_mismu_cosmetics_1795340937400.jpg')}
                          alt="Mismu cosmetics and beauty parlour essentials collection"
                          referrerPolicy="no-referrer"
                          onError={() => setHeroImgFailed(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-orange-100 via-amber-50 to-white flex items-center justify-center p-8 text-center">
                          <MismuLogo size="lg" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4-Column Summary Strip below Hero Split */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-xs font-semibold text-emerald-700">EasyPaisa Ready</div>
                    <div className="font-display text-sm font-bold text-slate-900 mt-1">
                      Verified Mobile Checkout
                    </div>
                    <div className="font-mono text-xs text-slate-500 mt-0.5">
                      Merchant {db.paymentSettings.easypaisaAccountNumber}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-xs font-semibold text-rose-700">JazzCash Ready</div>
                    <div className="font-display text-sm font-bold text-slate-900 mt-1">
                      Instant Wallet Transfer
                    </div>
                    <div className="font-mono text-xs text-slate-500 mt-0.5">
                      Merchant {db.paymentSettings.jazzcashAccountNumber}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-xs font-semibold text-orange-600">TCS Courier Network</div>
                    <div className="font-display text-sm font-bold text-slate-900 mt-1">
                      {db.cities.length} Cities Mapped
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      City-specific rates &amp; tracking IDs
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200">
                    <div className="text-xs font-semibold text-slate-700">Full Store Database</div>
                    <div className="font-display text-sm font-bold text-slate-900 mt-1">
                      Edit Prices &amp; Cities Live
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      JSON backup &amp; instant updates
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Featured Product Collection */}
            <section id="shop-collection" className="py-16 bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                  <div>
                    <p className="text-xs font-semibold text-orange-600 mb-1">
                      Mismu Catalog
                    </p>
                    <h2 className="font-display text-3xl font-bold text-slate-900">
                      Featured Collection
                    </h2>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                            selectedCategory === cat
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="relative sm:w-56">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search products..."
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="py-16 text-center border border-slate-200 rounded-2xl bg-slate-50">
                    <p className="text-sm text-slate-600">
                      No products matched your filter. Try clearing the search or adding a new item in Store DB.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onSelect={(p) => setActiveProduct(p)}
                        onAddToCart={(p) => handleAddToCart(p, 1)}
                        onBuyNow={(p) => handleBuyNow(p, 1)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Section 3: City-Wise TCS Delivery Rates & Live Parcel Tracker */}
            <TcsRatesAndTracker
              cities={db.cities}
              orders={db.orders}
              selectedCityId={selectedCity?.id || ''}
              onSelectCity={(id) => setSelectedCityId(id)}
              freeThreshold={db.paymentSettings.freeDeliveryThreshold}
              initialTrackingQuery={trackingQuery}
            />
          </>
        )}
      </main>

      {/* Section 4: Clean Bright Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <MismuLogo size="sm" />
            <span className="text-xs text-slate-500">
              EasyPaisa · JazzCash · TCS Express Nationwide · Support{' '}
              <span className="font-mono">{db.paymentSettings.supportPhone}</span>
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setView(view === 'admin' ? 'store' : 'admin')}
              className="hover:text-orange-600 transition-colors"
            >
              {view === 'admin' ? 'Back to Storefront' : 'Manage Store Database'}
            </button>
            <a
              href="/api/db/export"
              download="mismu-database-backup.json"
              className="hover:text-orange-600 transition-colors"
            >
              Download DB JSON
            </a>
            <span className="text-slate-400">© 2026 Mismu</span>
          </div>
        </div>
      </footer>

      <ProductDetailModal
        product={activeProduct}
        selectedCity={selectedCity}
        freeThreshold={db.paymentSettings.freeDeliveryThreshold}
        onClose={() => setActiveProduct(null)}
        onAddToCart={(p, qty) => {
          handleAddToCart(p, qty);
          setDrawerInitialStep('bag');
          setIsCartOpen(true);
        }}
        onBuyNow={(p, qty) => handleBuyNow(p, qty)}
      />

      <CartCheckoutDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={() => setCart([])}
        cities={db.cities}
        selectedCityId={selectedCity?.id || ''}
        onSelectCity={(id) => setSelectedCityId(id)}
        paymentSettings={db.paymentSettings}
        onOrderCreated={handleOrderCreated}
        onTrackOrder={handleTrackFromReceipt}
        initialStep={drawerInitialStep}
      />

      <OfflineIndicator />
    </div>
  );
}
