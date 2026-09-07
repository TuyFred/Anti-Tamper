/**
 * Merge live unlock-code patches from sockets into delivery list
 * so the customer sees the code instantly when admin grants — no manual refresh.
 */
export function mergeDeliveriesWithLivePatches(deliveries, patches) {
  if (!Array.isArray(deliveries) || !patches || !Object.keys(patches).length) {
    return deliveries || [];
  }
  return deliveries.map((d) => {
    const patch = patches[d.id];
    if (!patch) return d;

    // API already shows closed/used — never revive an old live code.
    if (d.token_closed_at) return d;

    const unlock_token = d.unlock_token || d.unlock_code || patch.unlock_token || patch.unlock_code || null;
    const token_closed_at = d.token_closed_at || patch.token_closed_at || null;
    const grantedFlag = patch.open_permission === 'granted'
      || Boolean(patch.rider_unlock_granted_at)
      || Boolean(patch.customer_can_open);

    if (!unlock_token && !token_closed_at && !grantedFlag) return d;

    const token_expires_at = d.token_expires_at || patch.token_expires_at || null;
    const token_sent_at = d.token_sent_at || patch.token_sent_at || null;

    return {
      ...d,
      unlock_token: token_closed_at ? null : unlock_token,
      unlock_code: token_closed_at ? null : unlock_token,
      token_expires_at,
      token_sent_at,
      token_closed_at,
      token_requested_at: unlock_token && !token_closed_at ? null : d.token_requested_at,
      rider_unlock_granted_at: d.rider_unlock_granted_at || patch.rider_unlock_granted_at || null,
      open_permission: (unlock_token && !token_closed_at) || grantedFlag
        ? 'granted'
        : (token_closed_at ? 'used' : (d.open_permission || 'waiting')),
      customer_can_open: Boolean(unlock_token) && !token_closed_at,
      rider_can_open: false,
    };
  });
}

/** Merge /my-unlock-codes rows into the deliveries list (source of truth for customer code). */
export function mergeDeliveriesWithUnlockCodes(deliveries, codes) {
  if (!Array.isArray(deliveries) || !Array.isArray(codes) || !codes.length) {
    return deliveries || [];
  }
  const byId = Object.fromEntries(
    codes
      .filter((c) => c?.id && (c.unlock_token || c.unlock_code))
      .map((c) => [String(c.id).toLowerCase(), c]),
  );
  return deliveries.map((d) => {
    const hit = byId[String(d.id).toLowerCase()];
    if (!hit || d.token_closed_at) return d;
    const code = hit.unlock_token || hit.unlock_code;
    if (!code) return d;
    return {
      ...d,
      unlock_token: code,
      unlock_code: code,
      token_expires_at: hit.token_expires_at || d.token_expires_at || null,
      token_sent_at: hit.token_sent_at || d.token_sent_at || null,
      open_permission: 'granted',
      customer_can_open: true,
      token_requested_at: null,
    };
  });
}
