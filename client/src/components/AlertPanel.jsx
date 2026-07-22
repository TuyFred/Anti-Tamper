import AlertList from './AlertList';
import Badge from './ui/Badge';
import { Bell } from 'lucide-react';

export default function AlertPanel({ alerts, onAcknowledge, loading }) {
  const criticalAlerts = alerts.filter((a) => !a.is_acknowledged && a.severity === 'critical');

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary-light" />
          <h3 className="font-semibold text-white">Recent alerts</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{alerts.length} event(s)</span>
          {criticalAlerts.length > 0 && (
            <Badge variant="danger">{criticalAlerts.length} critical</Badge>
          )}
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
        <AlertList
          alerts={alerts.slice(0, 8)}
          onAcknowledge={onAcknowledge}
          loading={loading}
          compact
        />
      </div>
    </div>
  );
}
