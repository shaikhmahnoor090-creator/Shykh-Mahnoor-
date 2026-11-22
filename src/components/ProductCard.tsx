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
      ? `${product.stock} left`
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
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-slate-100 p-4 text-center">
            <Package className="w-7 h-7 text-orange-500 mb-1.5" />
            <span className="text-xs font-medium text-slate-600">{product.name}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-3 sm:p-3.5">
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 mb-1 truncate">
          <span className="font-medium text-slate-700 truncate">{product.category}</span>
          <span aria-hidden="true">·</span>
          <span className={product.stock <= 0 ? 'text-rose-600 font-medium shrink-0' : 'text-slate-500 shrink-0'}>
            {stockLabel}
          </span>
        </div>

        <h3 className="font-display text-xs sm:text-sm font-semibold text-slate-900 leading-snug line-clamp-2 min-h-[2.25rem] sm:min-h-[2.5rem] mb-1 group-hover:text-orange-600 transition-colors">
          {product.name}
        </h3>

        <p className="hidden sm:block text-xs text-slate-500 line-clamp-1 mb-2.5">
          {product.tagline}
        </p>

        <div className="mt-auto">
          <div className="font-mono text-sm sm:text-base font-bold text-orange-600 tabular-nums mb-2.5">
            {formatPKR(product.price)}
          </div>

          <div className="pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={handleQuickAdd}
              className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold border transition-colors whitespace-nowrap ${
                product.stock <= 0
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : justAdded
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              {justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden xl:inline">Add to Cart</span>
                  <span className="xl:hidden">Cart</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={product.stock <= 0}
              onClick={handleBuyNow}
              className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                product.stock <= 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>Buy Now</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
