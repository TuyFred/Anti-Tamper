import { supabase } from '../config/supabase.js';

export async function logActivity({
  entityType,
  entityId = null,
  action,
  actorId = null,
  summary = null,
  oldValue = {},
  newValue = {},
  metadata = {},
}) {
  try {
    await supabase.from('activity_log').insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor_id: actorId,
      summary,
      old_value: oldValue,
      new_value: newValue,
      metadata,
    });
  } catch (err) {
    console.warn('activity_log insert failed:', err.message);
  }
}

export async function logDeliveryStatus(deliveryId, fromStatus, toStatus, actorId, notes = null) {
  try {
    await supabase.from('delivery_status_history').insert({
      delivery_id: deliveryId,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: actorId,
      notes,
    });
    await logActivity({
      entityType: 'delivery',
      entityId: deliveryId,
      action: 'status_changed',
      actorId,
      summary: `Status: ${fromStatus || 'new'} → ${toStatus}`,
      oldValue: { status: fromStatus },
      newValue: { status: toStatus },
      metadata: notes ? { notes } : {},
    });
  } catch (err) {
    console.warn('delivery_status_history insert failed:', err.message);
  }
}

export async function logPaymentEvent({
  deliveryId,
  eventType,
  amount,
  currency = 'RWF',
  paymentMethod = null,
  proofUrl = null,
  actorId = null,
  notes = null,
}) {
  try {
    await supabase.from('payment_events').insert({
      delivery_id: deliveryId,
      event_type: eventType,
      amount,
      currency,
      payment_method: paymentMethod,
      proof_url: proofUrl,
      actor_id: actorId,
      notes,
    });
    await logActivity({
      entityType: 'payment',
      entityId: deliveryId,
      action: eventType,
      actorId,
      summary: `Payment ${eventType}`,
      newValue: { amount, currency, payment_method: paymentMethod },
      metadata: notes ? { notes } : {},
    });
  } catch (err) {
    console.warn('payment_events insert failed:', err.message);
  }
}

export async function logGpsHistory(deviceId, latitude, longitude, source = 'mqtt') {
  try {
    await supabase.from('device_gps_history').insert({
      device_id: deviceId,
      latitude,
      longitude,
      source,
    });
  } catch (err) {
    console.warn('device_gps_history insert failed:', err.message);
  }
}

export async function logGeneratedReport({
  reportType,
  title,
  generatedBy,
  filters = {},
  recordCount = 0,
  fileName = null,
}) {
  try {
    const { data } = await supabase.from('generated_reports').insert({
      report_type: reportType,
      title,
      generated_by: generatedBy,
      filters,
      record_count: recordCount,
      file_name: fileName,
    }).select('id').single();

    await logActivity({
      entityType: 'report',
      entityId: data?.id || null,
      action: 'generated',
      actorId: generatedBy,
      summary: title,
      newValue: { report_type: reportType, record_count: recordCount },
      metadata: filters,
    });
    return data;
  } catch (err) {
    console.warn('generated_reports insert failed:', err.message);
    return null;
  }
}
