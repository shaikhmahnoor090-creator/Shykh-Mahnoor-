import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { DEFAULT_MISMU_DB } from './src/data/defaultDb.ts';
import type {
  CityRate,
  MismuDatabase,
  Order,
  OrderStatus,
  PaymentMethodType,
  PaymentSettings,
  Product,
  TcsServiceTier,
} from './src/types/store.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'mismu-db.json');

function cloneDefaultDb(): MismuDatabase {
  return JSON.parse(JSON.stringify(DEFAULT_MISMU_DB)) as MismuDatabase;
}

function ensureDbFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(cloneDefaultDb(), null, 2), 'utf-8');
  }
}

function readDb(): MismuDatabase {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as MismuDatabase;
    if (
      !Array.isArray(parsed.products) ||
      !Array.isArray(parsed.cities) ||
      !parsed.paymentSettings ||
      !Array.isArray(parsed.orders)
    ) {
      throw new Error('Malformed database structure');
    }
    return parsed;
  } catch {
    const fallback = cloneDefaultDb();
    writeDb(fallback);
    return fallback;
  }
}

function writeDb(db: MismuDatabase): MismuDatabase {
  ensureDbFile();
  const nextDb: MismuDatabase = {
    ...db,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(nextDb, null, 2), 'utf-8');
  return nextDb;
}

function calculateDeliveryCharge(
  city: CityRate,
  subtotal: number,
  tier: TcsServiceTier,
  freeThreshold: number
): number {
  const qualifiesForFreeStandard = freeThreshold > 0 && subtotal >= freeThreshold;
  const baseFee = qualifiesForFreeStandard ? 0 : city.standardFee;
  const priorityAddon = tier === 'overnight' ? city.overnightExtra : 0;
  return baseFee + priorityAddon;
}

async function startServer() {
  ensureDbFile();
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'mismu-storefront' });
  });

  app.get('/api/db', (_req, res) => {
    const db = readDb();
    res.json(db);
  });

  app.get('/api/db/export', (_req, res) => {
    const db = readDb();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="mismu-database-backup.json"');
    res.send(JSON.stringify(db, null, 2));
  });

  app.post('/api/db/import', (req, res) => {
    const incoming = req.body as Partial<MismuDatabase>;
    if (
      !incoming ||
      !Array.isArray(incoming.products) ||
      !Array.isArray(incoming.cities) ||
      !incoming.paymentSettings ||
      !Array.isArray(incoming.orders)
    ) {
      res.status(400).json({
        error: 'Invalid database JSON. Expected products, cities, paymentSettings, and orders.',
      });
      return;
    }

    const saved = writeDb({
      products: incoming.products,
      cities: incoming.cities,
      paymentSettings: incoming.paymentSettings,
      orders: incoming.orders,
      updatedAt: new Date().toISOString(),
    });
    res.json(saved);
  });

  app.post('/api/db/reset', (_req, res) => {
    const reset = writeDb(cloneDefaultDb());
    res.json(reset);
  });

  // Products CRUD
  app.post('/api/products', (req, res) => {
    const body = req.body as Partial<Product>;
    if (!body.name?.trim() || !body.category || typeof body.price !== 'number' || body.price <= 0) {
      res.status(400).json({ error: 'Product name, category, and positive price are required.' });
      return;
    }
    const db = readDb();
    const newProduct: Product = {
      id: `prod-${Date.now().toString(36)}`,
      name: body.name.trim(),
      category: body.category,
      price: Math.round(body.price),
      stock: typeof body.stock === 'number' && body.stock >= 0 ? Math.round(body.stock) : 10,
      sku: body.sku?.trim() || `MSM-${Math.floor(100 + Math.random() * 900)}`,
      weightKg: typeof body.weightKg === 'number' && body.weightKg > 0 ? body.weightKg : 0.5,
      tagline: body.tagline?.trim() || 'Curated everyday essential from Mismu.',
      description:
        body.description?.trim() ||
        'Crafted for everyday utility and bright living, dispatched nationwide with TCS tracking.',
      image:
        body.image?.trim() || '/src/assets/images/product_ceramic_kettle_1795271073442.jpg',
      featured: true,
    };
    db.products.unshift(newProduct);
    const saved = writeDb(db);
    res.status(201).json({ product: newProduct, db: saved });
  });

  app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<Product>;
    const db = readDb();
    const idx = db.products.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    const current = db.products[idx];
    const updated: Product = {
      ...current,
      name: body.name !== undefined ? body.name.trim() : current.name,
      category: body.category ?? current.category,
      price: typeof body.price === 'number' && body.price > 0 ? Math.round(body.price) : current.price,
      stock: typeof body.stock === 'number' && body.stock >= 0 ? Math.round(body.stock) : current.stock,
      sku: body.sku !== undefined ? body.sku.trim() : current.sku,
      weightKg:
        typeof body.weightKg === 'number' && body.weightKg > 0 ? body.weightKg : current.weightKg,
      tagline: body.tagline !== undefined ? body.tagline.trim() : current.tagline,
      description: body.description !== undefined ? body.description.trim() : current.description,
      image: body.image !== undefined && body.image.trim() ? body.image.trim() : current.image,
    };
    db.products[idx] = updated;
    const saved = writeDb(db);
    res.json({ product: updated, db: saved });
  });

  app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const db = readDb();
    const nextProducts = db.products.filter((p) => p.id !== id);
    if (nextProducts.length === db.products.length) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    db.products = nextProducts;
    const saved = writeDb(db);
    res.json({ db: saved });
  });

  // Cities & TCS Delivery Charges CRUD
  app.post('/api/cities', (req, res) => {
    const body = req.body as Partial<CityRate>;
    if (!body.city?.trim() || !body.province?.trim() || typeof body.standardFee !== 'number') {
      res.status(400).json({ error: 'City name, province, and TCS standard fee are required.' });
      return;
    }
    const db = readDb();
    const newCity: CityRate = {
      id: `city-${body.city.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-3)}`,
      city: body.city.trim(),
      province: body.province.trim(),
      tcsZone: body.tcsZone ?? 'Regional Standard',
      standardFee: Math.max(0, Math.round(body.standardFee)),
      overnightExtra:
        typeof body.overnightExtra === 'number' ? Math.max(0, Math.round(body.overnightExtra)) : 150,
      estimatedDays: body.estimatedDays?.trim() || '2–3 Working Days',
      codAvailable: body.codAvailable ?? true,
    };
    db.cities.push(newCity);
    const saved = writeDb(db);
    res.status(201).json({ city: newCity, db: saved });
  });

  app.put('/api/cities/:id', (req, res) => {
    const { id } = req.params;
    const body = req.body as Partial<CityRate>;
    const db = readDb();
    const idx = db.cities.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'City rate not found.' });
      return;
    }
    const current = db.cities[idx];
    const updated: CityRate = {
      ...current,
      city: body.city !== undefined ? body.city.trim() : current.city,
      province: body.province !== undefined ? body.province.trim() : current.province,
      tcsZone: body.tcsZone ?? current.tcsZone,
      standardFee:
        typeof body.standardFee === 'number' && body.standardFee >= 0
          ? Math.round(body.standardFee)
          : current.standardFee,
      overnightExtra:
        typeof body.overnightExtra === 'number' && body.overnightExtra >= 0
          ? Math.round(body.overnightExtra)
          : current.overnightExtra,
      estimatedDays:
        body.estimatedDays !== undefined ? body.estimatedDays.trim() : current.estimatedDays,
      codAvailable: body.codAvailable !== undefined ? body.codAvailable : current.codAvailable,
    };
    db.cities[idx] = updated;
    const saved = writeDb(db);
    res.json({ city: updated, db: saved });
  });

  app.delete('/api/cities/:id', (req, res) => {
    const { id } = req.params;
    const db = readDb();
    if (db.cities.length <= 1) {
      res.status(400).json({ error: 'At least one delivery city must remain active.' });
      return;
    }
    const nextCities = db.cities.filter((c) => c.id !== id);
    if (nextCities.length === db.cities.length) {
      res.status(404).json({ error: 'City not found.' });
      return;
    }
    db.cities = nextCities;
    const saved = writeDb(db);
    res.json({ db: saved });
  });

  // Payment Settings Update
  app.put('/api/payment-settings', (req, res) => {
    const body = req.body as Partial<PaymentSettings>;
    const db = readDb();
    db.paymentSettings = {
      ...db.paymentSettings,
      ...body,
      freeDeliveryThreshold:
        typeof body.freeDeliveryThreshold === 'number' && body.freeDeliveryThreshold >= 0
          ? Math.round(body.freeDeliveryThreshold)
          : db.paymentSettings.freeDeliveryThreshold,
    };
    const saved = writeDb(db);
    res.json({ paymentSettings: saved.paymentSettings, db: saved });
  });

  // Orders & Checkout
  app.post('/api/orders', (req, res) => {
    const body = req.body as {
      customerName?: string;
      customerPhone?: string;
      address?: string;
      postalCode?: string;
      cityId?: string;
      tcsServiceTier?: TcsServiceTier;
      paymentMethod?: PaymentMethodType;
      paymentAccountNumber?: string;
      paymentPin?: string;
      items?: Array<{ productId: string; quantity: number }>;
    };

    const db = readDb();

    if (!body.customerName?.trim() || !body.customerPhone?.trim() || !body.address?.trim()) {
      res.status(400).json({ error: 'Customer name, phone number, and full delivery address are required.' });
      return;
    }

    const city = db.cities.find((c) => c.id === body.cityId);
    if (!city) {
      res.status(400).json({ error: 'Please select a valid delivery city for TCS calculation.' });
      return;
    }

    const paymentMethod = body.paymentMethod;
    if (!paymentMethod || !['easypaisa', 'jazzcash', 'cod'].includes(paymentMethod)) {
      res.status(400).json({ error: 'Unsupported payment method.' });
      return;
    }

    if (paymentMethod === 'easypaisa' && !db.paymentSettings.easypaisaEnabled) {
      res.status(400).json({ error: 'EasyPaisa is currently disabled by store settings.' });
      return;
    }
    if (paymentMethod === 'jazzcash' && !db.paymentSettings.jazzcashEnabled) {
      res.status(400).json({ error: 'JazzCash is currently disabled by store settings.' });
      return;
    }
    if (paymentMethod === 'cod') {
      if (!db.paymentSettings.codEnabled || !city.codAvailable) {
        res.status(400).json({ error: `TCS Cash on Delivery is not available for ${city.city}.` });
        return;
      }
    }

    if (paymentMethod === 'easypaisa' || paymentMethod === 'jazzcash') {
      const normalizedAccount = (body.paymentAccountNumber || '').replace(/\D/g, '');
      if (!/^03\d{9}$/.test(normalizedAccount)) {
        res.status(400).json({
          error: `Enter a valid 11-digit Pakistani mobile account number (03XXXXXXXXX) for ${
            paymentMethod === 'easypaisa' ? 'EasyPaisa' : 'JazzCash'
          }.`,
        });
        return;
      }
      if (!body.paymentPin || body.paymentPin.trim().length < 4) {
        res.status(400).json({
          error: 'Enter your 4-digit MPIN / OTP confirmation code to authorize the payment.',
        });
        return;
      }
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'Your shopping bag is empty.' });
      return;
    }

    const resolvedItems = [];
    let subtotal = 0;

    for (const line of body.items) {
      const product = db.products.find((p) => p.id === line.productId);
      const qty = Math.max(1, Math.round(Number(line.quantity) || 1));
      if (!product) {
        res.status(400).json({ error: 'One or more products in your bag are no longer available.' });
        return;
      }
      if (product.stock < qty) {
        res.status(400).json({
          error: `Only ${product.stock} unit(s) left in stock for ${product.name}.`,
        });
        return;
      }
      subtotal += product.price * qty;
      resolvedItems.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        quantity: qty,
        image: product.image,
      });
    }

    const tier: TcsServiceTier = body.tcsServiceTier === 'overnight' ? 'overnight' : 'standard';
    const deliveryFee = calculateDeliveryCharge(
      city,
      subtotal,
      tier,
      db.paymentSettings.freeDeliveryThreshold
    );
    const total = subtotal + deliveryFee;

    // Decrement stock
    for (const line of resolvedItems) {
      const target = db.products.find((p) => p.id === line.productId);
      if (target) {
        target.stock = Math.max(0, target.stock - line.quantity);
      }
    }

    const randomCode = Math.floor(10000000 + Math.random() * 89999999);
    const orderNum = Math.floor(4900 + Math.random() * 5000);
    const tcsNum = `TCS-${Math.floor(785000000 + Math.random() * 19999999)}`;

    const paymentReference =
      paymentMethod === 'easypaisa'
        ? `EP-${randomCode}`
        : paymentMethod === 'jazzcash'
        ? `JC-${randomCode}`
        : `COD-${orderNum}`;

    const newOrder: Order = {
      id: `MSM-${orderNum}`,
      tcsTrackingId: tcsNum,
      createdAt: new Date().toISOString(),
      customerName: body.customerName.trim(),
      customerPhone: body.customerPhone.trim(),
      address: body.address.trim(),
      postalCode: body.postalCode?.trim() || '75500',
      cityId: city.id,
      cityName: city.city,
      province: city.province,
      tcsServiceTier: tier,
      paymentMethod,
      paymentAccountNumber: body.paymentAccountNumber?.trim(),
      paymentReference,
      paymentVerified: paymentMethod !== 'cod',
      items: resolvedItems,
      subtotal,
      deliveryFee,
      total,
      status: 'Booked at Mismu Hub',
      estimatedDelivery: tier === 'overnight' ? 'Next-Day TCS Priority' : city.estimatedDays,
    };

    db.orders.unshift(newOrder);
    const saved = writeDb(db);
    res.status(201).json({ order: newOrder, db: saved });
  });

  app.patch('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body as { status?: OrderStatus };
    const validStatuses: OrderStatus[] = [
      'Booked at Mismu Hub',
      'Dispatched via TCS',
      'In Transit',
      'Out for Delivery',
      'Delivered',
    ];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid TCS shipment status.' });
      return;
    }
    const db = readDb();
    const order = db.orders.find((o) => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    order.status = status;
    if (status === 'Delivered') {
      order.paymentVerified = true;
    }
    const saved = writeDb(db);
    res.json({ order, db: saved });
  });

  app.get('/api/orders/track/:trackingId', (req, res) => {
    const query = req.params.trackingId.trim().toUpperCase();
    const db = readDb();
    const order = db.orders.find(
      (o) => o.tcsTrackingId.toUpperCase() === query || o.id.toUpperCase() === query
    );
    if (!order) {
      res.status(404).json({ error: 'No shipment found matching that TCS Tracking ID or Order ID.' });
      return;
    }
    res.json({ order });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mismu storefront running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Mismu server:', err);
  process.exit(1);
});
