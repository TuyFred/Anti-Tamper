import { MapPin } from 'lucide-react';

export default function DashboardAddressCard({ pickup, delivery, className = '' }) {
  return (
    <div className={`dashboard-address-card ${className}`}>
      <p className="dashboard-address-card__label">Route</p>
      <div className="space-y-2.5">
        <p className="dashboard-address-row">
          <MapPin className="w-4 h-4 text-success shrink-0 mt-0.5" />
          <span>
            <span className="dashboard-address-pin dashboard-address-pin--a">A</span>
            {pickup}
          </span>
        </p>
        <p className="dashboard-address-row">
          <MapPin className="w-4 h-4 text-primary-light shrink-0 mt-0.5" />
          <span>
            <span className="dashboard-address-pin dashboard-address-pin--b">B</span>
            {delivery}
          </span>
        </p>
      </div>
    </div>
  );
}
