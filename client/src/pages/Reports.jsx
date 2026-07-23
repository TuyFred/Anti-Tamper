import { useEffect, useState, useCallback } from 'react';
import {
  FileText, Download, History, Loader2, BarChart3, RefreshCw, Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, downloadReportPdf } from '../lib/api';
import Badge from '../components/ui/Badge';
import {
  formatDeliveryDateTime, formatDeliveryRef, formatPrice, formatReportDateRange,
} from '../lib/deliveryUtils';

const REPORT_TYPES = [
  { id: 'deliveries', label: 'Deliveries summary', path: 'deliveries', desc: 'All deliveries with route, status, and amount for the selected period' },
  { id: 'financial', label: 'Financial report', path: 'financial', desc: 'Revenue, VAT breakdown, and paid deliveries for the selected period' },
  { id: 'activity', label: 'Activity audit log', path: 'activity', desc: 'Full history of system actions for the selected period' },
];

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export default function Reports() {
  const { token } = useAuth();
  const [range, setRange] = useState(defaultDateRange);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [generated, setGenerated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState('');

  const rangeLabel = formatReportDateRange(range);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [sum, hist, gen] = await Promise.all([
        api.getReportSummary(token, range),
        api.getActivityHistory(token, range),
        api.getGeneratedReports(token),
      ]);
      setSummary(sum);
      setHistory(hist);
      setGenerated(gen);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, range]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (path) => {
    setDownloading(path);
    setError('');
    try {
      await downloadReportPdf(token, path, range);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(null);
    }
  };

  const handleDeliveryPdf = async (deliveryId) => {
    setDownloading(`delivery-${deliveryId}`);
    try {
      await downloadReportPdf(token, `delivery/${deliveryId}`, range);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(null);
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary-light" />
            Reports &amp; History
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Audit trail and PDF exports for managers and admins (English)
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-lighter border border-border text-sm text-slate-300 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">{error}</div>
      )}

      {/* Active report period banner */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/25">
        <Calendar className="w-5 h-5 text-primary-light shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">Report period</p>
          <p className="text-sm text-primary-light/90 mt-0.5">{rangeLabel}</p>
          <p className="text-xs text-slate-500 mt-1">
            All stats, history, and PDF downloads use this date range. Each PDF includes the period and generation date.
          </p>
        </div>
      </div>

      {/* Date range picker */}
      <div className="flex flex-wrap items-end gap-3 p-4 rounded-2xl bg-surface-light border border-border">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Start date</label>
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-white text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">End date</label>
          <input
            type="date"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
        >
          Apply range
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Deliveries', value: summary.total_deliveries, icon: BarChart3 },
            { label: 'Revenue (incl. VAT)', value: formatPrice(summary.revenue_ttc), icon: FileText },
            { label: 'Activity events', value: summary.activity_events, icon: History },
            { label: 'Delivered', value: summary.by_status?.delivered || 0, icon: Download },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="p-4 rounded-2xl bg-surface-light border border-border">
              <Icon className="w-5 h-5 text-primary-light mb-2" />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">Generate PDF</h2>
        <p className="text-xs text-slate-500 mb-3">Period: {rangeLabel}</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {REPORT_TYPES.map((r) => (
            <div key={r.id} className="p-4 rounded-2xl bg-surface-light border border-border flex flex-col">
              <h3 className="font-semibold text-white text-sm">{r.label}</h3>
              <p className="text-xs text-slate-500 mt-1 flex-1">{r.desc}</p>
              <button
                type="button"
                disabled={downloading === r.path}
                onClick={() => handleDownload(r.path)}
                className="mt-3 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary/15 text-primary-light border border-primary/25 text-sm font-medium hover:bg-primary/25 disabled:opacity-50"
              >
                {downloading === r.path ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download PDF
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
          <History className="w-4 h-4" />
          Activity history
        </h2>
        <p className="text-xs text-slate-500 mb-3">Showing events from {rangeLabel}</p>
        <div className="rounded-2xl border border-border overflow-hidden">
          {history.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No activity in this period.</p>
          ) : (
            <ul className="divide-y divide-border max-h-[420px] overflow-y-auto">
              {history.map((e) => (
                <li key={e.id} className="px-4 py-3 hover:bg-surface-lighter/50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-white">
                        <Badge variant="neutral" className="mr-2 text-[10px]">{e.entity_type}</Badge>
                        {e.summary || e.action}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {e.actor?.full_name || e.actor?.email || 'System'}
                        {' · '}
                        {formatDeliveryDateTime(e.created_at)}
                      </p>
                    </div>
                    {e.entity_type === 'delivery' && e.entity_id && (
                      <button
                        type="button"
                        onClick={() => handleDeliveryPdf(e.entity_id)}
                        disabled={downloading === `delivery-${e.entity_id}`}
                        className="text-xs text-primary-light hover:underline shrink-0"
                      >
                        PDF
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Previously generated reports
        </h2>
        <div className="rounded-2xl border border-border overflow-hidden">
          {generated.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No PDF reports generated yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {generated.slice(0, 20).map((r) => (
                <li key={r.id} className="px-4 py-3 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-white">{r.title}</span>
                  <span className="text-slate-500 text-xs">
                    {r.generator?.full_name || '—'}
                    {' · '}
                    {formatDeliveryDateTime(r.created_at)}
                    {' · '}
                    {r.record_count} records
                    {r.filters?.from && r.filters?.to && (
                      <> · {formatReportDateRange(r.filters)}</>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
