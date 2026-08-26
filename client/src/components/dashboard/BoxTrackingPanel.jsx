import { useEffect, useState } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../lib/api';
import { mergeDeviceWithGps } from '../../lib/geocode';
import { formatLockStatusLabel } from '../../lib/deliveryUtils';
import { useDeliveriesCache } from '../../hooks/useDeliveriesCache';
import { useFleetLocationSubscribe } from '../../hooks/useFleetLocationSubscribe';
import LiveMap from '../LiveMap';
import FleetMap from '../FleetMap';
import DeviceControl from '../DeviceControl';
export default function BoxTrackingPanel({ compact = false }) {
  const { token, isCustomer, isRider, isManager } = useAuth();
  const canControlDevices = isManager;
  const {
    devices,
    setInitialDevices,
    setDevices,
    gpsUpdates,
    fleetLocations = {},
  } = useSocket();
  const { deliveries } = useDeliveriesCache();
  useFleetLocationSubscribe(isManager);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const deviceList = await api.getDevices(token);
        setInitialDevices(deviceList);
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
  }, [token, setInitialDevices, refreshKey]);

  const selectedDevice = mergeDeviceWithGps(
    devices.find((d) => d.id === selectedId) || devices[0],
    gpsUpdates,
  );
  const canManageDevices = isManager;

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

      <div className={`grid grid-cols-1 ${compact ? 'xl:grid-cols-1' : 'xl:grid-cols-3'} gap-6`}>
        <div className={`${compact ? '' : 'xl:col-span-2'} glass-card rounded-xl p-1 overflow-hidden`}>
          <div className={`${compact ? 'tracking-map-height-compact' : 'tracking-map-height tracking-map-height--large'} p-0 overflow-hidden rounded-xl`}>
            {isManager ? (
              <FleetMap
                devices={devices}
                gpsUpdates={gpsUpdates}
                fleetLocations={fleetLocations}
                deliveries={deliveries}
                selectedDeviceId={selectedId}
                onSelectDevice={setSelectedId}
              />
            ) : (
              <LiveMap devices={devices} selectedDevice={selectedDevice} gpsUpdates={gpsUpdates} large />
            )}
          </div>
        </div>
        {!compact && (
          canManageDevices ? (
            <div className="space-y-4">
              <div className="glass-card rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">All boxes</p>
                {devices.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
                      selectedId === d.id
                        ? 'border-primary/40 bg-primary/10 text-white'
                        : 'border-border bg-surface text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="font-mono text-primary-light">{d.device_id}</span>
                    <span className="block text-xs text-slate-500">{formatLockStatusLabel(d.lock_status)}</span>
                  </button>
                ))}
              </div>
              <DeviceControl
                device={selectedDevice}
                canControl={canControlDevices || Boolean(selectedDevice?.can_control)}
                onUnlock={handleUnlock}
                onLock={handleLock}
                onToggleAlarm={handleToggleAlarm}
                loading={actionLoading}
              />
            </div>
          ) : (
            <div className="glass-card rounded-xl p-5 space-y-3 h-full">
              {selectedDevice && (
                <div className="rounded-xl border border-border bg-surface p-3 space-y-1 text-sm text-slate-400">
                  <p className="font-mono text-sm text-primary-light">{selectedDevice.device_id}</p>
                  <p className="font-medium text-white">{selectedDevice.name}</p>
                  <p>Status: <span className="text-slate-200">{selectedDevice.is_online ? 'Online' : 'Offline'}</span></p>
                  <p>Box: <span className="text-slate-200">{formatLockStatusLabel(selectedDevice.lock_status)}</span></p>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
