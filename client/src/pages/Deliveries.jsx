import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Star, Loader2, Radio, Truck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';
import { deliveryStatusMeta, formatPrice } from '../lib/deliveryUtils';
import DeliveryRequestFormSection from '../components/DeliveryRequestFormSection';
import CustomerUnlockPanel from '../components/CustomerUnlockPanel';
import StarRating from '../components/StarRating';
import DeliveryPaymentStep, {
  DeliveryProgressBar,
  DeliveryArrivedBanner,
} from '../components/DeliveryPaymentStep';

export default function Deliveries() {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const handleCreateDelivery = async (payload) => {
    setCreating(true);
    setError('');
    try {
      await api.createDelivery(token, payload);
      setSuccess('Delivery created — choose payment method, pay, then upload proof on your delivery below.');
      await load();
      setTimeout(() => setSuccess(''), 6000);
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
      setError('Select a payment proof image first');
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
      setSuccess('Payment proof saved — wait for manager to confirm. Status will show Paid when verified.');
      await load();
      setTimeout(() => setSuccess(''), 6000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleReview = async (deliveryId) => {
    const rev = reviews[deliveryId];
    if (!rev?.rating) {
      setError('Select a star rating first');
      return;
    }
    setError('');
    try {
      await api.submitReview(token, {
        delivery_id: deliveryId,
        rating: rev.rating,
        comment: rev.comment,
      });
      setSuccess('Thank you for your review!');
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
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>
      )}
      {success && (
        <div className="p-4 bg-success/10 border border-success/25 rounded-xl text-sm text-success">{success}</div>
      )}

      <DeliveryRequestFormSection
        onSubmit={handleCreateDelivery}
        estimateApi={estimateApi}
      />

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-white">My deliveries</h3>
          <p className="text-xs text-slate-500 mt-1">
            Pay → upload proof → manager confirms → track → unlock with token at your address
          </p>
        </div>
        {deliveries.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center text-slate-500 text-sm">
            No deliveries yet. Create your first request above using Rwanda province → village address fields.
          </div>
        ) : (
          deliveries.map((d) => {
            const meta = deliveryStatusMeta(d.status);
            const showPayment = ['awaiting_payment', 'payment_submitted', 'payment_verified', 'rider_assigned', 'in_transit'].includes(d.status);
            const showUnlock = ['rider_assigned', 'in_transit'].includes(d.status);
            const showTracking = ['payment_verified', 'rider_assigned', 'in_transit'].includes(d.status);
            const showReview = d.status === 'delivered';

            return (
              <div key={d.id} className="glass-card rounded-xl p-5 space-y-4">
                <DeliveryProgressBar status={d.status} />

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-white">
                      <span>{d.pickup_address}</span>
                      <ArrowRight className="w-4 h-4 text-slate-500" />
                      <span>{d.delivery_address}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatPrice(d.calculated_price, d.currency)} · {d.distance_km} km
                      {d.device && ` · Box ${d.device.device_id}`}
                    </p>
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>

                {showPayment && (
                  <DeliveryPaymentStep
                    delivery={d}
                    config={config}
                    paymentMethod={paymentMethods[d.id] || d.payment_method || 'momo'}
                    onPaymentMethodChange={(method) => setPaymentMethods({ ...paymentMethods, [d.id]: method })}
                    proofFile={proofFiles[d.id]}
                    onProofFileChange={(file) => setProofFiles({ ...proofFiles, [d.id]: file })}
                    onSubmitProof={() => handleUploadProof(d.id)}
                    uploading={uploadingId === d.id}
                  />
                )}

                {showTracking && d.status !== 'awaiting_payment' && d.status !== 'payment_submitted' && (
                  <Link
                    to="/tracking"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/25 text-sm font-medium text-primary-light hover:bg-primary/15 transition"
                  >
                    <Radio className="w-4 h-4" />
                    Track delivery on live map
                    <Truck className="w-4 h-4 opacity-70" />
                  </Link>
                )}

                {showUnlock && (
                  <>
                    <DeliveryArrivedBanner delivery={d} />
                    <CustomerUnlockPanel
                      delivery={d}
                      token={token}
                      onUpdated={load}
                      onError={setError}
                      onSuccess={(msg) => {
                        setSuccess(msg);
                        setError('');
                      }}
                    />
                  </>
                )}

                {showReview && (
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <p className="text-sm font-medium text-white flex items-center gap-2">
                      <Star className="w-4 h-4 text-warning" /> Rate this delivery
                    </p>
                    <StarRating
                      value={reviews[d.id]?.rating || 0}
                      onChange={(r) => setReviews({ ...reviews, [d.id]: { ...reviews[d.id], rating: r } })}
                    />
                    <textarea
                      placeholder="Your comment (optional)"
                      value={reviews[d.id]?.comment || ''}
                      onChange={(e) => setReviews({ ...reviews, [d.id]: { ...reviews[d.id], rating: reviews[d.id]?.rating || 5, comment: e.target.value } })}
                      className="w-full px-4 py-2 bg-surface rounded-xl border border-border text-white text-sm min-h-[80px]"
                    />
                    <button
                      type="button"
                      onClick={() => handleReview(d.id)}
                      className="px-4 py-2 bg-warning/15 text-warning border border-warning/25 rounded-lg text-sm font-medium"
                    >
                      Submit review
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
