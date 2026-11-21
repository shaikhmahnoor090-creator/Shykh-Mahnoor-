import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Minus,
  Plus,
  Truck,
  Smartphone,
  Banknote,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import type {
  CityRate,
  Order,
  PaymentMethodType,
  PaymentSettings,
  Product,
  TcsServiceTier,
} from '../types/store';
import { assetUrl, computeDeliveryFee, formatPKR, formatPaymentLabel } from '../utils/format';
import { createOrder } from '../utils/storeApi';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartCheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQty: (productId: string, qty: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  cities: CityRate[];
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  paymentSettings: PaymentSettings;
  onOrderCreated: (order: Order) => void;
  onTrackOrder: (trackingId: string) => void;
  initialStep?: 'bag' | 'checkout';
}

export const CartCheckoutDrawer: React.FC<CartCheckoutDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  cities,
  selectedCityId,
  onSelectCity,
  paymentSettings,
  onOrderCreated,
  onTrackOrder,
  initialStep = 'bag',
}) => {
  const [step, setStep] = useState<'bag' | 'checkout' | 'confirmed'>(initialStep);
  const [tcsTier, setTcsTier] = useState<TcsServiceTier>('standard');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('easypaisa');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [paymentAccountNumber, setPaymentAccountNumber] = useState('');
  const [paymentPin, setPaymentPin] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const selectedCity = cities.find((c) => c.id === selectedCityId) || cities[0];
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryFee = computeDeliveryFee(
    selectedCity,
    subtotal,
    tcsTier,
    paymentSettings.freeDeliveryThreshold
  );
  const total = subtotal + deliveryFee;
  const qualifiesFreeStandard =
    paymentSettings.freeDeliveryThreshold > 0 &&
    subtotal >= paymentSettings.freeDeliveryThreshold;
  const freeRemaining = Math.max(0, paymentSettings.freeDeliveryThreshold - subtotal);

  useEffect(() => {
    if (!selectedCity?.codAvailable && paymentMethod === 'cod') {
      if (paymentSettings.easypaisaEnabled) setPaymentMethod('easypaisa');
      else if (paymentSettings.jazzcashEnabled) setPaymentMethod('jazzcash');
    }
  }, [selectedCity, paymentMethod, paymentSettings]);

  useEffect(() => {
    if (isOpen && items.length > 0) {
      setStep(initialStep);
    } else if (isOpen && step === 'confirmed' && items.length === 0) {
      setStep('bag');
    }
  }, [isOpen, initialStep]);

  if (!isOpen) return null;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!customerName.trim() || !customerPhone.trim() || !address.trim()) {
      setErrorMsg('Please fill in your full name, phone number, and delivery address.');
      return;
    }

    if (paymentMethod === 'easypaisa' || paymentMethod === 'jazzcash') {
      const digits = paymentAccountNumber.replace(/\D/g, '');
      if (!/^03\d{9}$/.test(digits)) {
        setErrorMsg(
          `Enter a valid 11-digit mobile wallet number (e.g. 03001234567) for ${
            paymentMethod === 'easypaisa' ? 'EasyPaisa' : 'JazzCash'
          }.`
        );
        return;
      }
      if (paymentPin.trim().length < 4) {
        setErrorMsg('Enter your 4-digit MPIN / OTP confirmation code to authorize the payment.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const data = await createOrder({
        customerName,
        customerPhone,
        address,
        postalCode,
        cityId: selectedCity?.id || '',
        tcsServiceTier: tcsTier,
        paymentMethod,
        paymentAccountNumber: paymentMethod === 'cod' ? undefined : paymentAccountNumber,
        paymentPin: paymentMethod === 'cod' ? undefined : paymentPin,
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      });
      setConfirmedOrder(data.order);
      onOrderCreated(data.order);
      onClearCart();
      setPaymentPin('');
      setStep('confirmed');
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to place order. Please review your details.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Mismu Shopping Bag and Checkout"
    >
      <div
        className="relative w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3">
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setStep('bag');
                }}
                aria-label="Back to shopping bag"
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-display text-lg font-bold text-slate-900">
              {step === 'bag'
                ? `Your Mismu Bag (${items.reduce((s, i) => s + i.quantity, 0)})`
                : step === 'checkout'
                ? 'TCS Delivery & Payment'
                : 'Order Confirmed'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'bag' && (
            <>
              {items.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900">
                    Your Mismu bag is empty
                  </h3>
                  <p className="text-sm text-slate-600 max-w-xs mx-auto">
                    Add items from the bright collection to calculate your city-wise TCS shipping and pay via EasyPaisa, JazzCash, or COD.
                  </p>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-2 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold"
                  >
                    Browse Products
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Free Delivery Banner */}
                  {paymentSettings.freeDeliveryThreshold > 0 && (
                    <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200/80 text-xs text-slate-800">
                      {freeRemaining === 0 ? (
                        <span className="font-semibold text-emerald-700">
                          You unlocked Free TCS Standard Delivery across Pakistan!
                        </span>
                      ) : (
                        <span>
                          Add{' '}
                          <span className="font-mono font-bold text-orange-700 tabular-nums">
                            {formatPKR(freeRemaining)}
                          </span>{' '}
                          more for Free TCS Standard Delivery.
                        </span>
                      )}
                    </div>
                  )}

                  {/* Items List */}
                  <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
                    {items.map(({ product, quantity }) => (
                      <div key={product.id} className="py-4 flex gap-4">
                        <img
                          src={assetUrl(product.image)}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-20 h-20 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-display text-sm font-semibold text-slate-900 truncate">
                              {product.name}
                            </h3>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(product.id)}
                              aria-label={`Remove ${product.name}`}
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{product.category}</div>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
                              <button
                                type="button"
                                onClick={() => onUpdateQty(product.id, quantity - 1)}
                                className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-l-lg"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center font-mono text-xs font-semibold tabular-nums">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateQty(product.id, Math.min(product.stock, quantity + 1))
                                }
                                className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-r-lg"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                              {formatPKR(product.price * quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick City Estimator */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <label className="block text-xs font-semibold text-slate-700">
                      Delivery City (TCS Tariff)
                    </label>
                    <select
                      value={selectedCity?.id || ''}
                      onChange={(e) => onSelectCity(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-orange-500"
                    >
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.city} ({c.province}) — {formatPKR(c.standardFee)} · {c.estimatedDays}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'checkout' && (
            <form id="mismu-checkout-form" onSubmit={handlePlaceOrder} className="space-y-6">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Quick Items & Quantity Review */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="text-xs font-bold text-slate-800">
                  Order Items ({items.reduce((s, i) => s + i.quantity, 0)})
                </div>
                <div className="divide-y divide-slate-200">
                  {items.map(({ product, quantity }) => (
                    <div key={product.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={assetUrl(product.image)}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-md object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{product.name}</div>
                          <div className="font-mono text-slate-600">{formatPKR(product.price)}</div>
                        </div>
                      </div>
                      <div className="inline-flex items-center border border-slate-200 rounded-md bg-white shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(product.id, quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-mono font-semibold tabular-nums">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateQty(product.id, Math.min(product.stock, quantity + 1))
                          }
                          className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* City & TCS Service Tier */}
              <div className="space-y-3">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  1. City &amp; TCS Courier Service
                </h3>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Destination City
                  </label>
                  <select
                    value={selectedCity?.id || ''}
                    onChange={(e) => onSelectCity(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white"
                  >
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.city} ({c.province}) — Standard {formatPKR(c.standardFee)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCity && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTcsTier('standard')}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        tcsTier === 'standard'
                          ? 'border-orange-600 bg-orange-50/70'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">
                        TCS Standard Express
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {selectedCity.estimatedDays}
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-900 mt-1.5 tabular-nums">
                        {qualifiesFreeStandard ? 'Free' : formatPKR(selectedCity.standardFee)}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTcsTier('overnight')}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        tcsTier === 'overnight'
                          ? 'border-orange-600 bg-orange-50/70'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-900">
                        TCS Overnight Priority
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">Next-Day Priority</div>
                      <div className="font-mono text-xs font-bold text-slate-900 mt-1.5 tabular-nums">
                        + {formatPKR(selectedCity.overnightExtra)}
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Shipping Details */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  2. Receiver Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Bilal Ahmed"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Mobile Phone (for TCS SMS)
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="0300-1234567"
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Street / House Address
                    </label>
                    <input
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="House 22, Street 4, Gulberg III"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="54660"
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  3. Select Payment Method
                </h3>

                <div className="space-y-2.5">
                  {paymentSettings.easypaisaEnabled && (
                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        paymentMethod === 'easypaisa'
                          ? 'border-emerald-600 bg-emerald-50/60'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'easypaisa'}
                        onChange={() => setPaymentMethod('easypaisa')}
                        className="mt-1 accent-emerald-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
                            <Smartphone className="w-4 h-4 text-emerald-600" />
                            EasyPaisa Mobile Account
                          </span>
                          <span className="text-xs font-semibold text-emerald-700">Instant</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Merchant: {paymentSettings.easypaisaAccountTitle} ·{' '}
                          <span className="font-mono">{paymentSettings.easypaisaAccountNumber}</span>
                        </p>
                      </div>
                    </label>
                  )}

                  {paymentSettings.jazzcashEnabled && (
                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                        paymentMethod === 'jazzcash'
                          ? 'border-rose-600 bg-rose-50/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === 'jazzcash'}
                        onChange={() => setPaymentMethod('jazzcash')}
                        className="mt-1 accent-rose-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
                            <Smartphone className="w-4 h-4 text-rose-600" />
                            JazzCash Mobile Wallet
                          </span>
                          <span className="text-xs font-semibold text-rose-700">Instant</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Merchant: {paymentSettings.jazzcashAccountTitle} ·{' '}
                          <span className="font-mono">{paymentSettings.jazzcashAccountNumber}</span>
                        </p>
                      </div>
                    </label>
                  )}

                  {paymentSettings.codEnabled && (
                    <label
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-colors ${
                        !selectedCity?.codAvailable
                          ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                          : paymentMethod === 'cod'
                          ? 'border-orange-600 bg-orange-50/60 cursor-pointer'
                          : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        disabled={!selectedCity?.codAvailable}
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                        className="mt-1 accent-orange-600"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
                            <Banknote className="w-4 h-4 text-orange-600" />
                            TCS Cash on Delivery (COD)
                          </span>
                          <span className="text-xs font-medium text-slate-600">
                            {selectedCity?.codAvailable ? 'Pay Rider' : 'Unavailable'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {selectedCity?.codAvailable
                            ? `Pay ${formatPKR(total)} in cash when the TCS courier delivers to ${selectedCity.city}.`
                            : `COD is disabled for ${selectedCity?.city}. Please choose EasyPaisa or JazzCash.`}
                        </p>
                      </div>
                    </label>
                  )}
                </div>

                {(paymentMethod === 'easypaisa' || paymentMethod === 'jazzcash') && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="text-xs font-semibold text-slate-800">
                      {paymentMethod === 'easypaisa'
                        ? 'EasyPaisa Account Authorization'
                        : 'JazzCash Wallet Authorization'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          Your Wallet Number
                        </label>
                        <input
                          type="tel"
                          required
                          value={paymentAccountNumber}
                          onChange={(e) => setPaymentAccountNumber(e.target.value)}
                          placeholder="03XXXXXXXXX"
                          className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">
                          {paymentMethod === 'easypaisa' ? '4-Digit MPIN / OTP' : 'MPIN / CNIC Last 4'}
                        </label>
                        <input
                          type="password"
                          required
                          maxLength={6}
                          value={paymentPin}
                          onChange={(e) => setPaymentPin(e.target.value)}
                          placeholder="••••"
                          className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Generates verified transaction receipt upon order confirmation.
                    </p>
                  </div>
                )}
              </div>
            </form>
          )}

          {step === 'confirmed' && confirmedOrder && (
            <div className="space-y-6 py-2">
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Order {confirmedOrder.id} Confirmed
                  </h3>
                  <p className="text-xs text-slate-700 mt-1">
                    Your parcel has been booked with TCS Express for {confirmedOrder.cityName} (
                    {confirmedOrder.estimatedDelivery}).
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 text-sm">
                <div className="p-4 flex justify-between">
                  <span className="text-slate-500">TCS Tracking Number</span>
                  <span className="font-mono font-bold text-slate-900">
                    {confirmedOrder.tcsTrackingId}
                  </span>
                </div>
                <div className="p-4 flex justify-between">
                  <span className="text-slate-500">Payment Method</span>
                  <span className="font-medium text-slate-900">
                    {formatPaymentLabel(confirmedOrder.paymentMethod)}
                  </span>
                </div>
                <div className="p-4 flex justify-between">
                  <span className="text-slate-500">Transaction Reference</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {confirmedOrder.paymentReference}
                  </span>
                </div>
                <div className="p-4 flex justify-between">
                  <span className="text-slate-500">Total Paid / Payable</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {formatPKR(confirmedOrder.total)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onTrackOrder(confirmedOrder.tcsTrackingId);
                    onClose();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
                >
                  Track TCS Shipment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('bag');
                    onClose();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {step !== 'confirmed' && items.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal</span>
                <span className="font-mono tabular-nums">{formatPKR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>
                  TCS Delivery ({selectedCity?.city} ·{' '}
                  {tcsTier === 'overnight' ? 'Priority' : 'Standard'})
                </span>
                <span className="font-mono tabular-nums">
                  {deliveryFee === 0 ? 'Free' : formatPKR(deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total</span>
                <span className="font-mono tabular-nums">{formatPKR(total)}</span>
              </div>
            </div>

            {step === 'bag' ? (
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
              >
                Proceed to Payment &amp; TCS Shipping
              </button>
            ) : (
              <button
                type="submit"
                form="mismu-checkout-form"
                disabled={submitting}
                className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white text-sm font-semibold transition-colors"
              >
                {submitting
                  ? 'Confirming Order...'
                  : paymentMethod === 'cod'
                  ? `Place TCS COD Order · ${formatPKR(total)}`
                  : `Pay ${formatPKR(total)} & Confirm Order`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
