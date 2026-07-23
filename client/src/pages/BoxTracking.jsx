import BoxTrackingPanel from '../components/dashboard/BoxTrackingPanel';
import { Radio, Wifi } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function BoxTracking() {
  const { connected } = useSocket();

  return (
    <div className="space-y-5">
      <div className="glass-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/15 text-primary-light border border-primary/25">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm flex items-center gap-2">
              Live Smart Box tracking
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time GPS map with address lookup and truck route view
            </p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
          connected
            ? 'bg-success/10 text-success border-success/25'
            : 'bg-surface-lighter text-slate-500 border-border'
        }`}>
          <Wifi className="w-3.5 h-3.5" />
          {connected ? 'Connected — live updates' : 'Reconnecting…'}
        </div>
      </div>
      <BoxTrackingPanel />
    </div>
  );
}
