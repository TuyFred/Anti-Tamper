import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Truck, MapPin, ArrowRight, Play, Package, Loader2, Navigation,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';
import { deliveryStatusMeta, formatPrice } from '../lib/deliveryUtils';

export default function RiderRoute() {
  const { token, isRider, isManager } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);

  const load = async () => {
    try {
      setAssignments(await api.getDeliveries(token));
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

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>
      )}

      <div className="glass-card rounded-xl p-5">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary-light" />
          My assignments
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Pick up the Smart Box, start transit, and deliver to the customer address.
        </p>
      </div>

      {active.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-slate-500 text-sm">
          No active assignments. The manager will assign you when a delivery is ready.
        </div>
      ) : (
        <div className="space-y-4">
          {active.map((d) => {
            const meta = deliveryStatusMeta(d.status);
            return (
              <div key={d.id} className="glass-card rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="text-sm text-white flex items-center gap-2 flex-wrap">
                      <MapPin className="w-4 h-4 text-success shrink-0" />
                      {d.pickup_address}
                      <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                      {d.delivery_address}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatPrice(d.calculated_price, d.currency)} · {d.distance_km} km
                      {d.device && ` · Box ${d.device.device_id}`}
                    </p>
                    {d.customer && (
                      <p className="text-xs text-slate-400 mt-1">
                        Customer: {d.customer.full_name || d.customer.email}
                      </p>
                    )}
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>

                {d.status === 'rider_assigned' && (
                  <button
                    type="button"
                    onClick={() => handleStartTransit(d.id)}
                    disabled={actionId === d.id}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                  >
                    {actionId === d.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Start transit — box picked up
                  </button>
                )}

                {d.status === 'in_transit' && (
                  <p className="text-sm text-primary-light flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    In transit — deliver to customer and wait for token unlock
                  </p>
                )}

                {d.special_instructions && (
                  <p className="text-xs text-slate-400 border-t border-border pt-3">
                    <Package className="w-3.5 h-3.5 inline mr-1" />
                    {d.special_instructions}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
