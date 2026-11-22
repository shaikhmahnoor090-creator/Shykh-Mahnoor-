import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_MISMU_DB } from '../data/defaultDb';
import {
  auth,
  db as firestoreDb,
  handleFirestoreError,
  isOwnerUser,
  OperationType,
} from '../firebase';
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
import { computeDeliveryFee, formatPKR, formatPaymentLabel } from './format';

const LOCAL_DB_KEY = 'mismu_store_db_v2';
const PAYMENT_CONFIG_DOC_ID = 'payment_settings';

export interface PublicTrackingInfo {
  id: string;
  tcsTrackingId: string;
  cityName: string;
  province: string;
  tcsServiceTier: TcsServiceTier;
  status: OrderStatus;
  estimatedDelivery: string;
  total: number;
  itemCount?: number;
  paymentMethod?: PaymentMethodType;
}

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
        if (parsed.cities.length < 30) {
          const existingIds = new Set(parsed.cities.map((c) => c.id));
          const missingCities = DEFAULT_MISMU_DB.cities.filter((c) => !existingIds.has(c.id));
          const upgraded: MismuDatabase = {
            ...parsed,
            cities: sortCitiesList([...parsed.cities, ...missingCities]),
          };
          writeLocalDb(upgraded);
          return upgraded;
        }
        return {
          ...parsed,
          cities: sortCitiesList(parsed.cities),
        };
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

function sanitizeId(raw: string, prefix: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 60);
  return clean || `${prefix}-${Date.now().toString(36)}`;
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  return new Date().toISOString();
}

function clampStr(val: string | undefined, max: number, fallback = ''): string {
  const trimmed = (val ?? '').trim();
  const s = trimmed || fallback;
  return s.slice(0, max);
}

function sanitizeProductPayload(product: Product) {
  const safeImage = clampStr(
    product.image,
    245000,
    '/src/assets/images/product_velvet_lipstick_1795340939244.jpg'
  );
  return {
    id: sanitizeId(product.id, 'prod'),
    name: clampStr(product.name, 140, 'Mismu Beauty Item'),
    category: clampStr(product.category, 60, 'Makeup'),
    price: Math.max(1, Math.min(10000000, Math.round(Number(product.price) || 1000))),
    stock: Math.max(0, Math.min(100000, Math.round(Number(product.stock) || 0))),
    tagline: clampStr(product.tagline, 240),
    description: clampStr(product.description, 1200),
    image: safeImage,
    sku: clampStr(product.sku, 40, `MSM-${Math.floor(100 + Math.random() * 900)}`),
    weightKg: Math.max(0, Math.min(500, Number(product.weightKg) || 0.35)),
    featured: Boolean(product.featured ?? true),
    updatedAt: serverTimestamp(),
  };
}

function sanitizeCityPayload(city: CityRate) {
  const validZones: CityRate['tcsZone'][] = [
    'Metro Express',
    'Regional Standard',
    'Air Cargo',
    'Northern Special',
  ];
  return {
    id: sanitizeId(city.id, 'city'),
    city: clampStr(city.city, 80, 'New City'),
    province: clampStr(city.province, 80, 'Punjab'),
    tcsZone: validZones.includes(city.tcsZone) ? city.tcsZone : 'Regional Standard',
    standardFee: Math.max(0, Math.min(100000, Math.round(Number(city.standardFee) || 0))),
    overnightExtra: Math.max(0, Math.min(100000, Math.round(Number(city.overnightExtra) || 0))),
    estimatedDays: clampStr(city.estimatedDays, 60, '2–3 Working Days'),
    codAvailable: Boolean(city.codAvailable),
    updatedAt: serverTimestamp(),
  };
}

function sanitizePaymentPayload(settings: PaymentSettings) {
  return {
    easypaisaEnabled: Boolean(settings.easypaisaEnabled),
    easypaisaAccountTitle: clampStr(settings.easypaisaAccountTitle, 100, 'Mismu Store'),
    easypaisaAccountNumber: clampStr(settings.easypaisaAccountNumber, 30, '0300-0000000'),
    jazzcashEnabled: Boolean(settings.jazzcashEnabled),
    jazzcashAccountTitle: clampStr(settings.jazzcashAccountTitle, 100, 'Mismu Store'),
    jazzcashAccountNumber: clampStr(settings.jazzcashAccountNumber, 30, '0300-0000000'),
    codEnabled: Boolean(settings.codEnabled),
    freeDeliveryThreshold: Math.max(
      0,
      Math.min(1000000, Math.round(Number(settings.freeDeliveryThreshold) || 0))
    ),
    storeTagline: clampStr(settings.storeTagline, 180),
    supportPhone: clampStr(settings.supportPhone, 30),
    updatedAt: serverTimestamp(),
  };
}

function docToProduct(data: Record<string, unknown>, docId: string): Product {
  return {
    id: String(data.id || docId),
    name: String(data.name || 'Mismu Product'),
    category: String(data.category || 'Makeup'),
    price: Number(data.price) || 1000,
    stock: Number(data.stock) || 0,
    tagline: String(data.tagline || ''),
    description: String(data.description || ''),
    image: String(data.image || '/src/assets/images/product_velvet_lipstick_1795340939244.jpg'),
    sku: String(data.sku || 'MSM-100'),
    weightKg: Number(data.weightKg) || 0.35,
    featured: typeof data.featured === 'boolean' ? data.featured : true,
  };
}

const PRIORITY_CITY_IDS = [
  'city-khi',
  'city-lhr',
  'city-isb',
  'city-rwp',
  'city-hyd',
  'city-fsd',
  'city-mux',
  'city-skt',
  'city-guj',
  'city-pew',
  'city-abt',
  'city-bwp',
  'city-skz',
  'city-uet',
];

function sortCitiesList(cities: CityRate[]): CityRate[] {
  return [...cities].sort((a, b) => {
    const ia = PRIORITY_CITY_IDS.indexOf(a.id);
    const ib = PRIORITY_CITY_IDS.indexOf(b.id);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.city.localeCompare(b.city);
  });
}

async function commitBatchedWrites(
  ops: Array<{
    ref: ReturnType<typeof doc>;
    data: Record<string, unknown>;
  }>
): Promise<void> {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const batch = writeBatch(firestoreDb);
    const slice = ops.slice(i, i + CHUNK_SIZE);
    for (const op of slice) {
      batch.set(op.ref, op.data);
    }
    await batch.commit();
  }
}

function docToCity(data: Record<string, unknown>, docId: string): CityRate {
  return {
    id: String(data.id || docId),
    city: String(data.city || ''),
    province: String(data.province || ''),
    tcsZone: (data.tcsZone as CityRate['tcsZone']) || 'Regional Standard',
    standardFee: Number(data.standardFee) || 0,
    overnightExtra: Number(data.overnightExtra) || 0,
    estimatedDays: String(data.estimatedDays || '2–3 Working Days'),
    codAvailable: Boolean(data.codAvailable ?? true),
  };
}

function docToOrder(data: Record<string, unknown>, docId: string): Order {
  return {
    id: String(data.id || docId),
    customerUid: typeof data.customerUid === 'string' ? data.customerUid : undefined,
    tcsTrackingId: String(data.tcsTrackingId || ''),
    createdAt: timestampToIso(data.createdAt),
    customerName: String(data.customerName || ''),
    customerPhone: String(data.customerPhone || ''),
    address: String(data.address || ''),
    postalCode: String(data.postalCode || ''),
    cityId: String(data.cityId || ''),
    cityName: String(data.cityName || ''),
    province: String(data.province || ''),
    tcsServiceTier: (data.tcsServiceTier as TcsServiceTier) || 'standard',
    paymentMethod: (data.paymentMethod as PaymentMethodType) || 'cod',
    paymentAccountNumber:
      typeof data.paymentAccountNumber === 'string' ? data.paymentAccountNumber : undefined,
    paymentReference: String(data.paymentReference || ''),
    paymentVerified: Boolean(data.paymentVerified),
    items: Array.isArray(data.items) ? (data.items as Order['items']) : [],
    subtotal: Number(data.subtotal) || 0,
    deliveryFee: Number(data.deliveryFee) || 0,
    total: Number(data.total) || 0,
    status: (data.status as OrderStatus) || 'Booked at Mismu Hub',
    estimatedDelivery: String(data.estimatedDelivery || ''),
  };
}

export function subscribePublicCatalog(callbacks: {
  onProducts: (products: Product[], fromCloud: boolean) => void;
  onCities: (cities: CityRate[], fromCloud: boolean) => void;
  onPaymentSettings: (settings: PaymentSettings, fromCloud: boolean) => void;
}): Unsubscribe {
  const productsQuery = query(collection(firestoreDb, 'products'), where('price', '>', 0));
  const citiesQuery = query(collection(firestoreDb, 'cities'), where('standardFee', '>=', 0));
  const settingsRef = doc(firestoreDb, 'store_config', PAYMENT_CONFIG_DOC_ID);

  const unsubProducts = onSnapshot(
    productsQuery,
    (snap) => {
      if (!snap.empty) {
        const list = snap.docs.map((d) => docToProduct(d.data() as Record<string, unknown>, d.id));
        callbacks.onProducts(list, true);
      } else {
        callbacks.onProducts(DEFAULT_MISMU_DB.products, false);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    }
  );

  const unsubCities = onSnapshot(
    citiesQuery,
    (snap) => {
      if (!snap.empty) {
        const cloudList = snap.docs.map((d) => docToCity(d.data() as Record<string, unknown>, d.id));
        callbacks.onCities(sortCitiesList(cloudList), true);
      } else {
        callbacks.onCities(sortCitiesList(DEFAULT_MISMU_DB.cities), false);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cities');
    }
  );

  const unsubSettings = onSnapshot(
    settingsRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        callbacks.onPaymentSettings(
          {
            easypaisaEnabled: Boolean(data.easypaisaEnabled ?? true),
            easypaisaAccountTitle: String(data.easypaisaAccountTitle || 'Mismu Store'),
            easypaisaAccountNumber: String(data.easypaisaAccountNumber || '0345-8829104'),
            jazzcashEnabled: Boolean(data.jazzcashEnabled ?? true),
            jazzcashAccountTitle: String(data.jazzcashAccountTitle || 'Mismu Store'),
            jazzcashAccountNumber: String(data.jazzcashAccountNumber || '0301-9942180'),
            codEnabled: Boolean(data.codEnabled ?? true),
            freeDeliveryThreshold: Number(data.freeDeliveryThreshold ?? 8000),
            storeTagline: String(
              data.storeTagline || 'Cosmetics, Skincare & Beauty Parlour Store — Pakistan'
            ),
            supportPhone: String(data.supportPhone || '0300-8451290'),
          },
          true
        );
      } else {
        callbacks.onPaymentSettings(DEFAULT_MISMU_DB.paymentSettings, false);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `store_config/${PAYMENT_CONFIG_DOC_ID}`);
    }
  );

  return () => {
    unsubProducts();
    unsubCities();
    unsubSettings();
  };
}

export function subscribeUserOrders(
  user: User,
  onOrders: (orders: Order[]) => void
): Unsubscribe {
  const isOwner = isOwnerUser(user);
  const ordersQuery = isOwner
    ? query(collection(firestoreDb, 'orders'), orderBy('createdAt', 'desc'))
    : query(collection(firestoreDb, 'orders'), where('customerUid', '==', user.uid));

  return onSnapshot(
    ordersQuery,
    (snap) => {
      const list = snap.docs
        .map((d) => docToOrder(d.data() as Record<string, unknown>, d.id))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onOrders(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    }
  );
}

export async function seedCloudCatalogIfEmpty(sourceDb: MismuDatabase): Promise<boolean> {
  if (!isOwnerUser(auth.currentUser)) return false;

  try {
    const prodSnap = await getDocs(
      query(collection(firestoreDb, 'products'), where('price', '>', 0))
    );
    const citySnap = await getDocs(
      query(collection(firestoreDb, 'cities'), where('standardFee', '>=', 0))
    );
    const settingsSnap = await getDoc(doc(firestoreDb, 'store_config', PAYMENT_CONFIG_DOC_ID));

    const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];

    if (prodSnap.empty) {
      for (const p of sourceDb.products) {
        const clean = sanitizeProductPayload(p);
        ops.push({ ref: doc(firestoreDb, 'products', clean.id), data: clean });
      }
    }

    // Seed all Pakistan cities initially, or expand from the starter 15-city set without overwriting owner edits
    if (citySnap.empty || citySnap.size < 30) {
      const existingCityIds = new Set(citySnap.docs.map((d) => d.id));
      for (const c of sourceDb.cities) {
        const clean = sanitizeCityPayload(c);
        if (!existingCityIds.has(clean.id)) {
          ops.push({ ref: doc(firestoreDb, 'cities', clean.id), data: clean });
        }
      }
    }

    if (!settingsSnap.exists()) {
      ops.push({
        ref: doc(firestoreDb, 'store_config', PAYMENT_CONFIG_DOC_ID),
        data: sanitizePaymentPayload(sourceDb.paymentSettings),
      });
    }

    if (ops.length === 0) {
      return false;
    }

    await commitBatchedWrites(ops);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'products/cities/store_config');
  }
}

export async function syncLocalCatalogToCloud(sourceDb: MismuDatabase): Promise<void> {
  if (!isOwnerUser(auth.currentUser)) {
    throw new Error('Sign in with owner Google account (shaikhmahnoor090@gmail.com) to publish to cloud.');
  }
  try {
    const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, unknown> }> = [];
    for (const p of sourceDb.products) {
      const clean = sanitizeProductPayload(p);
      ops.push({ ref: doc(firestoreDb, 'products', clean.id), data: clean });
    }
    for (const c of sourceDb.cities) {
      const clean = sanitizeCityPayload(c);
      ops.push({ ref: doc(firestoreDb, 'cities', clean.id), data: clean });
    }
    ops.push({
      ref: doc(firestoreDb, 'store_config', PAYMENT_CONFIG_DOC_ID),
      data: sanitizePaymentPayload(sourceDb.paymentSettings),
    });
    await commitBatchedWrites(ops);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'products/cities/store_config');
  }
}

export async function fetchStoreDb(): Promise<MismuDatabase> {
  try {
    const [prodSnap, citySnap, settingsSnap] = await Promise.all([
      getDocs(query(collection(firestoreDb, 'products'), where('price', '>', 0))),
      getDocs(query(collection(firestoreDb, 'cities'), where('standardFee', '>=', 0))),
      getDoc(doc(firestoreDb, 'store_config', PAYMENT_CONFIG_DOC_ID)),
    ]);

    const base = readLocalDb();
    const products = prodSnap.empty
      ? base.products
      : prodSnap.docs.map((d) => docToProduct(d.data() as Record<string, unknown>, d.id));
    const cities = citySnap.empty
      ? sortCitiesList(base.cities)
      : sortCitiesList(
          citySnap.docs.map((d) => docToCity(d.data() as Record<string, unknown>, d.id))
        );
    const paymentSettings = settingsSnap.exists()
      ? ({
          ...base.paymentSettings,
          ...(settingsSnap.data() as Partial<PaymentSettings>),
        } as PaymentSettings)
      : base.paymentSettings;

    return writeLocalDb({
      ...base,
      products,
      cities,
      paymentSettings,
    });
  } catch {
    return readLocalDb();
  }
}

export async function trackShipmentById(trackingOrOrderId: string): Promise<PublicTrackingInfo | null> {
  const cleanId = trackingOrOrderId.trim().toUpperCase();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(cleanId)) {
    return null;
  }

  try {
    const trackingSnap = await getDoc(doc(firestoreDb, 'shipment_tracking', cleanId));
    if (trackingSnap.exists()) {
      const data = trackingSnap.data() as Record<string, unknown>;
      return {
        id: String(data.orderId || cleanId),
        tcsTrackingId: String(data.tcsTrackingId || cleanId),
        cityName: String(data.cityName || ''),
        province: String(data.province || ''),
        tcsServiceTier: (data.tcsServiceTier as TcsServiceTier) || 'standard',
        status: (data.status as OrderStatus) || 'Booked at Mismu Hub',
        estimatedDelivery: String(data.estimatedDelivery || ''),
        total: Number(data.total) || 0,
        itemCount: Number(data.itemCount) || 1,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `shipment_tracking/${cleanId}`);
  }

  // Fallback check if user entered an Order ID while signed in
  if (auth.currentUser?.emailVerified) {
    try {
      const orderSnap = await getDoc(doc(firestoreDb, 'orders', cleanId));
      if (orderSnap.exists()) {
        const data = orderSnap.data() as Record<string, unknown>;
        return {
          id: String(data.id || cleanId),
          tcsTrackingId: String(data.tcsTrackingId || ''),
          cityName: String(data.cityName || ''),
          province: String(data.province || ''),
          tcsServiceTier: (data.tcsServiceTier as TcsServiceTier) || 'standard',
          status: (data.status as OrderStatus) || 'Booked at Mismu Hub',
          estimatedDelivery: String(data.estimatedDelivery || ''),
          total: Number(data.total) || 0,
          paymentMethod: (data.paymentMethod as PaymentMethodType) || 'cod',
        };
      }
    } catch {
      // Not owner or doesn't exist — gracefully return null
    }
  }

  return null;
}

export async function createOrder(
  payload: {
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
  },
  currentDb?: MismuDatabase
): Promise<{ order: Order; db: MismuDatabase }> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error('Please sign in with Google once so we can securely confirm and save your order.');
  }

  const db = currentDb || readLocalDb();
  const city = db.cities.find((c) => c.id === payload.cityId);
  if (!city) throw new Error('Please select a valid delivery city.');
  if (!payload.items.length || payload.items.length > 50) {
    throw new Error('Please add between 1 and 50 items to your bag.');
  }

  let subtotal = 0;
  let itemCount = 0;
  const resolvedItems = payload.items.map((line) => {
    const prod = db.products.find((p) => p.id === line.productId);
    if (!prod) throw new Error('Product unavailable.');
    const qty = Math.max(1, Math.round(line.quantity));
    if (prod.stock < qty) throw new Error(`Only ${prod.stock} unit(s) left for ${prod.name}.`);
    subtotal += prod.price * qty;
    itemCount += qty;
    return {
      productId: prod.id,
      name: clampStr(prod.name, 140),
      sku: clampStr(prod.sku, 40),
      price: prod.price,
      quantity: qty,
      // Keep Order doc comfortably within 1 MB even for large carts
      image:
        prod.image.startsWith('data:') && prod.image.length > 60000
          ? '/src/assets/images/product_velvet_lipstick_1795340939244.jpg'
          : prod.image,
    };
  });

  const deliveryFee = computeDeliveryFee(
    city,
    subtotal,
    payload.tcsServiceTier,
    db.paymentSettings.freeDeliveryThreshold
  );
  const total = subtotal + deliveryFee;
  const randomCode = Math.floor(10000000 + Math.random() * 89999999);
  const orderNum = Math.floor(4900 + Math.random() * 5000);
  const uniqueSuffix = Date.now().toString(36).slice(-4).toUpperCase();
  const orderId = sanitizeId(`MSM-${orderNum}-${uniqueSuffix}`, 'MSM');
  const tcsTrackingId = sanitizeId(`TCS-${Math.floor(785000000 + Math.random() * 19999999)}`, 'TCS');
  const estimatedDelivery =
    payload.tcsServiceTier === 'overnight' ? 'Next-Day TCS Priority' : city.estimatedDays;
  const tidRaw = payload.paymentPin?.trim().replace(/\s+/g, '') || '';
  const paymentReference =
    payload.paymentMethod === 'easypaisa'
      ? tidRaw
        ? `EP-${tidRaw}`
        : `EP-${randomCode}`
      : payload.paymentMethod === 'jazzcash'
      ? tidRaw
        ? `JC-${tidRaw}`
        : `JC-${randomCode}`
      : `COD-${orderNum}`;
  const paymentVerified = false;

  const orderFirestoreDoc: Record<string, unknown> = {
    id: orderId,
    customerUid: user.uid,
    tcsTrackingId,
    customerName: clampStr(payload.customerName, 120),
    customerPhone: clampStr(payload.customerPhone, 30),
    address: clampStr(payload.address, 300),
    postalCode: clampStr(payload.postalCode, 20, '75500'),
    cityId: sanitizeId(city.id, 'city'),
    cityName: clampStr(city.city, 80),
    province: clampStr(city.province, 80),
    tcsServiceTier: payload.tcsServiceTier,
    paymentMethod: payload.paymentMethod,
    paymentReference: clampStr(paymentReference, 60),
    paymentVerified,
    items: resolvedItems,
    subtotal,
    deliveryFee,
    total,
    status: 'Booked at Mismu Hub' as OrderStatus,
    estimatedDelivery: clampStr(estimatedDelivery, 80),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (payload.paymentAccountNumber?.trim()) {
    orderFirestoreDoc.paymentAccountNumber = clampStr(payload.paymentAccountNumber, 30);
  }

  const trackingFirestoreDoc = {
    tcsTrackingId,
    orderId,
    customerUid: user.uid,
    cityName: clampStr(city.city, 80),
    province: clampStr(city.province, 80),
    tcsServiceTier: payload.tcsServiceTier,
    status: 'Booked at Mismu Hub' as OrderStatus,
    estimatedDelivery: clampStr(estimatedDelivery, 80),
    total,
    itemCount,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(firestoreDb);
    batch.set(doc(firestoreDb, 'orders', orderId), orderFirestoreDoc);
    batch.set(doc(firestoreDb, 'shipment_tracking', tcsTrackingId), trackingFirestoreDoc);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `orders/${orderId}`);
  }

  const order: Order = {
    id: orderId,
    customerUid: user.uid,
    tcsTrackingId,
    createdAt: new Date().toISOString(),
    customerName: clampStr(payload.customerName, 120),
    customerPhone: clampStr(payload.customerPhone, 30),
    address: clampStr(payload.address, 300),
    postalCode: clampStr(payload.postalCode, 20, '75500'),
    cityId: city.id,
    cityName: city.city,
    province: city.province,
    tcsServiceTier: payload.tcsServiceTier,
    paymentMethod: payload.paymentMethod,
    paymentAccountNumber: payload.paymentAccountNumber?.trim(),
    paymentReference,
    paymentVerified,
    items: resolvedItems,
    subtotal,
    deliveryFee,
    total,
    status: 'Booked at Mismu Hub',
    estimatedDelivery,
  };

  const nextLocal = writeLocalDb({
    ...db,
    orders: [order, ...db.orders],
  });

  return { order, db: nextLocal };
}

export async function addProduct(
  product: Partial<Product>,
  currentDb?: MismuDatabase
): Promise<MismuDatabase> {
  const newProduct: Product = {
    id: sanitizeId(`prod-${Date.now().toString(36)}`, 'prod'),
    name: clampStr(product.name, 140, 'Mismu Beauty Item'),
    category: clampStr(product.category, 60, 'Makeup'),
    price: Math.max(1, Math.round(Number(product.price) || 1000)),
    stock: Math.max(0, Math.round(Number(product.stock) || 10)),
    sku: clampStr(product.sku, 40, `MSM-${Math.floor(100 + Math.random() * 900)}`),
    weightKg: 0.35,
    tagline: clampStr(
      product.tagline,
      240,
      'Curated cosmetics & beauty parlour essential from Mismu.'
    ),
    description: clampStr(
      product.description,
      1200,
      'Crafted for daily beauty routines and salon professionals across Pakistan.'
    ),
    image: clampStr(
      product.image,
      245000,
      '/src/assets/images/product_velvet_lipstick_1795340939244.jpg'
    ),
    featured: true,
  };

  if (isOwnerUser(auth.currentUser)) {
    try {
      await setDoc(doc(firestoreDb, 'products', newProduct.id), sanitizeProductPayload(newProduct));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `products/${newProduct.id}`);
    }
  }

  const db = currentDb || readLocalDb();
  return writeLocalDb({ ...db, products: [newProduct, ...db.products] });
}

export async function updateProduct(
  product: Product,
  currentDb?: MismuDatabase
): Promise<MismuDatabase> {
  if (isOwnerUser(auth.currentUser)) {
    try {
      await setDoc(doc(firestoreDb, 'products', product.id), sanitizeProductPayload(product));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    }
  }

  const db = currentDb || readLocalDb();
  return writeLocalDb({
    ...db,
    products: db.products.map((p) => (p.id === product.id ? product : p)),
  });
}

export async function deleteProduct(id: string, currentDb?: MismuDatabase): Promise<MismuDatabase> {
  if (isOwnerUser(auth.currentUser)) {
    try {
      await deleteDoc(doc(firestoreDb, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  }

  const db = currentDb || readLocalDb();
  return writeLocalDb({
    ...db,
    products: db.products.filter((p) => p.id !== id),
  });
}

export async function addCity(
  city: Partial<CityRate>,
  currentDb?: MismuDatabase
): Promise<MismuDatabase> {
  const createdCity: CityRate = {
    id: sanitizeId(`city-${Date.now().toString(36)}`, 'city'),
    city: clampStr(city.city, 80, 'New City'),
    province: clampStr(city.province, 80, 'Punjab'),
    tcsZone: city.tcsZone || 'Regional Standard',
    standardFee: Math.max(0, Math.round(Number(city.standardFee) || 250)),
    overnightExtra: Math.max(0, Math.round(Number(city.overnightExtra) || 150)),
    estimatedDays: clampStr(city.estimatedDays, 60, '2–3 Working Days'),
    codAvailable: city.codAvailable ?? true,
  };

  if (isOwnerUser(auth.currentUser)) {
    try {
      await setDoc(doc(firestoreDb, 'cities', createdCity.id), sanitizeCityPayload(createdCity));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `cities/${createdCity.id}`);
    }
  }

  const db = currentDb || readLocalDb();
  return writeLocalDb({ ...db, cities: [...db.cities, createdCity] });
}

export async function updateCity(
  city: CityRate,
  currentDb?: MismuDatabase
): Promise<MismuDatabase> {
  if (isOwnerUser(auth.currentUser)) {
    try {
      await setDoc(doc(firestoreDb, 'cities', city.id), sanitizeCityPayload(city));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `cities/${city.id}`);
    }
  }

  const db = currentDb || readLocalDb();
  return writeLocalDb({
    ...db,
    cities: db.cities.map((c) => (c.id === city.id ? city : c)),
  });
}

export async function deleteCity(id: string, currentDb?: MismuDatabase): Promise<MismuDatabase> {
  const db = currentDb || readLocalDb();
  if (db.cities.length <= 1) throw new Error('At least one city must remain active.');

  if (isOwnerUser(auth.currentUser)) {
    try {
      await deleteDoc(doc(firestoreDb, 'cities', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `cities/${id}`);
    }
  }

  return writeLocalDb({
    ...db,
    cities: db.cities.filter((c) => c.id !== id),
  });
}

export async function updatePaymentSettings(
  settings: PaymentSettings,
  currentDb?: MismuDatabase
): Promise<MismuDatabase> {
  if (isOwnerUser(auth.currentUser)) {
    try {
      await setDoc(
        doc(firestoreDb, 'store_config', PAYMENT_CONFIG_DOC_ID),
        sanitizePaymentPayload(settings)
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `store_config/${PAYMENT_CONFIG_DOC_ID}`
      );
    }
  }

  const db = currentDb || readLocalDb();
  return writeLocalDb({ ...db, paymentSettings: settings });
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  currentDb?: MismuDatabase
): Promise<MismuDatabase> {
  const db = currentDb || readLocalDb();
  const target = db.orders.find((o) => o.id === orderId);
  const nextVerified = status === 'Delivered' ? true : Boolean(target?.paymentVerified);

  if (isOwnerUser(auth.currentUser)) {
    try {
      const batch = writeBatch(firestoreDb);
      const orderRef = doc(firestoreDb, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        batch.update(orderRef, {
          status,
          paymentVerified: nextVerified,
          updatedAt: serverTimestamp(),
        });
        const tcsId = String(orderSnap.data()?.tcsTrackingId || target?.tcsTrackingId || '');
        if (tcsId) {
          const trackRef = doc(firestoreDb, 'shipment_tracking', tcsId);
          const trackSnap = await getDoc(trackRef);
          if (trackSnap.exists()) {
            batch.update(trackRef, {
              status,
              updatedAt: serverTimestamp(),
            });
          }
        }
        await batch.commit();
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  }

  return writeLocalDb({
    ...db,
    orders: db.orders.map((o) =>
      o.id === orderId ? { ...o, status, paymentVerified: nextVerified } : o
    ),
  });
}

export async function importFullDb(incoming: MismuDatabase): Promise<MismuDatabase> {
  if (isOwnerUser(auth.currentUser)) {
    await syncLocalCatalogToCloud(incoming);
  }
  return writeLocalDb(incoming);
}

export async function resetFullDb(): Promise<MismuDatabase> {
  const fresh = JSON.parse(JSON.stringify(DEFAULT_MISMU_DB)) as MismuDatabase;
  if (isOwnerUser(auth.currentUser)) {
    await syncLocalCatalogToCloud(fresh);
  }
  return writeLocalDb(fresh);
}

export function buildWhatsAppOrderUrl(params: {
  supportPhone: string;
  orderId?: string;
  tcsTrackingId?: string;
  customerName: string;
  customerPhone: string;
  address: string;
  cityName: string;
  tcsServiceTier: TcsServiceTier;
  paymentMethod: PaymentMethodType;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
}): string {
  const rawDigits = params.supportPhone.replace(/\D/g, '');
  const intlNumber = rawDigits.startsWith('0')
    ? `92${rawDigits.slice(1)}`
    : rawDigits.startsWith('92')
    ? rawDigits
    : `92${rawDigits || '3008451290'}`;

  const itemLines = params.items
    .map((it) => `• ${it.name} x${it.quantity} (${formatPKR(it.price * it.quantity)})`)
    .join('\n');

  const lines = [
    `*Mismu Cosmetics & Parlour Order*`,
    params.orderId ? `Order ID: ${params.orderId}` : '',
    params.tcsTrackingId ? `TCS ID: ${params.tcsTrackingId}` : '',
    `Name: ${params.customerName}`,
    `Phone: ${params.customerPhone}`,
    `City: ${params.cityName} (${params.tcsServiceTier === 'overnight' ? 'Overnight' : 'Standard'})`,
    `Address: ${params.address}`,
    `Payment: ${formatPaymentLabel(params.paymentMethod)}`,
    ``,
    `*Items:*`,
    itemLines,
    ``,
    `*Total:* ${formatPKR(params.total)}`,
  ]
    .filter(Boolean)
    .join('\n');

  return `https://wa.me/${intlNumber}?text=${encodeURIComponent(lines)}`;
}
