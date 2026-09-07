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

    const unlock_token = d.unlock_token || patch.unlock_token || null;
    if (!unlock_token && !patch.token_closed_at) return d;

    const token_closed_at = d.token_closed_at || patch.token_closed_at || null;
    const token_expires_at = d.token_expires_at || patch.token_expires_at || null;
    const token_sent_at = d.token_sent_at || patch.token_sent_at || null;

    return {
      ...d,
      unlock_token: token_closed_at ? null : unlock_token,
      token_expires_at,
      token_sent_at,
      token_closed_at,
      token_requested_at: unlock_token && !token_closed_at ? null : d.token_requested_at,
      open_permission: unlock_token && !token_closed_at
        ? 'granted'
        : (token_closed_at ? 'used' : (d.open_permission || 'waiting')),
      customer_can_open: Boolean(unlock_token) && !token_closed_at,
      rider_can_open: Boolean(unlock_token) && !token_closed_at
        ? (patch.rider_can_open ?? d.rider_can_open ?? true)
        : false,
    };
  });
}
