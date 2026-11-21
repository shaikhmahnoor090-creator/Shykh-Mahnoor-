import React, { useState } from 'react';
import { X, Truck, ShieldCheck, Minus, Plus, Package, Zap, ShoppingCart } from 'lucide-react';
import type { CityRate, Product } from '../types/store';
import { assetUrl, formatPKR } from '../utils/format';

interface ProductDetailModalProps {
  product: Product | null;
  selectedCity: CityRate | undefined;
  freeThreshold: number;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onBuyNow: (product: Product, quantity: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  selectedCity,
  freeThreshold,
  onClose,
  onAddToCart,
  onBuyNow,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [imgFailed, setImgFailed] = useState(false);

  if (!product) return null;

  const lineSubtotal = product.price * quantity;
  const qualifiesFree = freeThreshold > 0 && lineSubtotal >= freeThreshold;

  const handleAdd = () => {
    onAddToCart(product, quantity);
    setQuantity(1);
    onClose();
  };

  const handleBuy = () => {
    onBuyNow(product, quantity);
    setQuantity(1);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-lg bg-white/95 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="bg-slate-100 aspect-[4/3] md:aspect-auto md:h-full">
          {!imgFailed ? (
            <img
              src={assetUrl(product.image)}
              alt={product.name}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-slate-100 p-6">
              <Package className="w-10 h-10 text-orange-500 mb-2" />
              <span className="text-sm font-medium text-slate-700">{product.name}</span>
            </div>
          )}
        </div>

        <div className="p-6 md:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <span className="font-medium text-orange-600">{product.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{product.sku}</span>
              <span aria-hidden="true">·</span>
              <span>{product.stock > 0 ? `${product.stock} available` : 'Out of Stock'}</span>
            </div>

            <h2 id="pdp-title" className="font-display text-2xl font-bold text-slate-900 mb-2">
              {product.name}
            </h2>

            <div className="font-mono text-2xl font-bold text-orange-600 tabular-nums mb-4">
              {formatPKR(product.price)}
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              {product.description}
            </p>

            {selectedCity && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 mb-6 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-800">
                  <span className="inline-flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-orange-600" />
                    TCS Delivery to {selectedCity.city}
                  </span>
                  <span className="font-mono tabular-nums font-semibold">
                    {qualifiesFree ? 'Free' : formatPKR(selectedCity.standardFee)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Est. {selectedCity.estimatedDays} ·{' '}
                  {selectedCity.codAvailable
                    ? 'EasyPaisa, JazzCash & COD supported'
                    : 'Prepaid via EasyPaisa or JazzCash'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-slate-600">Quantity</span>
              <div className="inline-flex items-center border border-slate-200 rounded-lg bg-slate-50">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-l-lg"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-10 text-center font-mono text-sm font-semibold tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(Math.max(1, product.stock), q + 1))}
                  aria-label="Increase quantity"
                  className="w-9 h-9 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-r-lg"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={handleAdd}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-900 text-sm font-semibold transition-colors whitespace-nowrap"
              >
                <ShoppingCart className="w-4 h-4" />
                Add to Cart
              </button>

              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={handleBuy}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold transition-colors whitespace-nowrap"
              >
                <Zap className="w-4 h-4" />
                Buy Now
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>7-day Mismu return guarantee · Verified TCS insured parcel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
