export type ProductCategory = 'Home & Living' | 'Skincare' | 'Carry & Tech';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
  tagline: string;
  description: string;
  image: string;
  sku: string;
  weightKg: number;
  featured?: boolean;
}

export interface CityRate {
  id: string;
  city: string;
  province: string;
  tcsZone: 'Metro Express' | 'Regional Standard' | 'Air Cargo' | 'Northern Special';
  standardFee: number;
  overnightExtra: number;
  estimatedDays: string;
  codAvailable: boolean;
}

export type PaymentMethodType = 'easypaisa' | 'jazzcash' | 'cod';
export type TcsServiceTier = 'standard' | 'overnight';

export interface PaymentSettings {
  easypaisaEnabled: boolean;
  easypaisaAccountTitle: string;
  easypaisaAccountNumber: string;
  jazzcashEnabled: boolean;
  jazzcashAccountTitle: string;
  jazzcashAccountNumber: string;
  codEnabled: boolean;
  freeDeliveryThreshold: number;
  storeTagline: string;
  supportPhone: string;
}

export type OrderStatus =
  | 'Booked at Mismu Hub'
  | 'Dispatched via TCS'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered';

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  tcsTrackingId: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  address: string;
  postalCode: string;
  cityId: string;
  cityName: string;
  province: string;
  tcsServiceTier: TcsServiceTier;
  paymentMethod: PaymentMethodType;
  paymentAccountNumber?: string;
  paymentReference: string;
  paymentVerified: boolean;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  estimatedDelivery: string;
}

export interface MismuDatabase {
  products: Product[];
  cities: CityRate[];
  paymentSettings: PaymentSettings;
  orders: Order[];
  updatedAt: string;
}
