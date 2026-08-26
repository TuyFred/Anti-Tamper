import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Vibrate, Shield, X, Bell } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { EVENT_CONFIG } from './AlertList';
import AlertDateTime from './AlertDateTime';

const ICONS = {
  shock: Vibrate,
  unauthorized: Shield,
  tamper: AlertTriangle,
};

export default function AlertToast() {
  const { alerts, socket } = useSocket();
  const [visible, setVisible] = useState(null);
  const [liveAlert, setLiveAlert] = useState(null);

  useEffect(() => {
    if (!socket) return undefined;
    const showLive = (alert) => {
      if (alert?.severity === 'critical' && !alert?.is_acknowledged) {
        setLiveAlert({
          ...alert,
          created_at: alert.created_at || new Date().toISOString(),
        });
      }
    };
    socket.on('alert:notify', showLive);
    socket.on('alert:new', showLive);
    return () => {
      socket.off('alert:notify', showLive);
      socket.off('alert:new', showLive);
    };
  }, [socket]);

  useEffect(() => {
    const critical = liveAlert
      || alerts.find((a) => !a.is_acknowledged && a.severity === 'critical');
    if (critical) {
      setVisible({
        ...critical,
        created_at: critical.created_at || new Date().toISOString(),
      });
      setLiveAlert(null);
      const timer = setTimeout(() => setVisible(null), 15000);
      return () => clearTimeout(timer);
    }
    setVisible(null);
    return undefined;
  }, [alerts, liveAlert]);

  if (!visible) return null;

  const config = EVENT_CONFIG[visible.event_type] || EVENT_CONFIG.system;
  const Icon = ICONS[visible.event_type] || Bell;
  const isShock = visible.event_type === 'shock';
  const isUnauthorized = visible.event_type === 'unauthorized';

  return (
    <div
      className="alert-toast-root"
      role="alert"
      aria-live="assertive"
    >
      <div
        className={`alert-toast ${
          isShock
            ? 'alert-toast--warning'
            : isUnauthorized
              ? 'alert-toast--danger'
              : 'alert-toast--primary'
        }`}
      >
        <div className={`alert-toast__bar ${isShock ? 'bg-warning' : isUnauthorized ? 'bg-danger' : 'bg-primary'}`} />
        <div className="alert-toast__body">
          <div
            className={`alert-toast__icon ${
              isShock ? 'alert-toast__icon--warning' : 'alert-toast__icon--danger'
            }`}
          >
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="alert-toast__eyebrow">Security alert · Live</p>
                <p className="alert-toast__title">{config.label}</p>
              </div>
              <button
                type="button"
                onClick={() => setVisible(null)}
                className="alert-toast__close"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <AlertDateTime
              iso={visible.created_at}
              live
              variant="toast"
              className="mt-2"
            />

            <p className="alert-toast__message">{visible.message}</p>

            {visible.device?.device_id && (
              <p className="alert-toast__device">
                {visible.device?.name || 'Device'}
                <span className="font-mono"> · {visible.device.device_id}</span>
              </p>
            )}

            <div className="alert-toast__actions">
              <Link to="/alerts" className="dashboard-btn dashboard-btn--primary text-xs py-2">
                View alert
              </Link>
              {visible.latitude != null && (
                <Link to="/tracking" className="dashboard-link text-xs">
                  Open map
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
