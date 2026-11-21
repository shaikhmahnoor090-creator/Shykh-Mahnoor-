import { DEFAULT_MISMU_DB } from '../data/defaultDb';
import type {
  CityRate,
  MismuDatabase,
  Order,
  OrderStatus,
  PaymentMethodType,
  PaymentSettings,
  Product,
  TcsServiceTier,
} from '../types/store';
import { computeDeliveryFee } from './format';

const LOCAL_DB_KEY = 'mismu_store_db_v1';

function readLocalDb(): MismuDatabase {
  try {
    const raw = window.localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as MismuDatabase;
      if (
        Array.isArray(parsed.products) &&
        Array.isArray(parsed.cities) &&
        parsed.paymentSettings &&
        Array.isArray(parsed.orders)
      ) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  const seeded = JSON.parse(JSON.stringify(DEFAULT_MISMU_DB)) as MismuDatabase;
  writeLocalDb(seeded);
  return seeded;
}

function writeLocalDb(db: MismuDatabase): MismuDatabase {
  const nextDb: MismuDatabase = { ...db, updatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(nextDb));
  } catch {
    // Ignore storage quota errors
  }
  return nextDb;
}

async function tryApiJson<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; status: number; error?: string }> {
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { ok: false, status: res.status };
    }
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, status: res.status, error: data?.error || 'Request failed' };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function fetchStoreDb(): Promise<MismuDatabase> {
  const res = await tryApiJson<MismuDatabase>('/api/db');
  if (res.ok) {
    writeLocalDb(res.data);
    return res.data;
  }
  return readLocalDb();
}

export async function createOrder(payload: {
  customerName: string;
  customerPhone: string;
  address: string;
  postalCode: string;
  cityId: string;
  tcsServiceTier: TcsServiceTier;
  paymentMethod: PaymentMethodType;
  paymentAccountNumber?: string;
  paymentPin?: string;
  items: Array<{ productId: string; quantity: number }>;
}): Promise<{ order: Order; db: MismuDatabase }> {
  const res = await tryApiJson<{ order: Order; db: MismuDatabase }>('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    writeLocalDb(res.data.db);
    return res.data;
  }
  if (res.error) {
    throw new Error(res.error);
  }

  // Static hosting fallback (when no Express backend is present)
  const db = readLocalDb();
  const city = db.cities.find((c) => c.id === payload.cityId);
  if (!city) throw new Error('Please select a valid delivery city.');

  let subtotal = 0;
  const resolvedItems = payload.items.map((line) => {
    const prod = db.products.find((p) => p.id === line.productId);
    if (!prod) throw new Error('Product unavailable.');
    const qty = Math.max(1, Math.round(line.quantity));
    if (prod.stock < qty) throw new Error(`Only ${prod.stock} unit(s) left for ${prod.name}.`);
    prod.stock = Math.max(0, prod.stock - qty);
    subtotal += prod.price * qty;
    return {
      productId: prod.id,
      name: prod.name,
      sku: prod.sku,
      price: prod.price,
      quantity: qty,
      image: prod.image,
    };
  });

  const deliveryFee = computeDeliveryFee(
    city,
    subtotal,
    payload.tcsServiceTier,
    db.paymentSettings.freeDeliveryThreshold
  );
  const randomCode = Math.floor(10000000 + Math.random() * 89999999);
  const orderNum = Math.floor(4900 + Math.random() * 5000);
  const order: Order = {
    id: `MSM-${orderNum}`,
    tcsTrackingId: `TCS-${Math.floor(785000000 + Math.random() * 19999999)}`,
    createdAt: new Date().toISOString(),
    customerName: payload.customerName.trim(),
    customerPhone: payload.customerPhone.trim(),
    address: payload.address.trim(),
    postalCode: payload.postalCode?.trim() || '75500',
    cityId: city.id,
    cityName: city.city,
    province: city.province,
    tcsServiceTier: payload.tcsServiceTier,
    paymentMethod: payload.paymentMethod,
    paymentAccountNumber: payload.paymentAccountNumber?.trim(),
    paymentReference:
      payload.paymentMethod === 'easypaisa'
        ? `EP-${randomCode}`
        : payload.paymentMethod === 'jazzcash'
        ? `JC-${randomCode}`
        : `COD-${orderNum}`,
    paymentVerified: payload.paymentMethod !== 'cod',
    items: resolvedItems,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    status: 'Booked at Mismu Hub',
    estimatedDelivery:
      payload.tcsServiceTier === 'overnight' ? 'Next-Day TCS Priority' : city.estimatedDays,
  };
  db.orders.unshift(order);
  const saved = writeLocalDb(db);
  return { order, db: saved };
}

export async function addProduct(product: Partial<Product>): Promise<MismuDatabase> {
  const res = await tryApiJson<{ db: MismuDatabase }>('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (res.ok) return writeLocalDb(res.data.db);
  if (res.error) throw new Error(res.error);

  const db = readLocalDb();
  db.products.unshift({
    id: `prod-${Date.now().toString(36)}`,
    name: product.name?.trim() || 'Mismu Product',
    category: product.category || 'Home & Living',
    price: Math.max(1, Math.round(Number(product.price) || 1000)),
    stock: Math.max(0, Math.round(Number(product.stock) || 10)),
    sku: product.sku?.trim() || `MSM-${Math.floor(100 + Math.random() * 900)}`,
    weightKg: 0.5,
    tagline: product.tagline?.trim() || 'Curated everyday essential from Mismu.',
    description: product.description?.trim() || 'Crafted for everyday utility and bright living.',
    image: product.image?.trim() || '/src/assets/images/product_ceramic_kettle_1795271073442.jpg',
    featured: true,
  });
  return writeLocalDb(db);
}

export async function updateProduct(product: Product): Promise<MismuDatabase> {
  const res = await tryApiJson<{ db: MismuDatabase }>(`/api/products/${product.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (res.ok) return writeLocalDb(res.data.db);
  if (res.error) throw new Error(res.error);

  const db = readLocalDb();
  db.products = db.products.map((p) => (p.id === product.id ? product : p));
  return writeLocalDb(db);
}

export async function deleteProduct(id: string): Promise<MismuDatabase> {
  const res = await tryApiJson<{ db: MismuDatabase }>(`/api/products/${id}`, { method: 'DELETE' });
  if (res.ok) return writeLocalDb(res.data.db);
  if (res.error) throw new Error(res.error);

  const db = readLocalDb();
  db.products = db.products.filter((p) => p.id !== id);
  return writeLocalDb(db);
}

export async function addCity(city: Partial<CityRate>): Promise<MismuDatabase> {
  const res = await tryApiJson<{ db: MismuDatabase }>('/api/cities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(city),
  });
  if (res.ok) return writeLocalDb(res.data.db);
  if (res.error) throw new Error(res.error);

  const db = readLocalDb();
  db.cities.push({
    id: `city-${Date.now().toString(36)}`,
    city: city.city?.trim() || 'New City',
    province: city.province?.trim() || 'Punjab',
    tcsZone: city.tcsZone || 'Regional Standard',
    standardFee: Math.max(0, Math.round(Number(city.standardFee) || 250)),
    overnightExtra: Math.max(0, Math.round(Number(city.overnightExtra) || 150)),
    estimatedDays: city.estimatedDays?.trim() || '2–3 Working Days',
    codAvailable: city.codAvailable ?? true,
  });
  return writeLocalDb(db);
}

export async function updateCity(city: CityRate): Promise<MismuDatabase> {
  const res = await tryApiJson<{ db: MismuDatabase }>(`/api/cities/${city.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(city),
  });
  if (res.ok) return writeLocalDb(res.data.db);
  if (res.error) throw new Error(res.error);

  const db = readLocalDb();
  db.cities = db.cities.map((c) => (c.id === city.id ? city : c));
  return writeLocalDb(db);
}

export async function deleteCity(id: string): Promise<MismuDatabase> {
  const res = await tryApiJson<{ db: MismuDatabase }>(`/api/cities/${id}`, { method: 'DELETE' });
  if (res.ok) return writeLocalDb(res.data.db);
  if (res.error) throw new Error(res.error);

  const db = readLocalDb();
  if (db.cities.length <= 1) throw new Error('At least one city must remain active.');
  db.cities = db.cities.filter((c) => c.id !== id);
  return writeLocalDb(db);
}

export async function updatePaymentSettings(settings: PaymentSettings): Promise<MismuDatabase> {
  const res = await tryApiJson<{ db: MismuDatabase }>('/api/payment-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (res.ok) return writeLocalDb(res.data.db);
  if (res.error) throw new Error(res.error);

  const db = readLocalDb();
  db.paymentSettings = settings;
  return writeLocalDb(db);
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<MismuDatabase> {
  const res = await tryApiJson<{ db: MismuDatabase }>(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (res.ok) return writeLocalDb(res.data.db);
  if (res.error) throw new Error(res.error);

  const db = readLocalDb();
  db.orders = db.orders.map((o) =>
    o.id === orderId
      ? { ...o, status, paymentVerified: status === 'Delivered' ? true : o.paymentVerified }
      : o
  );
  return writeLocalDb(db);
}

export async function importFullDb(incoming: MismuDatabase): Promise<MismuDatabase> {
  const res = await tryApiJson<MismuDatabase>('/api/db/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(incoming),
  });
  if (res.ok) return writeLocalDb(res.data);
  if (res.error) throw new Error(res.error);

  return writeLocalDb(incoming);
}

export async function resetFullDb(): Promise<MismuDatabase> {
  const res = await tryApiJson<MismuDatabase>('/api/db/reset', { method: 'POST' });
  if (res.ok) return writeLocalDb(res.data);

  return writeLocalDb(JSON.parse(JSON.stringify(DEFAULT_MISMU_DB)) as MismuDatabase);
}
