import { AlertTriangle, MapPin, Vibrate, Shield, Check, Bell } from 'lucide-react';
import Badge from './ui/Badge';

export const EVENT_CONFIG = {
  tamper: { icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger/8', label: 'Tamper', emailColor: '#ef4444' },
  shock: { icon: Vibrate, color: 'text-warning', bg: 'bg-warning/8', label: 'Motion / Fall / Touch', emailColor: '#f59e0b' },
  unauthorized: { icon: Shield, color: 'text-danger', bg: 'bg-danger/8', label: 'Unauthorized', emailColor: '#ef4444' },
  gps: { icon: MapPin, color: 'text-primary-light', bg: 'bg-primary/8', label: 'GPS', emailColor: '#3b82f6' },
  system: { icon: Bell, color: 'text-slate-400', bg: 'bg-surface', label: 'System', emailColor: '#64748b' },
};

export function formatAlertTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AlertList({
  alerts,
  onAcknowledge,
  loading,
  compact = false,
  emptyMessage = 'No alerts at the moment',
}) {
  if (alerts.length === 0) {
    return (
      <div className={`text-center ${compact ? 'py-10' : 'py-16'}`}>
        <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {alerts.map((alert) => {
        const config = EVENT_CONFIG[alert.event_type] || EVENT_CONFIG.system;
        const Icon = config.icon;
        const isCritical = !alert.is_acknowledged && alert.severity === 'critical';

        return (
          <li
            key={alert.id}
            className={`transition ${compact ? 'px-4 py-3' : 'px-5 py-4'} ${
              isCritical ? config.bg : 'hover:bg-surface/30'
            }`}
          >
            <div className="flex gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isCritical ? 'bg-danger/15 ring-1 ring-danger/25' : 'bg-surface border border-border'
                }`}
              >
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge
                    variant={
                      alert.severity === 'critical'
                        ? 'danger'
                        : alert.severity === 'warning'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {config.label}
                  </Badge>
                  {alert.is_acknowledged ? (
                    <Badge variant="success">Acknowledged</Badge>
                  ) : (
                    <Badge variant="danger">New</Badge>
                  )}
                </div>
                <p className={`text-white ${compact ? 'text-xs' : 'text-sm'} leading-relaxed`}>
                  {alert.message}
                </p>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {alert.device?.name || 'Unknown device'}
                  {alert.device?.device_id && (
                    <span className="font-mono text-slate-600"> · {alert.device.device_id}</span>
                  )}
                  <span className="block sm:inline sm:ml-1"> · {formatAlertTime(alert.created_at)}</span>
                </p>
                {alert.latitude != null && alert.longitude != null && (
                  <a
                    href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary-light hover:text-white mt-1"
                  >
                    <MapPin className="w-3 h-3" />
                    View location on map
                  </a>
                )}
                {isCritical && onAcknowledge && (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    disabled={loading}
                    className="mt-2 flex items-center gap-1.5 text-xs text-primary-light hover:text-white bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" />
                    Acknowledge
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
