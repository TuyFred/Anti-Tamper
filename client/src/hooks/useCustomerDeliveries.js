import { useEffect, useMemo, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { useSocket } from '../context/SocketContext';
import { mergeDeliveriesWithLivePatches, mergeDeliveriesWithUnlockCodes } from '../lib/deliveryLivePatch';

export function useCustomerDeliveries(token, deliveryUpdateTick) {
  const { deliveryLivePatches } = useSocket();
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
  const [submittedReviews, setSubmittedReviews] = useState({});
  const [reviewSubmittingId, setReviewSubmittingId] = useState(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const [cfg, list, reviewList, unlockCodes] = await Promise.all([
        api.getDeliveryConfig(token),
        api.getDeliveries(token),
        api.getReviews(token).catch(() => []),
        api.getMyUnlockCodes(token).catch(() => []),
      ]);
      setConfig(cfg);
      setDeliveries(mergeDeliveriesWithUnlockCodes(list || [], unlockCodes || []));
      const byDelivery = {};
      for (const r of reviewList || []) {
        if (r.delivery_id) byDelivery[r.delivery_id] = r;
      }
      setSubmittedReviews(byDelivery);
      setError('');
    } catch (err) {
      if (err?.status === 401) {
        setDeliveries([]);
        setError('Session expired — please sign in again');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  useEffect(() => {
    if (token && deliveryUpdateTick > 0) load();
  }, [deliveryUpdateTick, token, load]);

  // Apply live unlock codes into list state immediately (do not wait for refetch).
  useEffect(() => {
    if (!deliveryLivePatches || !Object.keys(deliveryLivePatches).length) return;
    setDeliveries((prev) => mergeDeliveriesWithLivePatches(prev, deliveryLivePatches));
  }, [deliveryLivePatches]);

  const liveDeliveries = useMemo(
    () => mergeDeliveriesWithLivePatches(deliveries, deliveryLivePatches),
    [deliveries, deliveryLivePatches],
  );

  const estimateApi = useCallback(
    (payload) => api.estimateDelivery(token, payload),
    [token],
  );

  const handleCreateDelivery = async (payload) => {
    setCreating(true);
    setError('');
    try {
      await api.createDelivery(token, payload);
      setSuccess('Order created — pay and upload proof below.');
      await load();
      setTimeout(() => setSuccess(''), 8000);
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
    if (!rev?.rating || rev.rating < 1) {
      setError('Please select a star rating (1–5).');
      return;
    }
    setError('');
    setReviewSubmittingId(deliveryId);
    try {
      const saved = await api.submitReview(token, {
        delivery_id: deliveryId,
        rating: rev.rating,
        comment: rev.comment?.trim() || '',
      });
      setSubmittedReviews((prev) => ({ ...prev, [deliveryId]: saved }));
      setReviews((prev) => {
        const next = { ...prev };
        delete next[deliveryId];
        return next;
      });
      setSuccess('Rating submitted successfully.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewSubmittingId(null);
    }
  };

  return {
    config,
    deliveries: liveDeliveries,
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
  };
}
