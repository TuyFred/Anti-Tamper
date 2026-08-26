import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { countDeliverySegments } from '../lib/deliveryUtils';
import { useCustomerDeliveries } from '../hooks/useCustomerDeliveries';
import DeliveryBookingModal from '../components/DeliveryRequestFormSection';
import CustomerDeliveryCards from '../components/CustomerDeliveryCards';
import ContentSkeleton from '../components/ui/ContentSkeleton';

export default function Deliveries() {
  const { token } = useAuth();
  const { deliveryUpdateTick } = useSocket();
  const [bookingOpen, setBookingOpen] = useState(false);

  const {
    config,
    deliveries,
    loading,
    error,
    setError,
    success,
    setSuccess,
    creating,
    proofFiles,
    setProofFiles,
    paymentMethods,
    setPaymentMethods,
    uploadingId,
    reviews,
    setReviews,
    submittedReviews,
    reviewSubmittingId,
    load,
    estimateApi,
    handleCreateDelivery,
    handleUploadProof,
    handleReview,
  } = useCustomerDeliveries(token, deliveryUpdateTick);

  const segments = countDeliverySegments(deliveries);
  const activeCount = segments.active;

  if (loading && deliveries.length === 0) {
    return <ContentSkeleton rows={4} />;
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
        <div>
          <h2 className="text-lg font-bold text-white">My deliveries</h2>
          <p className="text-sm text-slate-500 mt-0.5">{activeCount} active — 10 per page</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {segments.history > 0 && (
            <Link
              to="/deliveries/history"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-border text-slate-300 hover:text-white text-sm font-semibold rounded-xl transition"
            >
              <History className="w-4 h-4" />
              History ({segments.history})
            </Link>
          )}
          <button
            type="button"
            onClick={() => setBookingOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl transition touch-manipulation"
          >
            <Plus className="w-4 h-4" />
            New delivery
          </button>
        </div>
      </div>

      <DeliveryBookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onSubmit={handleCreateDelivery}
        estimateApi={estimateApi}
        submitting={creating}
      />

      {activeCount === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center space-y-4">
          <p className="text-slate-500 text-sm">No active deliveries.</p>
          <button
            type="button"
            onClick={() => setBookingOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            Create your first delivery
          </button>
          {segments.history > 0 && (
            <p className="text-xs text-slate-500">
              Past orders are in{' '}
              <Link to="/deliveries/history" className="text-primary-light hover:underline">History</Link>
            </p>
          )}
        </div>
      ) : (
        <CustomerDeliveryCards
          deliveries={deliveries}
          config={config}
          token={token}
          segment="active"
          paymentMethods={paymentMethods}
          setPaymentMethods={setPaymentMethods}
          proofFiles={proofFiles}
          setProofFiles={setProofFiles}
          uploadingId={uploadingId}
          reviews={reviews}
          setReviews={setReviews}
          submittedReviews={submittedReviews}
          reviewSubmittingId={reviewSubmittingId}
          onUploadProof={handleUploadProof}
          onReview={handleReview}
          onUpdated={load}
          onError={setError}
          onSuccess={(msg) => { setSuccess(msg); setError(''); }}
        />
      )}
    </div>
  );
}
