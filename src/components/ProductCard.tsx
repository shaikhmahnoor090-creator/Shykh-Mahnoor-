import React, { useState } from 'react';
import { Package, ShoppingCart, Check, Zap } from 'lucide-react';
import type { Product } from '../types/store';
import { assetUrl, formatPKR } from '../utils/format';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onBuyNow: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onAddToCart,
  onBuyNow,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.stock <= 0) return;
    onAddToCart(product);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1100);
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.stock <= 0) return;
    onBuyNow(product);
  };

  const stockLabel =
    product.stock <= 0
      ? 'Out of Stock'
      : product.stock <= 10
      ? `Only ${product.stock} left`
      : 'In Stock';

  return (
    <article
      onClick={() => onSelect(product)}
      className="group cursor-pointer flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-orange-300"
    >
      <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
        {!imgFailed ? (
          <img
            src={assetUrl(product.image)}
            alt={product.name}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-slate-100 p-6 text-center">
            <Package className="w-8 h-8 text-orange-500 mb-2" />
            <span className="text-xs font-medium text-slate-600">{product.name}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
          <span className="font-medium text-slate-700">{product.category}</span>
          <span aria-hidden="true">·</span>
          <span className={product.stock <= 0 ? 'text-rose-600 font-medium' : 'text-slate-500'}>
            {stockLabel}
          </span>
        </div>

        <h3 className="font-display text-base font-semibold text-slate-900 leading-snug mb-1 group-hover:text-orange-600 transition-colors">
          {product.name}
        </h3>

        <p className="text-sm text-slate-600 line-clamp-2 mb-3 flex-1">
          {product.tagline}
        </p>

        <div className="font-mono text-lg font-bold text-orange-600 tabular-nums mb-3">
          {formatPKR(product.price)}
        </div>

        <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={product.stock <= 0}
            onClick={handleQuickAdd}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
              product.stock <= 0
                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                : justAdded
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Added
              </>
            ) : (
              <>
                <ShoppingCart className="w-3.5 h-3.5" />
                Add to Cart
              </>
            )}
          </button>

          <button
            type="button"
            disabled={product.stock <= 0}
            onClick={handleBuyNow}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              product.stock <= 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Buy Now
          </button>
        </div>
      </div>
    </article>
  );
};
