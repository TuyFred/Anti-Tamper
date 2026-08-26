import { formatPrice } from '../lib/deliveryUtils';

/** Distance + price bar below delivery map */
export default function MapRouteSummary({
  distanceKm,
  remainingKm,
  calculatedPrice,
  currency = 'RWF',
  loading,
  roadSource,
  remainingLoading,
}) {
  const hasMain = distanceKm != null || loading;

  if (!hasMain && remainingKm == null) return null;

  return (
    <div className="map-route-summary">
      {hasMain && (
        <div className="map-route-summary__item">
          <span className="map-route-summary__label">Route</span>
          <span className="map-route-summary__value">
            {loading ? '…' : `${distanceKm} km`}
            {!loading && roadSource === 'road' && (
              <span className="map-route-summary__hint"> · by road</span>
            )}
          </span>
        </div>
      )}
      {remainingKm != null && (
        <div className="map-route-summary__item">
          <span className="map-route-summary__label">Box → customer</span>
          <span className="map-route-summary__value">
            {remainingLoading ? '…' : `${remainingKm} km`}
          </span>
        </div>
      )}
      {calculatedPrice != null && (
        <div className="map-route-summary__item map-route-summary__item--price">
          <span className="map-route-summary__label">Price</span>
          <span className="map-route-summary__value">
            {formatPrice(calculatedPrice, currency)}
          </span>
        </div>
      )}
    </div>
  );
}
