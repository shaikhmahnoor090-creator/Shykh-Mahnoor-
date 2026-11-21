import type { CityRate, PaymentMethodType, TcsServiceTier } from '../types/store';

export function formatPKR(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString('en-PK')}`;
}

export function computeDeliveryFee(
  city: CityRate | undefined,
  subtotal: number,
  tier: TcsServiceTier,
  freeThreshold: number
): number {
  if (!city) return 0;
  const isFreeStandard = freeThreshold > 0 && subtotal >= freeThreshold;
  const standardPart = isFreeStandard ? 0 : city.standardFee;
  const priorityPart = tier === 'overnight' ? city.overnightExtra : 0;
  return standardPart + priorityPart;
}

export function formatPaymentLabel(method: PaymentMethodType): string {
  if (method === 'easypaisa') return 'EasyPaisa Mobile Account';
  if (method === 'jazzcash') return 'JazzCash Mobile Account';
  return 'Cash on Delivery (TCS COD)';
}

export function assetUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const base =
    (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = path.replace(/^\/+/, '');
  return `${normalizedBase}${cleanPath}`;
}
