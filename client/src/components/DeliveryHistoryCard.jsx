import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, ChevronDown, ChevronUp, Radio, Truck, Package, Clock,
  Image as ImageIcon, Star, Download, Printer,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Badge from './ui/Badge';
import {
  deliveryStatusMeta,
  formatPrice,
  formatDeliveryRef,
  formatDeliveryDate,
  formatDeliveryDateTime,
  paymentMethodLabel,
  getDeliveryTimeline,
  isActiveDelivery,
} from '../lib/deliveryUtils';
import { canDownloadReceipt, downloadDeliveryReceipt, printDeliveryReceipt, getReceiptBreakdown } from '../lib/receipt';import { DeliveryProgressBar } from './DeliveryPaymentStep';
import DeliveryPaymentStep, { DeliveryArrivedBanner } from './DeliveryPaymentStep';
import CustomerUnlockPanel from './CustomerUnlockPanel';
import StarRating from './StarRating';

function AddressRow({ label, address, accent }) {
  return (
    <div className="flex gap-3 min-w-0">
      <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
        accent === 'pickup' ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary-light'
      }`}>
        {label}
      </span>
      <p className="text-sm text-slate-200 leading-snug break-words">{address || '—'}</p>
    </div>
  );
}

function ProofPreview({ url }) {
  if (!url) return null;
  const isImage = url.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-xs text-primary-light hover:underline"
    >
      {isImage ? (
        <img src={url} alt="Payment proof" className="w-10 h-10 rounded-lg object-cover border border-border" />
      ) : (
        <ImageIcon className="w-4 h-4" />
      )}
      View proof
    </a>
  );
}

export default function DeliveryHistoryCard({
  delivery,
  config,
  paymentMethod,
  onPaymentMethodChange,
  proofFile,
  onProofFileChange,
  onSubmitProof,
  uploading,
  review,
  onReviewChange,
  onSubmitReview,
  token,
  onUpdated,
  onError,
  onSuccess,
  defaultExpanded,
}) {
  const { profile } = useAuth();
  const [expanded, setExpanded] = useState(defaultExpanded ?? isActiveDelivery(delivery.status));
  const meta = deliveryStatusMeta(delivery.status);
  const timeline = getDeliveryTimeline(delivery);
  const showReceipt = canDownloadReceipt(delivery.status);
  const receipt = showReceipt ? getReceiptBreakdown(delivery, config) : null;
  const customerName = profile?.full_name || profile?.email;

  const needsPayment = delivery.status === 'awaiting_payment';
  const awaitingConfirm = delivery.status === 'payment_submitted';
  const canTrack = ['payment_verified', 'rider_assigned', 'in_transit'].includes(delivery.status);
  const canUnlock = ['rider_assigned', 'in_transit'].includes(delivery.status);
  const canReview = delivery.status === 'delivered';

  return (
    <article className="glass-card rounded-xl overflow-hidden border border-border/80">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-4 sm:p-5 hover:bg-surface-lighter/30 transition"
      >
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-xs font-mono text-slate-500">{formatDeliveryRef(delivery.id)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{formatDeliveryDate(delivery.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </div>
        </div>

        <DeliveryProgressBar status={delivery.status} />

        <div className="mt-3 space-y-2">
          <AddressRow label="A" address={delivery.pickup_address} accent="pickup" />
          <AddressRow label="B" address={delivery.delivery_address} accent="delivery" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="font-semibold text-white text-sm">{formatPrice(delivery.calculated_price, delivery.currency)}</span>
          <span>{delivery.distance_km} km</span>
          {delivery.payment_method && <span>{paymentMethodLabel(delivery.payment_method)}</span>}
          {delivery.package_type && (
            <span className="capitalize flex items-center gap-1">
              <Package className="w-3 h-3" />
              {delivery.package_type.replace('_', ' ')}
            </span>
          )}
          {delivery.device?.device_id && <span>Box {delivery.device.device_id}</span>}
        </div>
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4 border-t border-border/60 pt-4">
          {timeline.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {timeline.map((t) => (
                <span
                  key={t.key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface text-[11px] text-slate-400 border border-border"
                >
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="text-slate-300">{t.label}</span>
                  <span>{formatDeliveryDateTime(t.at)}</span>
                </span>
              ))}
            </div>
          )}

          {needsPayment && (
            <DeliveryPaymentStep
              delivery={delivery}
              config={config}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={onPaymentMethodChange}
              proofFile={proofFile}
              onProofFileChange={onProofFileChange}
              onSubmitProof={onSubmitProof}
              uploading={uploading}
            />
          )}

          {awaitingConfirm && (
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/25 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-warning">Proof sent · {paymentMethodLabel(delivery.payment_method)}</p>
              <ProofPreview url={delivery.payment_proof_url} />
            </div>
          )}

          {showReceipt && receipt && (
            <div className="p-3 rounded-xl bg-surface border border-border space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Receipt</p>
              <div className="text-sm space-y-1">
                <div className="flex justify-between text-slate-400"><span>Transport</span><span className="text-white">{formatPrice(receipt.transport_ht, receipt.currency)}</span></div>
                <div className="flex justify-between text-slate-400"><span>TVA {receipt.vat_percent}%</span><span className="text-white">{formatPrice(receipt.vat_amount, receipt.currency)}</span></div>
                <div className="flex justify-between font-semibold text-white pt-1 border-t border-border"><span>Total</span><span>{formatPrice(receipt.total_ttc, receipt.currency)}</span></div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => downloadDeliveryReceipt(delivery, config, customerName)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 border border-primary/25 text-xs font-medium text-primary-light hover:bg-primary/15 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => printDeliveryReceipt(delivery, config, customerName)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface border border-border text-xs font-medium text-slate-300 hover:text-white transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
              </div>
            </div>
          )}

          {canTrack && (
            <Link
              to="/tracking"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/25 text-sm font-medium text-primary-light hover:bg-primary/15 transition"
            >
              <Radio className="w-4 h-4" />
              Track
              <Truck className="w-4 h-4 opacity-70" />
            </Link>
          )}

          {canUnlock && (
            <>
              <DeliveryArrivedBanner delivery={delivery} />
              <CustomerUnlockPanel
                delivery={delivery}
                token={token}
                onUpdated={onUpdated}
                onError={onError}
                onSuccess={onSuccess}
              />
            </>
          )}

          {canReview && (
            <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
              <p className="text-sm font-medium text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-warning" /> Rate delivery
              </p>
              <StarRating
                value={review?.rating || 0}
                onChange={(r) => onReviewChange?.({ ...review, rating: r })}
              />
              <textarea
                placeholder="Comment (optional)"
                value={review?.comment || ''}
                onChange={(e) => onReviewChange?.({ rating: review?.rating || 5, comment: e.target.value })}
                className="w-full px-4 py-2 bg-surface rounded-xl border border-border text-white text-sm min-h-[72px]"
              />
              <button
                type="button"
                onClick={onSubmitReview}
                className="px-4 py-2 bg-warning/15 text-warning border border-warning/25 rounded-lg text-sm font-medium"
              >
                Submit
              </button>
            </div>
          )}

          {delivery.status === 'delivered' && delivery.delivered_at && (
            <p className="text-xs text-success flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Completed {formatDeliveryDateTime(delivery.delivered_at)}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
