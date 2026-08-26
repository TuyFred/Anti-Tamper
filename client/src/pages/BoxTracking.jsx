import { Link } from 'react-router-dom';
import BoxTrackingPanel from '../components/dashboard/BoxTrackingPanel';
import { Radio, Wifi, LocateFixed, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { MAP_LABELS } from '../lib/mapConfig';

export default function BoxTracking() {
  const { connected, fleetLocations } = useSocket();
  const { isManager } = useAuth();
  const liveUsers = Object.keys(fleetLocations || {}).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary-light" />
            {isManager ? 'Fleet live map' : 'Live tracking'}
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <LocateFixed className="w-3.5 h-3.5 text-cyan-400" />
            {isManager
              ? 'See all boxes, riders, and customers with real GPS on one map.'
              : MAP_LABELS.enableLocationHint}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isManager && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-primary/10 text-primary-light border-primary/25">
              <Users className="w-3.5 h-3.5" />
              {liveUsers} live GPS
            </span>
          )}
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
            connected
              ? 'bg-success/10 text-success border-success/25'
              : 'bg-surface-lighter text-slate-500 border-border'
          }`}>
            <Wifi className={`w-3.5 h-3.5 ${connected ? 'animate-pulse' : ''}`} />
            {connected ? 'Live link' : 'Offline'}
          </span>
          {!isManager && (
            <Link
              to="/deliveries"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/15 text-primary-light border border-primary/25 hover:bg-primary/25 transition"
            >
              My deliveries
            </Link>
          )}
          {isManager && (
            <Link
              to="/operations"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/15 text-primary-light border border-primary/25 hover:bg-primary/25 transition"
            >
              Operations
            </Link>
          )}
        </div>
      </div>

      <BoxTrackingPanel />
    </div>
  );
}
