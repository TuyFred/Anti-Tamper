import { useEffect, useState, useMemo } from 'react';
import {
  Video, Plus, Play, Square, Pencil, Trash2, Loader2, Upload, Megaphone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import Badge from './ui/Badge';
import Modal from './ui/Modal';
import PromoVideoPreview from './PromoVideoPreview';

const EMPTY_FORM = {
  title: '',
  description: '',
  video_url: '',
  poster_url: '',
  section: 'roles',
  is_active: true,
};

export default function PromoVideoManager() {
  const { token } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [uploadLabel, setUploadLabel] = useState('');
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);

  const load = async () => {
    try {
      setVideos(await api.getPromoVideos(token));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [token]);

  useEffect(() => {
    if (!videoFile) {
      setFilePreviewUrl(null);
      return undefined;
    }
    const blob = URL.createObjectURL(videoFile);
    setFilePreviewUrl(blob);
    return () => URL.revokeObjectURL(blob);
  }, [videoFile]);

  const modalPreviewUrl = useMemo(() => {
    if (filePreviewUrl) return filePreviewUrl;
    return form.video_url?.trim() || null;
  }, [filePreviewUrl, form.video_url]);

  const liveCount = videos.filter((v) => v.is_playing).length;

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setVideoFile(null);
    setUploadLabel('');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (v) => {
    setEditId(v.id);
    setForm({
      title: v.title,
      description: v.description || '',
      video_url: v.video_url,
      poster_url: v.poster_url || '',
      section: v.section || 'roles',
      is_active: v.is_active,
    });
    setVideoFile(null);
    setUploadLabel('');
    setError('');
    setModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setUploadLabel(file.name);
    setForm((f) => ({ ...f, video_url: '' }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setBusy('save');
    setError('');
    try {
      let payload = { ...form };
      if (videoFile) {
        const uploaded = await api.uploadPromoVideo(token, videoFile);
        payload = { ...payload, video_url: uploaded.url };
      }
      if (!payload.video_url?.trim()) {
        throw new Error('Upload a video file or paste a URL');
      }
      if (editId) {
        await api.updatePromoVideo(token, editId, payload);
      } else {
        await api.createPromoVideo(token, payload);
      }
      setModalOpen(false);
      setVideoFile(null);
      setUploadLabel('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const handlePlay = async (id) => {
    setBusy(id);
    try {
      await api.playPromoVideo(token, id);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const handleStop = async (id) => {
    setBusy(id);
    try {
      await api.stopPromoVideo(token, id);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const handleStopAll = async () => {
    if (!liveCount || !confirm('Stop all ads on the homepage slideshow?')) return;
    setBusy('stop-all');
    try {
      await api.stopAllPromoVideos(token, 'roles');
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this promo video?')) return;
    setBusy(id);
    try {
      await api.deletePromoVideo(token, id);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-primary-light" />
            Homepage ad slideshow
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Upload 2+ videos and click <strong className="text-white">Add to slideshow</strong> on each.
            They rotate on the homepage until you stop them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {liveCount > 0 && (
            <button
              type="button"
              onClick={handleStopAll}
              disabled={busy === 'stop-all'}
              className="flex items-center gap-2 px-4 py-2.5 bg-danger/15 text-danger border border-danger/25 rounded-xl text-sm font-semibold"
            >
              {busy === 'stop-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              Stop all ({liveCount})
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            Add video
          </button>
        </div>
      </div>

      {liveCount > 0 && (
        <div className="glass-card rounded-xl p-4 flex items-center gap-3 border border-success/25 bg-success/5">
          <Megaphone className="w-5 h-5 text-success shrink-0" />
          <p className="text-sm text-slate-300">
            <strong className="text-white">{liveCount} video{liveCount > 1 ? 's' : ''}</strong> playing in the homepage slideshow — loops until you stop.
          </p>
        </div>
      )}

      {videos.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center text-slate-500 text-sm">
          No promo videos yet. Upload MP4, WebM, MOV… or paste a YouTube URL.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {videos.map((v) => (
            <div
              key={v.id}
              className={`glass-card rounded-xl overflow-hidden flex flex-col ${
                v.is_playing ? 'ring-2 ring-success/40 border-success/30' : ''
              }`}
            >
              <PromoVideoPreview url={v.video_url} poster={v.poster_url} className="w-full shrink-0" compact />
              <div className="p-5 flex flex-col flex-1 gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-white text-base">{v.title}</p>
                    {v.is_playing && <Badge variant="success">In slideshow</Badge>}
                    {!v.is_active && <Badge variant="neutral">Inactive</Badge>}
                  </div>
                  {v.description && (
                    <p className="text-sm text-slate-400 leading-relaxed">{v.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-border">
                  {v.is_playing ? (
                    <button
                      type="button"
                      onClick={() => handleStop(v.id)}
                      disabled={busy === v.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-danger/15 text-danger border border-danger/25 rounded-lg text-sm font-medium"
                    >
                      {busy === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                      Remove from slideshow
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePlay(v.id)}
                      disabled={busy === v.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-success/15 text-success border border-success/25 rounded-lg text-sm font-medium"
                    >
                      {busy === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Add to slideshow
                    </button>
                  )}
                  <button type="button" onClick={() => openEdit(v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-lighter text-sm">
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(v.id)}
                    disabled={busy === v.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 text-sm ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit promo video' : 'Add promo video'} wide>
        <form onSubmit={handleSave} className="space-y-4">
          {(modalPreviewUrl || videoFile) && (
            <div className="rounded-xl overflow-hidden border border-border">
              <p className="text-xs text-slate-500 px-3 py-2 bg-surface-lighter border-b border-border">Preview</p>
              <PromoVideoPreview
                url={filePreviewUrl ? null : form.video_url}
                blobUrl={filePreviewUrl}
                mimeType={videoFile?.type}
                poster={form.poster_url}
                compact
              />
            </div>
          )}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface rounded-xl border border-border text-white text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Show on</label>
            <select
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface rounded-xl border border-border text-white text-sm"
            >
              <option value="roles">Homepage — Roles promo slideshow</option>
              <option value="rider">Homepage — Motor rider section</option>
            </select>
            <p className="text-[10px] text-slate-500 mt-1">Upload on production (Render) so videos use HTTPS URLs.</p>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Upload video file</label>
            <label className="flex items-center gap-3 w-full px-4 py-3 bg-surface rounded-xl border border-dashed border-border text-sm text-slate-300 cursor-pointer hover:border-primary/50 hover:bg-surface-lighter transition">
              <Upload className="w-4 h-4 text-primary-light shrink-0" />
              <span className="truncate">{uploadLabel || 'Choose file — MP4, WebM, MOV… (max 200 MB)'}</span>
              <input
                type="file"
                accept="video/*,.mp4,.webm,.ogg,.mov,.avi,.mkv,.m4v,.wmv,.flv,.3gp,.mpg,.mpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="px-2 bg-surface text-slate-500">or paste URL</span></div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Video URL (MP4 direct or YouTube)</label>
            <input
              value={form.video_url}
              onChange={(e) => {
                setForm({ ...form, video_url: e.target.value });
                if (e.target.value) { setVideoFile(null); setUploadLabel(''); }
              }}
              placeholder="https://...mp4 or https://youtube.com/watch?v=..."
              className="w-full px-4 py-2.5 bg-surface rounded-xl border border-border text-white text-sm"
              disabled={Boolean(videoFile)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Poster image URL (optional)</label>
            <input
              value={form.poster_url}
              onChange={(e) => setForm({ ...form, poster_url: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface rounded-xl border border-border text-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface rounded-xl border border-border text-white text-sm min-h-[80px]"
            />
          </div>
          {error && <div className="p-3 bg-danger/10 border border-danger/25 rounded-xl text-sm text-danger">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-slate-400 text-sm">Cancel</button>
            <button type="submit" disabled={busy === 'save'} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {busy === 'save' && <Loader2 className="w-4 h-4 animate-spin" />}
              {editId ? 'Save changes' : 'Add video'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
