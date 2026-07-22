import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate, requireApproved, requireManager } from '../middleware/auth.js';
import { isCustomer } from '../middleware/permissions.js';

const router = Router();

router.get('/', authenticate, requireApproved, async (req, res) => {
  let query = supabase
    .from('delivery_reviews')
    .select(`
      *,
      delivery:delivery_requests(id, pickup_address, delivery_address, delivered_at),
      customer:profiles!delivery_reviews_customer_id_fkey(id, full_name, email),
      rider:profiles!delivery_reviews_rider_id_fkey(id, full_name, email)
    `)
    .order('created_at', { ascending: false });

  if (isCustomer(req.profile)) {
    query = query.eq('customer_id', req.user.id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/', authenticate, requireApproved, async (req, res) => {
  if (!isCustomer(req.profile)) {
    return res.status(403).json({ error: 'Only customers can submit reviews' });
  }

  const { delivery_id, rating, comment } = req.body;
  if (!delivery_id || !rating) {
    return res.status(400).json({ error: 'delivery_id and rating (1-5) are required' });
  }
  const stars = parseInt(rating, 10);
  if (stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const { data: delivery } = await supabase
    .from('delivery_requests')
    .select('id, customer_id, rider_id, status')
    .eq('id', delivery_id)
    .single();

  if (!delivery || delivery.customer_id !== req.user.id) {
    return res.status(404).json({ error: 'Delivery not found' });
  }
  if (delivery.status !== 'delivered') {
    return res.status(400).json({ error: 'You can only review completed deliveries' });
  }

  const { data, error } = await supabase
    .from('delivery_reviews')
    .upsert({
      delivery_id,
      customer_id: req.user.id,
      rider_id: delivery.rider_id,
      rating: stars,
      comment: comment?.trim() || null,
    }, { onConflict: 'delivery_id' })
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.get('/stats', authenticate, requireApproved, requireManager, async (_req, res) => {
  const { data, error } = await supabase
    .from('delivery_reviews')
    .select('rating');

  if (error) return res.status(500).json({ error: error.message });

  const ratings = data || [];
  const avg = ratings.length
    ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
    : 0;

  res.json({
    total: ratings.length,
    average_rating: Math.round(avg * 10) / 10,
  });
});

export default router;
