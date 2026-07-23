import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate, requireApproved, requireManager } from '../middleware/auth.js';
import { logGeneratedReport } from '../lib/activityLog.js';
import {
  buildDeliveriesSummaryPdf,
  buildFinancialPdf,
  buildActivityPdf,
  buildDeliveryDetailPdf,
} from '../lib/pdfReports.js';

const router = Router();

const DELIVERY_SELECT = `
  *,
  customer:profiles!delivery_requests_customer_id_fkey(id, email, full_name),
  rider:profiles!delivery_requests_rider_id_fkey(id, email, full_name),
  device:devices(id, device_id, name, lock_status, is_online)
`;

function parseDateRange(query) {
  const from = query.from || null;
  const to = query.to || null;
  return { from, to };
}

function applyDateFilter(query, column, { from, to }) {
  if (from) query = query.gte(column, from);
  if (to) query = query.lte(column, `${to}T23:59:59.999Z`);
  return query;
}

router.use(authenticate, requireApproved, requireManager);

router.get('/history', async (req, res) => {
  const { from, to } = parseDateRange(req.query);
  const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);

  let query = supabase
    .from('activity_log')
    .select(`
      *,
      actor:profiles!activity_log_actor_id_fkey(id, email, full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  query = applyDateFilter(query, 'created_at', { from, to });

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/delivery/:id', async (req, res) => {
  const { id } = req.params;

  const [deliveryRes, historyRes, paymentsRes] = await Promise.all([
    supabase.from('delivery_requests').select(DELIVERY_SELECT).eq('id', id).single(),
    supabase.from('delivery_status_history')
      .select('*, changed_by_profile:profiles!delivery_status_history_changed_by_fkey(full_name, email)')
      .eq('delivery_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('payment_events')
      .select('*, actor:profiles!payment_events_actor_id_fkey(full_name, email)')
      .eq('delivery_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (deliveryRes.error || !deliveryRes.data) {
    return res.status(404).json({ error: 'Delivery not found' });
  }

  res.json({
    delivery: deliveryRes.data,
    status_history: historyRes.data || [],
    payment_events: paymentsRes.data || [],
  });
});

router.get('/generated', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
  const { data, error } = await supabase
    .from('generated_reports')
    .select(`
      *,
      generator:profiles!generated_reports_generated_by_fkey(id, email, full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/summary', async (req, res) => {
  const { from, to } = parseDateRange(req.query);

  let deliveryQuery = supabase.from('delivery_requests').select('status, calculated_price, currency, created_at');
  deliveryQuery = applyDateFilter(deliveryQuery, 'created_at', { from, to });
  const { data: deliveries, error: dErr } = await deliveryQuery;
  if (dErr) return res.status(500).json({ error: dErr.message });

  let activityQuery = supabase.from('activity_log').select('id', { count: 'exact', head: true });
  activityQuery = applyDateFilter(activityQuery, 'created_at', { from, to });
  const { count: activityCount } = await activityQuery;

  const byStatus = {};
  let revenue = 0;
  (deliveries || []).forEach((d) => {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    if (['payment_verified', 'rider_assigned', 'in_transit', 'delivered'].includes(d.status)) {
      revenue += Number(d.calculated_price || 0);
    }
  });

  res.json({
    total_deliveries: deliveries?.length || 0,
    by_status: byStatus,
    revenue_ttc: revenue,
    activity_events: activityCount || 0,
  });
});

async function fetchDeliveriesForReport(filters) {
  let query = supabase.from('delivery_requests').select(DELIVERY_SELECT).order('created_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  query = applyDateFilter(query, 'created_at', filters);
  const { data, error } = await query.limit(1000);
  if (error) throw new Error(error.message);
  return data || [];
}

async function sendPdf(res, buffer, fileName) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
}

router.get('/pdf/deliveries', async (req, res) => {
  try {
    const filters = parseDateRange(req.query);
    if (req.query.status) filters.status = req.query.status;
    const deliveries = await fetchDeliveriesForReport(filters);
    const buffer = await buildDeliveriesSummaryPdf(deliveries, filters);
    const fileName = `deliveries-report-${Date.now()}.pdf`;
    await logGeneratedReport({
      reportType: 'deliveries_summary',
      title: 'Deliveries Summary Report',
      generatedBy: req.user.id,
      filters,
      recordCount: deliveries.length,
      fileName,
    });
    await sendPdf(res, buffer, fileName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pdf/financial', async (req, res) => {
  try {
    const filters = parseDateRange(req.query);
    const deliveries = await fetchDeliveriesForReport(filters);
    const buffer = await buildFinancialPdf(deliveries, filters);
    const fileName = `financial-report-${Date.now()}.pdf`;
    await logGeneratedReport({
      reportType: 'financial',
      title: 'Financial Report',
      generatedBy: req.user.id,
      filters,
      recordCount: deliveries.length,
      fileName,
    });
    await sendPdf(res, buffer, fileName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pdf/activity', async (req, res) => {
  try {
    const filters = parseDateRange(req.query);
    let query = supabase
      .from('activity_log')
      .select(`
        *,
        actor:profiles!activity_log_actor_id_fkey(id, email, full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(500);
    query = applyDateFilter(query, 'created_at', filters);
    const { data: entries, error } = await query;
    if (error) throw new Error(error.message);

    const buffer = await buildActivityPdf(entries || [], filters);
    const fileName = `activity-report-${Date.now()}.pdf`;
    await logGeneratedReport({
      reportType: 'activity',
      title: 'Activity & Audit Log',
      generatedBy: req.user.id,
      filters,
      recordCount: entries?.length || 0,
      fileName,
    });
    await sendPdf(res, buffer, fileName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pdf/delivery/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [deliveryRes, historyRes, paymentsRes] = await Promise.all([
      supabase.from('delivery_requests').select(DELIVERY_SELECT).eq('id', id).single(),
      supabase.from('delivery_status_history').select('*').eq('delivery_id', id).order('created_at'),
      supabase.from('payment_events').select('*').eq('delivery_id', id).order('created_at'),
    ]);
    if (deliveryRes.error || !deliveryRes.data) {
      return res.status(404).json({ error: 'Delivery not found' });
    }

    const buffer = await buildDeliveryDetailPdf(
      deliveryRes.data,
      historyRes.data || [],
      paymentsRes.data || [],
      parseDateRange(req.query),
    );
    const fileName = `delivery-${String(id).slice(0, 8)}-${Date.now()}.pdf`;
    await logGeneratedReport({
      reportType: 'delivery_detail',
      title: `Delivery Report ${id}`,
      generatedBy: req.user.id,
      filters: { delivery_id: id },
      recordCount: 1,
      fileName,
    });
    await sendPdf(res, buffer, fileName);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
