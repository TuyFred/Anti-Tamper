import { useEffect, useState } from 'react';
import { Package, Radio, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import LiveMap from '../LiveMap';
import DeviceControl from '../DeviceControl';
import AlertPanel from '../AlertPanel';
import StatCard from '../ui/StatCard';
import Badge from '../ui/Badge';
import { Wifi, AlertTriangle, Bell } from 'lucide-react';

export default function BoxTrackingPanel({ compact = false, showAlerts = true }) {
  const { token, isCustomer, isRider, isManager } = useAuth();
  const {
    devices,
    alerts,
    setInitialDevices,
    setInitialAlerts,
    acknowledgeAlertLocal,
    setDevices,
    connected,
    gpsUpdates,
  } = useSocket();
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [deviceList, alertList] = await Promise.all([
          api.getDevices(token),
          showAlerts ? api.getAlerts(token) : Promise.resolve([]),
        ]);
        setInitialDevices(deviceList);
        if (showAlerts) setInitialAlerts(alertList);
        if (deviceList.length > 0) {
          setSelectedId((prev) => prev || deviceList[0].id);
        }
      } catch (err) {
        console.error('Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token, setInitialDevices, setInitialAlerts, showAlerts, refreshKey]);

  const selectedDevice = mergeDeviceWithGps(
    devices.find((d) => d.id === selectedId) || devices[0],
    gpsUpdates,
  );
  const onlineCount = devices.filter((d) => d.is_online).length;
  const criticalAlerts = alerts.filter((a) => !a.is_acknowledged && a.severity === 'critical').length;
  const tamperActive = devices.some((d) => d.tamper_status || d.shock_detected);

  const handleUnlock = async () => {
    if (!selectedDevice) return;
    setActionLoading(true);
    try {
      await api.unlockDevice(token, selectedDevice.id);
      setDevices((prev) =>
        prev.map((d) => (d.id === selectedDevice.id ? { ...d, lock_status: 'unlocked' } : d))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLock = async () => {
    if (!selectedDevice) return;
    setActionLoading(true);
    try {
      await api.lockDevice(token, selectedDevice.id);
      setDevices((prev) =>
        prev.map((d) => (d.id === selectedDevice.id ? { ...d, lock_status: 'locked' } : d))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAlarm = async (active) => {
    if (!selectedDevice) return;
    setActionLoading(true);
    try {
      await api.toggleAlarm(token, selectedDevice.id, active);
      setDevices((prev) =>
        prev.map((d) =>
          d.id === selectedDevice.id ? { ...d, buzzer_active: active, led_active: active } : d
        )
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      await api.acknowledgeAlert(token, alertId);
      acknowledgeAlertLocal(alertId);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading && devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-surface-lighter flex items-center justify-center mx-auto mb-4">
          <Package className="w-7 h-7 text-slate-500" />
        </div>
        <h3 className="text-base font-semibold text-white mb-4">No boxes</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {isCustomer && (
            <Link to="/deliveries" className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium">
              My Deliveries
            </Link>
          )}
          {isRider && (
            <Link to="/rider" className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium">
              My Route
            </Link>
          )}
          {isManager && (
            <Link to="/operations" className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium">
              Operations
            </Link>
          )}
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="px-4 py-2 rounded-xl border border-border text-slate-400 text-sm hover:text-white flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!compact && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-slate-400 hover:text-white hover:bg-surface-lighter transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh map
          </button>
        </div>
      )}
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Package} label="Boxes" value={devices.length} accent="primary" />
          <StatCard icon={Wifi} label="Live" value={connected ? 'Yes' : 'No'} accent={connected ? 'success' : 'neutral'} />
          <StatCard icon={Bell} label="Alerts" value={criticalAlerts} accent={criticalAlerts > 0 ? 'danger' : 'success'} />
          <StatCard icon={AlertTriangle} label="Tamper" value={tamperActive ? '!' : 'OK'} accent={tamperActive ? 'danger' : 'success'} />
        </div>
      )}

      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary-light" />
            Active Smart Boxes
          </h3>
        </div>
        <div className="flex gap-2 flex-wrap">
          {devices.map((device) => {
            const hasAlert = device.tamper_status || device.shock_detected;
            const isSelected = selectedId === device.id;
            return (
              <button
                key={device.id}
                type="button"
                onClick={() => setSelectedId(device.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition border ${
                  isSelected
                    ? 'bg-primary/15 border-primary/30 text-primary-light'
                    : 'bg-surface border-border text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${device.is_online ? 'bg-success' : 'bg-slate-600'}`} />
                {device.name}
                {hasAlert && <Badge variant="danger">!</Badge>}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`grid grid-cols-1 ${compact ? 'xl:grid-cols-1' : 'xl:grid-cols-3'} gap-6`}>
        <div className={`${compact ? '' : 'xl:col-span-2'} glass-card rounded-xl p-1 overflow-hidden`}>
          <div className={`p-1 ${compact ? 'h-[360px]' : 'h-[520px]'}`}>
            <LiveMap devices={devices} selectedDevice={selectedDevice} gpsUpdates={gpsUpdates} />
          </div>
        </div>
        {!compact && (
          <DeviceControl
            device={selectedDevice}
            canControl={Boolean(selectedDevice?.can_control)}
            onUnlock={handleUnlock}
            onLock={handleLock}
            onToggleAlarm={handleToggleAlarm}
            loading={actionLoading}
          />
        )}
      </div>

      {showAlerts && !compact && (
        <AlertPanel alerts={alerts} onAcknowledge={handleAcknowledge} loading={actionLoading} />
      )}
    </div>
  );
}
