import React, { useState, useMemo, useEffect } from 'react';
import { Search, Truck, CheckCircle2, MapPin, ArrowRight } from 'lucide-react';
import type { CityRate, Order, OrderStatus } from '../types/store';
import { formatPKR, formatPaymentLabel } from '../utils/format';
import { trackShipmentById, type PublicTrackingInfo } from '../utils/storeApi';

interface TcsRatesAndTrackerProps {
  cities: CityRate[];
  orders: Order[];
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  freeThreshold: number;
  initialTrackingQuery?: string;
}

const TRACKING_STEPS: OrderStatus[] = [
  'Booked at Mismu Hub',
  'Dispatched via TCS',
  'In Transit',
  'Out for Delivery',
  'Delivered',
];

export const TcsRatesAndTracker: React.FC<TcsRatesAndTrackerProps> = ({
  cities,
  orders,
  selectedCityId,
  onSelectCity,
  freeThreshold,
  initialTrackingQuery,
}) => {
  const [citySearch, setCitySearch] = useState('');
  const [trackingInput, setTrackingInput] = useState(
    initialTrackingQuery || orders[0]?.tcsTrackingId || 'TCS-784920143'
  );
  const [trackedOrder, setTrackedOrder] = useState<PublicTrackingInfo | null>(orders[0] ?? null);
  const [trackError, setTrackError] = useState('');
  const [searching, setSearching] = useState(false);

  const performLookup = async (rawQuery: string) => {
    const q = rawQuery.trim().toUpperCase();
    if (!q) {
      setTrackError('Enter a TCS Tracking ID or Mismu Order ID.');
      setTrackedOrder(null);
      return;
    }

    const localMatch = orders.find(
      (o) => o.tcsTrackingId.toUpperCase() === q || o.id.toUpperCase() === q
    );
    if (localMatch) {
      setTrackedOrder(localMatch);
      setTrackError('');
      return;
    }

    setSearching(true);
    try {
      const cloudMatch = await trackShipmentById(q);
      if (cloudMatch) {
        setTrackedOrder(cloudMatch);
        setTrackError('');
      } else {
        setTrackError(`No consignment found for "${rawQuery.trim()}".`);
        setTrackedOrder(null);
      }
    } catch {
      setTrackError(`Unable to look up "${rawQuery.trim()}". Please check the ID.`);
      setTrackedOrder(null);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (initialTrackingQuery) {
      setTrackingInput(initialTrackingQuery);
      void performLookup(initialTrackingQuery);
    }
  }, [initialTrackingQuery, orders]);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        c.province.toLowerCase().includes(q) ||
        c.tcsZone.toLowerCase().includes(q)
    );
  }, [cities, citySearch]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void performLookup(trackingInput);
  };

  const currentStepIndex = trackedOrder
    ? Math.max(0, TRACKING_STEPS.indexOf(trackedOrder.status))
    : 0;

  return (
    <section id="tcs-delivery" className="py-16 bg-slate-50 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* City-wise TCS Delivery Rates */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold text-orange-600 mb-1">
                  TCS Nationwide Logistics
                </p>
                <h2 className="font-display text-2xl font-bold text-slate-900">
                  City-Wise TCS Delivery Charges
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Every city has its own TCS tariff. Free Standard TCS on orders above{' '}
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatPKR(freeThreshold)}
                  </span>
                  .
                </p>
              </div>

              <div className="relative w-full sm:w-56 shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="Search city or province..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-[380px] overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="py-3 px-4">City</th>
                    <th className="py-3 px-4">TCS Zone</th>
                    <th className="py-3 px-4">Transit</th>
                    <th className="py-3 px-4 text-right">Standard</th>
                    <th className="py-3 px-4 text-right">Priority</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredCities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No cities match "{citySearch}". You can add new cities in Store DB.
                      </td>
                    </tr>
                  ) : (
                    filteredCities.map((city) => {
                      const isSelected = city.id === selectedCityId;
                      return (
                        <tr
                          key={city.id}
                          onClick={() => onSelectCity(city.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-orange-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{city.city}</div>
                            <div className="text-xs text-slate-500">
                              {city.province} · {city.codAvailable ? 'COD Available' : 'Prepaid Only'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                            {city.tcsZone}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                            {city.estimatedDays}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                            {formatPKR(city.standardFee)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {formatPKR(city.standardFee + city.overnightExtra)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectCity(city.id);
                              }}
                              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                                isSelected
                                  ? 'bg-orange-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Select'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live TCS Consignment Tracker */}
          <div id="track-order" className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
            <div className="mb-5">
              <p className="text-xs font-semibold text-orange-600 mb-1">
                Real-Time Consignment Lookup
              </p>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Track Your TCS Parcel
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Enter your Mismu Order ID or TCS Tracking Number to check live dispatch status.
              </p>
            </div>

            <form onSubmit={handleTrackSubmit} className="flex gap-2 mb-4">
              <input
                type="text"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder="e.g. TCS-784920143 or MSM-4821"
                className="flex-1 px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:bg-white"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                {searching ? 'Checking...' : 'Track'}
              </button>
            </form>

            {orders.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-6">
                <span>Recent:</span>
                {orders.slice(0, 3).map((ord) => (
                  <button
                    key={ord.id}
                    type="button"
                    onClick={() => {
                      setTrackingInput(ord.tcsTrackingId);
                      setTrackedOrder(ord);
                      setTrackError('');
                    }}
                    className="font-mono text-slate-700 hover:text-orange-600 underline underline-offset-2"
                  >
                    {ord.tcsTrackingId}
                  </button>
                ))}
              </div>
            )}

            {trackError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
                {trackError}
              </div>
            )}

            {trackedOrder && (
              <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/70 space-y-5">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <div className="font-mono text-xs text-slate-500">
                      {trackedOrder.id} · {trackedOrder.tcsTrackingId}
                    </div>
                    <div className="font-display text-base font-bold text-slate-900 mt-0.5">
                      {trackedOrder.status}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5 inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-orange-600" />
                      {trackedOrder.cityName}, {trackedOrder.province} ·{' '}
                      {trackedOrder.estimatedDelivery}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      {formatPKR(trackedOrder.total)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {trackedOrder.paymentMethod
                        ? formatPaymentLabel(trackedOrder.paymentMethod)
                        : trackedOrder.tcsServiceTier === 'overnight'
                        ? 'TCS Overnight Priority'
                        : 'TCS Standard Express'}
                    </div>
                  </div>
                </div>

                <ol className="space-y-3">
                  {TRACKING_STEPS.map((step, idx) => {
                    const completed = idx <= currentStepIndex;
                    const active = idx === currentStepIndex;
                    return (
                      <li key={step} className="flex items-center gap-3 text-sm">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            completed
                              ? 'bg-orange-600 text-white'
                              : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          {completed ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Truck className="w-3 h-3" />
                          )}
                        </span>
                        <span
                          className={
                            active
                              ? 'font-semibold text-slate-900'
                              : completed
                              ? 'text-slate-700'
                              : 'text-slate-400'
                          }
                        >
                          {step}
                        </span>
                        {active && (
                          <span className="ml-auto text-xs font-medium text-orange-600 inline-flex items-center gap-1">
                            Current <ArrowRight className="w-3 h-3" />
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
