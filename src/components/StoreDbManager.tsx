import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  RotateCcw,
  Check,
  Database,
  ArrowLeft,
  ImagePlus,
} from 'lucide-react';
import {
  DEFAULT_CATEGORIES,
  type CityRate,
  type MismuDatabase,
  type OrderStatus,
  type PaymentSettings,
  type Product,
  type ProductCategory,
} from '../types/store';
import { assetUrl, formatPKR, formatPaymentLabel } from '../utils/format';
import { compressImageFile } from '../utils/imageUpload';
import {
  addCity,
  addProduct,
  deleteCity,
  deleteProduct,
  importFullDb,
  resetFullDb,
  updateCity,
  updateOrderStatus,
  updatePaymentSettings,
  updateProduct,
} from '../utils/storeApi';

interface StoreDbManagerProps {
  db: MismuDatabase;
  onDbUpdated: (nextDb: MismuDatabase) => void;
  onBackToStore: () => void;
}

type AdminTab = 'products' | 'cities' | 'payments' | 'orders' | 'json';

const ORDER_STATUSES: OrderStatus[] = [
  'Booked at Mismu Hub',
  'Dispatched via TCS',
  'In Transit',
  'Out for Delivery',
  'Delivered',
];

const PRODUCT_IMAGE_PRESETS = [
  { label: 'Velvet Lipstick Trio', url: '/src/assets/images/product_velvet_lipstick_1795340939244.jpg' },
  { label: 'Bridal Glow Palette', url: '/src/assets/images/product_bridal_palette_1795340939817.jpg' },
  { label: 'Silk Matte Foundation', url: '/src/assets/images/product_hydra_foundation_1795340970272.jpg' },
  { label: '24K Parlour Facial Kit', url: '/src/assets/images/product_parlour_facial_kit_1795340938664.jpg' },
  { label: 'Zafraan Radiance Serum', url: '/src/assets/images/product_saffron_serum_1795271073475.jpg' },
  { label: 'Keratin Mask & Serum', url: '/src/assets/images/product_keratin_haircare_1795340940009.jpg' },
  { label: '12-Piece Brush Set', url: '/src/assets/images/product_makeup_brushes_1795340939136.jpg' },
  { label: 'Salon Hair Dryer & Styler', url: '/src/assets/images/product_salon_styler_1795340939825.jpg' },
];

export const StoreDbManager: React.FC<StoreDbManagerProps> = ({
  db,
  onDbUpdated,
  onBackToStore,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('products');
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [useCustomCat, setUseCustomCat] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    for (const p of db.products) {
      const c = p.category?.trim();
      if (c) set.add(c);
    }
    return Array.from(set);
  }, [db.products]);

  // New Product form
  const [newProd, setNewProd] = useState({
    name: '',
    category: 'Makeup' as ProductCategory,
    price: '2400',
    stock: '20',
    sku: '',
    tagline: '',
    image: PRODUCT_IMAGE_PRESETS[0].url,
  });

  const handleNewPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg('');
    setUploadingPhoto(true);
    try {
      const compressed = await compressImageFile(file);
      setNewProd((prev) => ({ ...prev, image: compressed }));
      showToast('Photo uploaded! Now click Add Product to save.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to process photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // New City form
  const [newCity, setNewCity] = useState({
    city: '',
    province: 'Punjab',
    tcsZone: 'Regional Standard' as CityRate['tcsZone'],
    standardFee: '270',
    overnightExtra: '150',
    estimatedDays: '2–3 Working Days',
    codAvailable: true,
  });

  // Payment settings draft
  const [payDraft, setPayDraft] = useState<PaymentSettings>(db.paymentSettings);

  // Raw JSON import draft
  const [jsonDraft, setJsonDraft] = useState('');

  const showToast = (msg: string) => {
    setErrorMsg('');
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 2800);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const finalCategory = newProd.category.trim() || 'Makeup';
    try {
      const nextDb = await addProduct({
        ...newProd,
        category: finalCategory,
        price: Number(newProd.price),
        stock: Number(newProd.stock),
      });
      onDbUpdated(nextDb);
      setNewProd({
        name: '',
        category: finalCategory,
        price: '2400',
        stock: '20',
        sku: '',
        tagline: '',
        image: PRODUCT_IMAGE_PRESETS[0].url,
      });
      setUseCustomCat(false);
      showToast('Product saved to Mismu database.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add product.');
    }
  };

  const handleUpdateProduct = async (product: Product) => {
    try {
      const nextDb = await updateProduct(product);
      onDbUpdated(nextDb);
      showToast(`Updated "${product.name}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update product.');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const nextDb = await deleteProduct(id);
      onDbUpdated(nextDb);
      showToast('Product removed.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete product.');
    }
  };

  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const nextDb = await addCity({
        ...newCity,
        standardFee: Number(newCity.standardFee),
        overnightExtra: Number(newCity.overnightExtra),
      });
      onDbUpdated(nextDb);
      setNewCity({
        city: '',
        province: 'Punjab',
        tcsZone: 'Regional Standard',
        standardFee: '270',
        overnightExtra: '150',
        estimatedDays: '2–3 Working Days',
        codAvailable: true,
      });
      showToast('City TCS rate added to database.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add city.');
    }
  };

  const handleUpdateCity = async (city: CityRate) => {
    try {
      const nextDb = await updateCity(city);
      onDbUpdated(nextDb);
      showToast(`Updated TCS delivery rate for ${city.city}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update city.');
    }
  };

  const handleDeleteCity = async (id: string) => {
    try {
      const nextDb = await deleteCity(id);
      onDbUpdated(nextDb);
      showToast('City removed.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Cannot delete city.');
    }
  };

  const handleSavePayments = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nextDb = await updatePaymentSettings(payDraft);
      onDbUpdated(nextDb);
      showToast('EasyPaisa, JazzCash & TCS settings saved.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings.');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const nextDb = await updateOrderStatus(orderId, status);
      onDbUpdated(nextDb);
      showToast(`Order ${orderId} updated to "${status}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update order status.');
    }
  };

  const handleImportJson = async () => {
    setErrorMsg('');
    try {
      const parsed = JSON.parse(jsonDraft);
      const nextDb = await importFullDb(parsed);
      onDbUpdated(nextDb);
      setPayDraft(nextDb.paymentSettings);
      showToast('Database imported and saved.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Invalid JSON syntax. Please paste valid JSON exported from Mismu.'
      );
    }
  };

  const handleResetDb = async () => {
    const nextDb = await resetFullDb();
    onDbUpdated(nextDb);
    setPayDraft(nextDb.paymentSettings);
    showToast('Database reset to default catalog and city rates.');
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mismu-database-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="py-10 bg-slate-50 min-h-[82vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Top Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Storefront
            </button>
            <h1 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <Database className="w-6 h-6 text-orange-600" />
              Mismu Store Database Manager
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Edit products, city-wise TCS delivery fees, EasyPaisa &amp; JazzCash accounts, and order tracking anytime. Saved directly to{' '}
              <span className="font-mono text-xs text-slate-800">data/mismu-db.json</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Download DB JSON
            </button>
            <button
              type="button"
              onClick={handleResetDb}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
          </div>
        </div>

        {/* Simple Owner Quick-Edit Guide */}
        <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-700">
          <div>
            <div className="font-display font-bold text-slate-900 mb-1">
              1. Apni Pic, Category &amp; Price Add Karein
            </div>
            <p>
              <strong>Products</strong> tab mein <strong>Upload Photo</strong> dabaa kar phone se apni tasweer lagayein, <strong>+ Add Custom Category</strong> se apni category banayein, aur price set karke <strong>Save / Add Product</strong> karein.
            </p>
          </div>
          <div>
            <div className="font-display font-bold text-slate-900 mb-1">
              2. City Delivery &amp; EasyPaisa/JazzCash
            </div>
            <p>
              <strong>City TCS Rates</strong> mein har shehar ki delivery fee change karein. <strong>EasyPaisa &amp; JazzCash</strong> tab mein apna number aur Free Delivery limit set karein.
            </p>
          </div>
          <div>
            <div className="font-display font-bold text-slate-900 mb-1">
              3. Design ya Features Edit Karna
            </div>
            <p>
              Colors, logo, ya naye sections change karne ke liye Google AI Studio chat mein likh dein — ya upar se <strong>Download DB JSON</strong> karke backup rakh lein.
            </p>
          </div>
        </div>

        {notice && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-xl w-fit">
          {(
            [
              { id: 'products', label: `Products (${db.products.length})` },
              { id: 'cities', label: `City TCS Rates (${db.cities.length})` },
              { id: 'payments', label: 'EasyPaisa & JazzCash' },
              { id: 'orders', label: `Orders (${db.orders.length})` },
              { id: 'json', label: 'Raw JSON / Import' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTab(t.id);
                if (t.id === 'json') {
                  setJsonDraft(JSON.stringify(db, null, 2));
                }
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Products */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <form
              onSubmit={handleAddProduct}
              className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
            >
              <h2 className="font-display text-base font-bold text-slate-900">
                Add New Product
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Huda Bridal Matte Lip Kit"
                    value={newProd.name}
                    onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Category (Apni Marzi ki Banayein)
                  </label>
                  {!useCustomCat ? (
                    <select
                      value={newProd.category}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setUseCustomCat(true);
                          setNewProd({ ...newProd, category: '' });
                        } else {
                          setNewProd({ ...newProd, category: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      {availableCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value="__custom__">+ Add Custom Category...</option>
                    </select>
                  ) : (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        autoFocus
                        placeholder="Type category (e.g. Nails)"
                        value={newProd.category}
                        onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                        className="flex-1 min-w-0 px-3 py-2 text-sm bg-white border border-orange-400 rounded-lg focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setUseCustomCat(false);
                          setNewProd({ ...newProd, category: availableCategories[0] || 'Makeup' });
                        }}
                        className="px-2.5 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 whitespace-nowrap"
                      >
                        List
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Price (PKR)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="2400"
                      value={newProd.price}
                      onChange={(e) => setNewProd({ ...newProd, price: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Stock
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      placeholder="20"
                      value={newProd.stock}
                      onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Photo Upload + Preset / Link Picker */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center gap-4">
                <img
                  src={assetUrl(newProd.image)}
                  alt="Product preview"
                  referrerPolicy="no-referrer"
                  className="w-20 h-16 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                />

                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
                  <label className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap">
                    <ImagePlus className="w-4 h-4" />
                    <span>{uploadingPhoto ? 'Uploading...' : 'Upload Own Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleNewPhotoUpload}
                      className="sr-only"
                    />
                  </label>

                  <select
                    aria-label="Choose preset photo"
                    value={
                      PRODUCT_IMAGE_PRESETS.some((p) => p.url === newProd.image)
                        ? newProd.image
                        : '__custom__'
                    }
                    onChange={(e) => {
                      if (e.target.value !== '__custom__') {
                        setNewProd({ ...newProd, image: e.target.value });
                      }
                    }}
                    className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    {!PRODUCT_IMAGE_PRESETS.some((p) => p.url === newProd.image) && (
                      <option value="__custom__">Custom Photo Selected</option>
                    )}
                    {PRODUCT_IMAGE_PRESETS.map((img) => (
                      <option key={img.url} value={img.url}>
                        Preset: {img.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    placeholder="Or paste image URL (https://...)"
                    value={newProd.image.startsWith('data:') ? '' : newProd.image}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      if (val) setNewProd({ ...newProd, image: val });
                    }}
                    className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Short tagline (e.g. Waterproof bridal kohl eyeliner)"
                  value={newProd.tagline}
                  onChange={(e) => setNewProd({ ...newProd, tagline: e.target.value })}
                  className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>
            </form>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="py-3 px-4">Photo</th>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Price (PKR)</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {db.products.map((prod) => (
                      <EditableProductRow
                        key={prod.id}
                        product={prod}
                        availableCategories={availableCategories}
                        onSave={handleUpdateProduct}
                        onDelete={handleDeleteProduct}
                        onPhotoError={(msg) => setErrorMsg(msg)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: City TCS Rates */}
        {activeTab === 'cities' && (
          <div className="space-y-6">
            <form
              onSubmit={handleAddCity}
              className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
            >
              <h2 className="font-display text-base font-bold text-slate-900">
                Add New City &amp; TCS Delivery Fee
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <input
                  type="text"
                  required
                  placeholder="City Name (e.g. Mardan)"
                  value={newCity.city}
                  onChange={(e) => setNewCity({ ...newCity, city: e.target.value })}
                  className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Province"
                  value={newCity.province}
                  onChange={(e) => setNewCity({ ...newCity, province: e.target.value })}
                  className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="number"
                  required
                  min={0}
                  placeholder="Standard TCS (Rs)"
                  value={newCity.standardFee}
                  onChange={(e) => setNewCity({ ...newCity, standardFee: e.target.value })}
                  className="px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="number"
                  required
                  min={0}
                  placeholder="Priority Add-on (Rs)"
                  value={newCity.overnightExtra}
                  onChange={(e) => setNewCity({ ...newCity, overnightExtra: e.target.value })}
                  className="px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  required
                  placeholder="Est. Days (e.g. 2–3 Working Days)"
                  value={newCity.estimatedDays}
                  onChange={(e) => setNewCity({ ...newCity, estimatedDays: e.target.value })}
                  className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Add City
                </button>
              </div>
            </form>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="py-3 px-4">City / Province</th>
                      <th className="py-3 px-4">Standard TCS (PKR)</th>
                      <th className="py-3 px-4">Overnight Extra (PKR)</th>
                      <th className="py-3 px-4">Est. Transit</th>
                      <th className="py-3 px-4">TCS COD</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {db.cities.map((city) => (
                      <EditableCityRow
                        key={city.id}
                        city={city}
                        onSave={handleUpdateCity}
                        onDelete={handleDeleteCity}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Payment Settings */}
        {activeTab === 'payments' && (
          <form
            onSubmit={handleSavePayments}
            className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 max-w-3xl"
          >
            <h2 className="font-display text-lg font-bold text-slate-900">
              EasyPaisa, JazzCash &amp; TCS Configuration
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="flex items-center justify-between text-sm font-bold text-slate-900">
                  <span>EasyPaisa Enabled</span>
                  <input
                    type="checkbox"
                    checked={payDraft.easypaisaEnabled}
                    onChange={(e) =>
                      setPayDraft({ ...payDraft, easypaisaEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-emerald-600"
                  />
                </label>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Account Title</label>
                  <input
                    type="text"
                    value={payDraft.easypaisaAccountTitle}
                    onChange={(e) =>
                      setPayDraft({ ...payDraft, easypaisaAccountTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">EasyPaisa Number</label>
                  <input
                    type="text"
                    value={payDraft.easypaisaAccountNumber}
                    onChange={(e) =>
                      setPayDraft({ ...payDraft, easypaisaAccountNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="flex items-center justify-between text-sm font-bold text-slate-900">
                  <span>JazzCash Enabled</span>
                  <input
                    type="checkbox"
                    checked={payDraft.jazzcashEnabled}
                    onChange={(e) =>
                      setPayDraft({ ...payDraft, jazzcashEnabled: e.target.checked })
                    }
                    className="w-4 h-4 accent-rose-600"
                  />
                </label>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Account Title</label>
                  <input
                    type="text"
                    value={payDraft.jazzcashAccountTitle}
                    onChange={(e) =>
                      setPayDraft({ ...payDraft, jazzcashAccountTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">JazzCash Number</label>
                  <input
                    type="text"
                    value={payDraft.jazzcashAccountNumber}
                    onChange={(e) =>
                      setPayDraft({ ...payDraft, jazzcashAccountNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Free TCS Delivery Threshold (PKR, 0 to disable)
                </label>
                <input
                  type="number"
                  min={0}
                  value={payDraft.freeDeliveryThreshold}
                  onChange={(e) =>
                    setPayDraft({
                      ...payDraft,
                      freeDeliveryThreshold: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payDraft.codEnabled}
                    onChange={(e) => setPayDraft({ ...payDraft, codEnabled: e.target.checked })}
                    className="w-4 h-4 accent-orange-600"
                  />
                  Enable TCS Cash on Delivery (COD) Storewide
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold"
            >
              <Save className="w-4 h-4" />
              Save Payment Settings
            </button>
          </form>
        )}

        {/* Tab 4: Orders & TCS Tracking */}
        {activeTab === 'orders' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="py-3 px-4">Order &amp; TCS ID</th>
                    <th className="py-3 px-4">Customer &amp; City</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4">TCS Tracking Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {db.orders.map((ord) => (
                    <tr key={ord.id}>
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900">{ord.id}</div>
                        <div className="font-mono text-xs text-orange-600">{ord.tcsTrackingId}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{ord.customerName}</div>
                        <div className="text-xs text-slate-500">
                          {ord.cityName} · {ord.customerPhone}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-slate-800">
                          {formatPaymentLabel(ord.paymentMethod)}
                        </div>
                        <div className="font-mono text-xs text-slate-500">
                          {ord.paymentReference}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatPKR(ord.total)}
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={ord.status}
                          onChange={(e) =>
                            handleUpdateOrderStatus(ord.id, e.target.value as OrderStatus)
                          }
                          className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          {ORDER_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Raw JSON & Import */}
        {activeTab === 'json' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Full Mismu JSON Database
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Copy, inspect, or edit the entire JSON database directly and click Apply JSON Update.
                </p>
              </div>
              <button
                type="button"
                onClick={handleImportJson}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                Apply JSON Update
              </button>
            </div>
            <textarea
              rows={18}
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              className="w-full p-4 font-mono text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-orange-500"
            />
          </div>
        )}
      </div>
    </section>
  );
};

const EditableProductRow: React.FC<{
  product: Product;
  availableCategories: string[];
  onSave: (p: Product) => void;
  onDelete: (id: string) => void;
  onPhotoError: (msg: string) => void;
}> = ({ product, availableCategories, onSave, onDelete, onPhotoError }) => {
  const [draft, setDraft] = useState(product);
  const [customCatMode, setCustomCatMode] = useState(false);

  useEffect(() => {
    setDraft(product);
  }, [product]);

  const handleRowPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      const next = { ...draft, image: compressed };
      setDraft(next);
      onSave(next);
    } catch (err) {
      onPhotoError(err instanceof Error ? err.message : 'Failed to upload product photo.');
    }
  };

  return (
    <tr>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <img
            src={assetUrl(draft.image)}
            alt={draft.name}
            referrerPolicy="no-referrer"
            className="w-11 h-9 rounded-md object-cover border border-slate-200 bg-slate-50 shrink-0"
          />
          <label className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap">
            <ImagePlus className="w-3 h-3" />
            Photo
            <input
              type="file"
              accept="image/*"
              onChange={handleRowPhotoChange}
              className="sr-only"
            />
          </label>
        </div>
      </td>
      <td className="py-3 px-4">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full min-w-[160px] px-2.5 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg font-medium"
        />
      </td>
      <td className="py-3 px-4">
        {!customCatMode ? (
          <select
            value={availableCategories.includes(draft.category) ? draft.category : '__other__'}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                setCustomCatMode(true);
              } else if (e.target.value !== '__other__') {
                setDraft({ ...draft, category: e.target.value });
              }
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
          >
            {!availableCategories.includes(draft.category) && (
              <option value="__other__">{draft.category}</option>
            )}
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
            <option value="__custom__">+ Custom...</option>
          </select>
        ) : (
          <div className="flex gap-1">
            <input
              type="text"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              placeholder="Category"
              className="w-28 px-2 py-1.5 text-xs bg-white border border-orange-400 rounded-lg"
            />
            <button
              type="button"
              onClick={() => setCustomCatMode(false)}
              className="px-2 py-1 text-[11px] border border-slate-200 rounded-lg bg-slate-50"
            >
              List
            </button>
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        <input
          type="number"
          min={1}
          value={draft.price}
          onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) || 0 })}
          className="w-24 px-2.5 py-1.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
        />
      </td>
      <td className="py-3 px-4">
        <input
          type="number"
          min={0}
          value={draft.stock}
          onChange={(e) => setDraft({ ...draft, stock: Number(e.target.value) || 0 })}
          className="w-20 px-2.5 py-1.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
        />
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
        <button
          type="button"
          onClick={() =>
            onSave({ ...draft, category: draft.category.trim() || 'Makeup' })
          }
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </button>
        <button
          type="button"
          onClick={() => onDelete(product.id)}
          aria-label={`Delete ${product.name}`}
          className="inline-flex items-center p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};

const EditableCityRow: React.FC<{
  city: CityRate;
  onSave: (c: CityRate) => void;
  onDelete: (id: string) => void;
}> = ({ city, onSave, onDelete }) => {
  const [draft, setDraft] = useState(city);
  return (
    <tr>
      <td className="py-3 px-4">
        <div className="font-semibold text-slate-900">{city.city}</div>
        <div className="text-xs text-slate-500">{city.province}</div>
      </td>
      <td className="py-3 px-4">
        <input
          type="number"
          min={0}
          value={draft.standardFee}
          onChange={(e) => setDraft({ ...draft, standardFee: Number(e.target.value) || 0 })}
          className="w-24 px-2.5 py-1.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
        />
      </td>
      <td className="py-3 px-4">
        <input
          type="number"
          min={0}
          value={draft.overnightExtra}
          onChange={(e) => setDraft({ ...draft, overnightExtra: Number(e.target.value) || 0 })}
          className="w-24 px-2.5 py-1.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg tabular-nums"
        />
      </td>
      <td className="py-3 px-4">
        <input
          type="text"
          value={draft.estimatedDays}
          onChange={(e) => setDraft({ ...draft, estimatedDays: e.target.value })}
          className="w-36 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
        />
      </td>
      <td className="py-3 px-4">
        <input
          type="checkbox"
          checked={draft.codAvailable}
          onChange={(e) => setDraft({ ...draft, codAvailable: e.target.checked })}
          className="w-4 h-4 accent-orange-600"
        />
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </button>
        <button
          type="button"
          onClick={() => onDelete(city.id)}
          aria-label={`Delete ${city.city}`}
          className="inline-flex items-center p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};
