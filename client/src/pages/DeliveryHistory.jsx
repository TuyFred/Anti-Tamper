import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { countDeliverySegments } from '../lib/deliveryUtils';
import { useCustomerDeliveries } from '../hooks/useCustomerDeliveries';
import CustomerDeliveryCards from '../components/CustomerDeliveryCards';
import ListTabs from '../components/ui/ListTabs';
import ContentSkeleton from '../components/ui/ContentSkeleton';

export default function DeliveryHistory() {
  const { token } = useAuth();
  const { deliveryUpdateTick } = useSocket();
  const [segment, setSegment] = useState('delivered');

  const {
    config,
    deliveries,
    loading,
    error,
    setError,
    success,
    setSuccess,
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
    handleUploadProof,
    handleReview,
  } = useCustomerDeliveries(token, deliveryUpdateTick);

  const segments = countDeliverySegments(deliveries);

  if (loading && deliveries.length === 0) {
    return <ContentSkeleton rows={4} />;
  }

  const emptyTitle = segment === 'delivered' ? 'No completed deliveries yet.' : 'No cancelled deliveries.';

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
          <Link
            to="/deliveries"
            className="inline-flex items-center gap-1.5 text-sm text-primary-light hover:underline mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to active deliveries
          </Link>
          <h2 className="text-lg font-bold text-white">Delivery history</h2>
          <p className="text-sm text-slate-500 mt-0.5">Completed and cancelled — 10 per page</p>
        </div>
      </div>

      <ListTabs
        active={segment}
        onChange={setSegment}
        tabs={[
          { id: 'delivered', label: 'Completed', count: segments.delivered },
          { id: 'cancelled', label: 'Cancelled', count: segments.cancelled },
        ]}
      />

      {(segment === 'delivered' ? segments.delivered : segments.cancelled) === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-slate-500 text-sm">
          <Package className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          {emptyTitle}
        </div>
      ) : (
        <CustomerDeliveryCards
          deliveries={deliveries}
          config={config}
          token={token}
          segment={segment}
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
