import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Truck, MapPin, Play, Package, Loader2, Navigation, User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';
import RiderRouteMap from '../components/RiderRouteMap';
import {
  deliveryStatusMeta, formatPrice, formatDeliveryRef, formatDeliveryDate,
} from '../lib/deliveryUtils';

function AddressCard({ label, address, accent, instructions }) {
  return (
    <div className={`p-3 rounded-xl border ${accent === 'pickup' ? 'bg-success/5 border-success/20' : 'bg-primary/5 border-primary/20'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${accent === 'pickup' ? 'text-success' : 'text-primary-light'}`}>
        {label}
      </p>
      <p className="text-sm text-white leading-snug break-words">{address}</p>
      {instructions && <p className="text-xs text-slate-500 mt-2">{instructions}</p>}
    </div>
  );
}

export default function RiderRoute() {
  const { token, isRider, isManager } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const load = async () => {
    try {
      const list = await api.getDeliveries(token);
      setAssignments(list);
      const active = list.filter((d) => !['delivered', 'cancelled'].includes(d.status));
      if (active.length && !selectedId) setSelectedId(active[0].id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  const handleStartTransit = async (id) => {
    setActionId(id);
    setError('');
    try {
      await api.startTransit(token, id);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  };

  if (!isRider && !isManager) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const active = assignments.filter((d) => !['delivered', 'cancelled'].includes(d.status));
  const selected = assignments.find((d) => d.id === selectedId) || active[0];

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary-light" />
          My route
        </h3>
        <span className="text-xs text-slate-500">{active.length} active</span>
      </div>

      {active.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-500 text-sm">
          No assignments yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-2 max-h-[520px] overflow-y-auto scrollbar-thin">
            {active.map((d) => {
              const meta = deliveryStatusMeta(d.status);
              const isSelected = selected?.id === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className={`w-full text-left p-3 rounded-xl border transition ${
                    isSelected ? 'border-primary bg-primary/10' : 'border-border bg-surface/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-mono text-slate-500">{formatDeliveryRef(d.id)}</span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <p className="text-xs text-slate-300 truncate">{d.delivery_address}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{formatDeliveryDate(d.created_at)}</p>
                </button>
              );
            })}
          </div>

          {selected && (
            <div className="lg:col-span-2 glass-card rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-mono text-slate-500">{formatDeliveryRef(selected.id)}</p>
                  <Badge variant={deliveryStatusMeta(selected.status).variant} className="mt-1">
                    {deliveryStatusMeta(selected.status).label}
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-white">
                  {formatPrice(selected.calculated_price, selected.currency)} · {selected.distance_km} km
                </p>
              </div>

              {selected.customer && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <User className="w-4 h-4 text-slate-500" />
                  {selected.customer.full_name || selected.customer.email}
                </div>
              )}

              {selected.device && (
                <p className="text-xs text-slate-400 font-mono">Smart Box: {selected.device.device_id} · {selected.device.lock_status}</p>
              )}

              <RiderRouteMap delivery={selected} height="260px" />

              <div className="grid sm:grid-cols-2 gap-3">
                <AddressCard label="Pickup A" address={selected.pickup_address} accent="pickup" />
                <AddressCard label="Delivery B" address={selected.delivery_address} accent="delivery" />
              </div>

              {selected.special_instructions && (
                <p className="text-xs text-slate-400 p-3 rounded-lg bg-surface border border-border">
                  <Package className="w-3.5 h-3.5 inline mr-1" />
                  {selected.special_instructions}
                </p>
              )}

              {selected.status === 'rider_assigned' && isRider && (
                <button
                  type="button"
                  onClick={() => handleStartTransit(selected.id)}
                  disabled={actionId === selected.id}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {actionId === selected.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Start transit
                </button>
              )}

              {selected.status === 'in_transit' && (
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/25 text-xs text-primary-light flex items-center gap-2">
                  <Navigation className="w-4 h-4 shrink-0" /> In transit
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
