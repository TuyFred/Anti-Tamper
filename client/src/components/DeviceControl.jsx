import {
  Lock, Unlock, Bell, BellOff, Wifi, WifiOff,
  AlertTriangle, Vibrate, Shield, MapPin,
} from 'lucide-react';
import Badge from './ui/Badge';

export default function DeviceControl({ device, onUnlock, onLock, onToggleAlarm, loading, canControl = false }) {
  if (!device) {
    return (
      <div className="glass-card rounded-xl p-8 text-center text-slate-400 h-full flex flex-col items-center justify-center">
        <Shield className="w-10 h-10 text-slate-600 mb-3" />
        <p className="text-sm">Select a device</p>
      </div>
    );
  }

  const hasAlert = device.tamper_status || device.shock_detected;

  return (
    <div className="glass-card rounded-xl overflow-hidden h-full flex flex-col">
      <div className={`px-5 py-4 border-b border-border ${hasAlert ? 'bg-danger/5' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">{device.name}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{device.device_id}</p>
          </div>
          {device.is_online ? (
            <Badge variant="success"><Wifi className="w-3 h-3 mr-1 inline" />Online</Badge>
          ) : (
            <Badge variant="neutral"><WifiOff className="w-3 h-3 mr-1 inline" />Offline</Badge>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4 flex-1">
        <div className="grid grid-cols-2 gap-3">
          <StatusBadge icon={Shield} label="Lock" value={device.lock_status === 'unlocked' ? 'Open' : 'Locked'} alert={device.lock_status === 'unlocked'} />
          <StatusBadge icon={AlertTriangle} label="Tamper" value={device.tamper_status ? 'ACTIVE' : 'OK'} alert={device.tamper_status} />
          <StatusBadge icon={Vibrate} label="Shock" value={device.shock_detected ? 'DETECTED' : 'OK'} alert={device.shock_detected} />
          <StatusBadge icon={Bell} label="Alarm" value={device.buzzer_active ? 'ACTIVE' : 'Off'} alert={device.buzzer_active} />
        </div>

        {device.latitude && device.longitude && (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-surface rounded-xl p-3 border border-border">
            <MapPin className="w-3.5 h-3.5 text-primary-light shrink-0" />
            <span className="font-mono">{device.latitude.toFixed(6)}, {device.longitude.toFixed(6)}</span>
          </div>
        )}

        {!canControl && (
          <div className="p-3 bg-warning/10 border border-warning/25 rounded-xl text-xs text-warning">
            <p className="font-medium mb-1">No unlock permission</p>
            <p className="text-slate-400">
              Ask an admin to grant <strong className="text-slate-300">Unlock control</strong> for this device.
              Opening the box without authorization triggers the reed-switch alarm.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onUnlock}
            disabled={loading || !canControl || device.lock_status === 'unlocked'}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-success/15 text-success hover:bg-success/25 border border-success/25 rounded-xl text-sm font-medium transition disabled:opacity-40"
            title={!canControl ? 'No unlock permission' : undefined}
          >
            <Unlock className="w-4 h-4" />
            Unlock
          </button>
          <button
            onClick={onLock}
            disabled={loading || !canControl || device.lock_status === 'locked'}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary/15 text-primary-light hover:bg-primary/25 border border-primary/25 rounded-xl text-sm font-medium transition disabled:opacity-40"
            title={!canControl ? 'No control permission' : undefined}
          >
            <Lock className="w-4 h-4" />
            Lock
          </button>
        </div>

        <button
          onClick={() => onToggleAlarm(!device.buzzer_active)}
          disabled={loading || !canControl}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition disabled:opacity-40 border ${
            device.buzzer_active
              ? 'bg-danger/15 text-danger border-danger/25 hover:bg-danger/25'
              : 'bg-warning/15 text-warning border-warning/25 hover:bg-warning/25'
          }`}
        >
          {device.buzzer_active ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          {device.buzzer_active ? 'Stop alarm' : 'Trigger alarm'}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ icon: Icon, label, value, alert }) {
  return (
    <div className={`rounded-xl p-3 border ${alert ? 'bg-danger/10 border-danger/25' : 'bg-surface border-border'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${alert ? 'text-danger' : 'text-slate-500'}`} />
        <span className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${alert ? 'text-danger animate-pulse-alert' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}
