import { useMemo } from 'react';
import { filterDeliverySegment } from '../lib/deliveryUtils';
import Pagination from './ui/Pagination';
import { usePagination } from '../hooks/usePagination';
import DeliveryHistoryCard from './DeliveryHistoryCard';

export default function CustomerDeliveryCards({
  deliveries,
  config,
  token,
  segment = 'active',
  paymentMethods,
  setPaymentMethods,
  proofFiles,
  setProofFiles,
  uploadingId,
  reviews,
  setReviews,
  submittedReviews,
  reviewSubmittingId,
  onUploadProof,
  onReview,
  onUpdated,
  onError,
  onSuccess,
}) {
  const list = useMemo(
    () => filterDeliverySegment(deliveries, segment)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [deliveries, segment],
  );

  const pagination = usePagination(list);

  if (list.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {pagination.slice.map((d) => (
        <DeliveryHistoryCard
          key={d.id}
          delivery={d}
          config={config}
          paymentMethod={paymentMethods[d.id] || d.payment_method || 'momo'}
          onPaymentMethodChange={(method) => setPaymentMethods({ ...paymentMethods, [d.id]: method })}
          proofFile={proofFiles[d.id]}
          onProofFileChange={(file) => setProofFiles({ ...proofFiles, [d.id]: file })}
          onSubmitProof={() => onUploadProof(d.id)}
          uploading={uploadingId === d.id}
          review={reviews[d.id]}
          submittedReview={submittedReviews[d.id]}
          onReviewChange={(rev) => setReviews({ ...reviews, [d.id]: rev })}
          onSubmitReview={() => onReview(d.id)}
          reviewSubmitting={reviewSubmittingId === d.id}
          token={token}
          onUpdated={onUpdated}
          onError={onError}
          onSuccess={onSuccess}
          defaultExpanded={segment === 'active'}
        />
      ))}
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={pagination.setPage}
        total={pagination.total}
        rangeStart={pagination.rangeStart}
        rangeEnd={pagination.rangeEnd}
        hasPrev={pagination.hasPrev}
        hasNext={pagination.hasNext}
      />
    </div>
  );
}
