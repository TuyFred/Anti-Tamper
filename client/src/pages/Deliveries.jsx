import { useEffect, useState, useCallback } from 'react';
import {
  MapPin, ArrowRight, CreditCard, Upload, Key, Star, Package,
  Smartphone, Building2, CheckCircle2, Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';
import { deliveryStatusMeta, formatPrice } from '../lib/deliveryUtils';
import DeliveryRequestFormSection from '../components/DeliveryRequestFormSection';
import StarRating from '../components/StarRating';

export default function Deliveries() {
  const { token } = useAuth();
  const [config, setConfig] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [creating, setCreating] = useState(false);

  const estimateApi = useCallback(
    (payload) => api.estimateDelivery(token, payload),
    [token],
  );

  const handleCreateDelivery = async (payload) => {
    setCreating(true);
    setError('');
    try {
      await api.createDelivery(token, payload);
      setSuccess('Delivery request created — pay externally and upload proof below.');
      await load();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  const [proofFiles, setProofFiles] = useState({});
  const [paymentMethods, setPaymentMethods] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const [unlockingId, setUnlockingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);
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

  useEffect(() => {
    if (token) load();
  }, [token]);

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
      setSuccess('Payment proof submitted — manager will verify shortly.');
      await load();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  };

  const handleComplete = async (deliveryId) => {
    setCompletingId(deliveryId);
    setError('');
    try {
      await api.completeDelivery(token, deliveryId);
      setSuccess('Delivery completed — Smart Box locked. Please leave a review!');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCompletingId(null);
    }
  };

  const handleUnlock = async (deliveryId, tokenCode) => {
    setUnlockingId(deliveryId);
    setError('');
    try {
      const result = await api.unlockWithToken(token, deliveryId, tokenCode);
      setSuccess(result.message || 'Smart Box unlocked!');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUnlockingId(null);
    }
  };

  const handleReview = async (deliveryId) => {
    const rev = reviews[deliveryId];
    if (!rev?.rating) {
      setError('Select a star rating first');
      return;
    }
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

      {config && (
        <section className="glass-card rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary-light" />
            Pay externally
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-surface border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-success" />
                <span className="font-semibold text-white">MoMo Pay</span>
              </div>
              <p className="text-sm text-slate-300 font-mono">{config.payment.momoNumber}</p>
              <p className="text-xs text-slate-500 mt-1">{config.payment.momoName}</p>
            </div>
            <div className="p-4 rounded-xl bg-surface border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-primary-light" />
                <span className="font-semibold text-white">Bank transfer</span>
              </div>
              <p className="text-sm text-slate-300">{config.payment.bankName}</p>
              <p className="text-sm text-white font-mono">{config.payment.bankAccount}</p>
              <p className="text-xs text-slate-500 mt-1">{config.payment.bankAccountName}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            After paying, upload proof of payment on your delivery below. Manager will verify before dispatch.
          </p>
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-lg font-bold text-white">My deliveries</h3>
        {deliveries.length === 0 ? (
          <div className="glass-card rounded-xl p-12 text-center text-slate-500 text-sm">
            No deliveries yet. Create your first request above.
          </div>
        ) : (
          deliveries.map((d) => {
            const meta = deliveryStatusMeta(d.status);
            const showProof = ['awaiting_payment', 'payment_submitted'].includes(d.status);
            const showToken = ['rider_assigned', 'in_transit'].includes(d.status);
            const canUnlock = showToken && !d.token_used_at;
            const showUnlocked = showToken && d.token_used_at;
            const canComplete = showUnlocked && ['rider_assigned', 'in_transit'].includes(d.status);
            const showReview = d.status === 'delivered';

            return (
              <div key={d.id} className="glass-card rounded-xl p-5 space-y-4">
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

                {showProof && (
                  <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <p className="text-sm font-medium text-white flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Upload payment proof
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={`payment-${d.id}`}
                          checked={(paymentMethods[d.id] || d.payment_method || 'momo') === 'momo'}
                          onChange={() => setPaymentMethods({ ...paymentMethods, [d.id]: 'momo' })}
                        />
                        MoMo Pay
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <input
                          type="radio"
                          name={`payment-${d.id}`}
                          checked={(paymentMethods[d.id] || d.payment_method || 'momo') === 'bank'}
                          onChange={() => setPaymentMethods({ ...paymentMethods, [d.id]: 'bank' })}
                        />
                        Bank transfer
                      </label>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setProofFiles({ ...proofFiles, [d.id]: e.target.files?.[0] || null })}
                      className="text-sm text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleUploadProof(d.id)}
                      disabled={uploadingId === d.id}
                      className="px-4 py-2 bg-primary/15 text-primary-light border border-primary/25 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {uploadingId === d.id ? 'Uploading…' : 'Submit proof'}
                    </button>
                  </div>
                )}

                {d.payment_proof_url && d.status === 'payment_submitted' && (
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    Proof submitted — awaiting manager verification
                  </p>
                )}

                {showToken && d.unlock_token && (
                  <div className="p-4 rounded-xl bg-success/10 border border-success/30">
                    <p className="text-xs text-success font-bold uppercase mb-1">Your unlock token</p>
                    <p className="text-3xl font-mono font-bold text-white tracking-widest">{d.unlock_token}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Enter this token at delivery to unlock the Smart Box
                    </p>
                  </div>
                )}

                {canUnlock && (
                  <button
                    type="button"
                    onClick={() => handleUnlock(d.id, d.unlock_token)}
                    disabled={unlockingId === d.id}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-success text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                    {unlockingId === d.id ? 'Unlocking…' : 'Unlock Smart Box with my token'}
                  </button>
                )}

                {showUnlocked && (
                  <div className="space-y-3">
                    <p className="text-xs text-success flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Box unlocked — retrieve your items
                    </p>
                    {canComplete && (
                      <button
                        type="button"
                        onClick={() => handleComplete(d.id)}
                        disabled={completingId === d.id}
                        className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                      >
                        {completingId === d.id ? 'Completing…' : 'I received my items — complete delivery'}
                      </button>
                    )}
                  </div>
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
