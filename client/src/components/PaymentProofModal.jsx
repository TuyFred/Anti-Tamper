import Modal from './ui/Modal';

export default function PaymentProofModal({ open, onClose, proofUrl, title = 'Payment proof' }) {
  if (!proofUrl) return null;

  const isImage = proofUrl.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(proofUrl);

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-3">
        {isImage ? (
          <img
            src={proofUrl}
            alt="Payment proof"
            className="w-full max-h-[70vh] object-contain rounded-xl border border-border bg-black/20"
          />
        ) : (
          <p className="text-sm text-white break-all p-4 rounded-xl bg-surface border border-border">{proofUrl}</p>
        )}
        {isImage && (
          <a
            href={proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-primary-light hover:underline"
          >
            Open full size
          </a>
        )}
      </div>
    </Modal>
  );
}
