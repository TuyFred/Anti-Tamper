import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isActiveDelivery, isCompletedDelivery } from '../lib/deliveryUtils';
import DeliveryBookingModal from '../components/DeliveryRequestFormSection';
import DeliveryHistoryCard from '../components/DeliveryHistoryCard';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
];

export default function Deliveries() {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const [creating, setCreating] = useState(false);
  const [proofFiles, setProofFiles] = useState({});
  const [paymentMethods, setPaymentMethods] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const [reviews, setReviews] = useState({});

  const load = async () => {
    try {
      const [cfg, list] = await Promise.all([
        api.getDeliveryConfig(token),
        api.getDeliveries(token),
      ]);
      setConfig(cfg);
      setDeliveries(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const estimateApi = useCallback(
    (payload) => api.estimateDelivery(token, payload),
    [token],
  );

  useEffect(() => {
    if (token) load();
  }, [token]);

  const filtered = useMemo(() => {
    if (filter === 'active') return deliveries.filter((d) => isActiveDelivery(d.status));
    if (filter === 'completed') return deliveries.filter((d) => isCompletedDelivery(d.status));
    return deliveries;
  }, [deliveries, filter]);

  const counts = useMemo(() => ({
    all: deliveries.length,
    active: deliveries.filter((d) => isActiveDelivery(d.status)).length,
    completed: deliveries.filter((d) => isCompletedDelivery(d.status)).length,
  }), [deliveries]);

  const handleCreateDelivery = async (payload) => {
    setCreating(true);
    setError('');
    try {
      await api.createDelivery(token, payload);
      setSuccess('Delivery created.');
      setFilter('active');
      await load();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleUploadProof = async (deliveryId) => {
    const file = proofFiles[deliveryId];
    if (!file) {
      setError('Select payment proof first');
      return;
    }
    setUploadingId(deliveryId);
    setError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      await api.submitPaymentProof(token, deliveryId, {
        payment_proof_url: dataUrl,
        payment_method: paymentMethods[deliveryId] || 'momo',
      });
      setProofFiles((prev) => ({ ...prev, [deliveryId]: null }));
      setSuccess('Proof uploaded.');
      await load();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleReview = async (deliveryId) => {
    const rev = reviews[deliveryId];
    if (!rev?.rating) {
      setError('Select a rating');
      return;
    }
    setError('');
    try {
      await api.submitReview(token, {
        delivery_id: deliveryId,
        rating: rev.rating,
        comment: rev.comment,
      });
      setSuccess('Review submitted.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>
      )}
      {success && (
        <div className="p-3 bg-success/10 border border-success/25 rounded-xl text-sm text-success">{success}</div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white">History</h3>
        <button
          type="button"
          onClick={() => setBookingOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl transition touch-manipulation shrink-0"
        >
          <Plus className="w-4 h-4" />
          New delivery
        </button>
      </div>

      <DeliveryBookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onSubmit={handleCreateDelivery}
        estimateApi={estimateApi}
        submitting={creating}
      />

      {deliveries.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition touch-manipulation ${
                filter === f.id
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-slate-400 hover:text-white'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-70">({counts[f.id]})</span>
            </button>
          ))}
        </div>
      )}

      {deliveries.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-500 text-sm">
          No deliveries yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-slate-500 text-sm">
          No {filter} deliveries.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DeliveryHistoryCard
              key={d.id}
              delivery={d}
              config={config}
              paymentMethod={paymentMethods[d.id] || d.payment_method || 'momo'}
              onPaymentMethodChange={(method) => setPaymentMethods({ ...paymentMethods, [d.id]: method })}
              proofFile={proofFiles[d.id]}
              onProofFileChange={(file) => setProofFiles({ ...proofFiles, [d.id]: file })}
              onSubmitProof={() => handleUploadProof(d.id)}
              uploading={uploadingId === d.id}
              review={reviews[d.id]}
              onReviewChange={(rev) => setReviews({ ...reviews, [d.id]: rev })}
              onSubmitReview={() => handleReview(d.id)}
              token={token}
              onUpdated={load}
              onError={setError}
              onSuccess={(msg) => {
                setSuccess(msg);
                setError('');
              }}
              defaultExpanded={isActiveDelivery(d.status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
