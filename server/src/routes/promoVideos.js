import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate, requireApproved, requireManager } from '../middleware/auth.js';
import {
  promoVideoUpload,
  publicVideoUrl,
  mimeFromUrl,
  deleteLocalVideoFile,
} from '../middleware/promoUpload.js';

const router = Router();

async function stopAllInSection(section) {
  await supabase
    .from('promo_videos')
    .update({ is_playing: false, updated_at: new Date().toISOString() })
    .eq('section', section)
    .eq('is_playing', true);
}

router.get('/public/:section', async (req, res) => {
  const section = req.params.section || 'roles';

  const { data, error } = await supabase
    .from('promo_videos')
    .select('id, title, description, video_url, poster_url, section, is_playing, sort_order')
    .eq('section', section)
    .eq('is_active', true)
    .eq('is_playing', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ videos: data || [] });
});

router.get('/', authenticate, requireApproved, requireManager, async (_req, res) => {
  const { data, error } = await supabase
    .from('promo_videos')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/upload', authenticate, requireApproved, requireManager, (req, res) => {
  promoVideoUpload.single('video')(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Video file is too large'
        : err.message;
      return res.status(400).json({ error: message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }

    res.status(201).json({
      url: publicVideoUrl(req.file.filename),
      filename: req.file.filename,
      mimeType: req.file.mimetype || mimeFromUrl(req.file.filename),
      size: req.file.size,
    });
  });
});

router.post('/', authenticate, requireApproved, requireManager, async (req, res) => {
  const { title, description, video_url, poster_url, section = 'roles', is_active = true } = req.body;

  if (!title?.trim() || !video_url?.trim()) {
    return res.status(400).json({ error: 'title and video_url are required' });
  }

  const { data, error } = await supabase
    .from('promo_videos')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      video_url: video_url.trim(),
      poster_url: poster_url?.trim() || null,
      section,
      is_active: Boolean(is_active),
      is_playing: false,
      created_by: req.user.id,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.patch('/:id', authenticate, requireApproved, requireManager, async (req, res) => {
  const { id } = req.params;
  const allowed = ['title', 'description', 'video_url', 'poster_url', 'section', 'is_active', 'is_playing', 'sort_order'];
  const updates = { updated_at: new Date().toISOString() };

  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (updates.video_url !== undefined) {
    const { data: existing } = await supabase.from('promo_videos').select('video_url').eq('id', id).single();
    if (existing?.video_url && existing.video_url !== updates.video_url) {
      deleteLocalVideoFile(existing.video_url);
    }
  }

  const { data, error } = await supabase
    .from('promo_videos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Video not found' });
  res.json(data);
});

router.post('/broadcast/stop', authenticate, requireApproved, requireManager, async (req, res) => {
  const section = req.body?.section || 'roles';
  await stopAllInSection(section);
  res.json({ success: true });
});

router.post('/:id/play', authenticate, requireApproved, requireManager, async (req, res) => {
  const { id } = req.params;

  const { data: row } = await supabase.from('promo_videos').select('*').eq('id', id).single();
  if (!row) return res.status(404).json({ error: 'Video not found' });

  const { data, error } = await supabase
    .from('promo_videos')
    .update({ is_playing: true, is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/stop', authenticate, requireApproved, requireManager, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('promo_videos')
    .update({ is_playing: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Video not found' });
  res.json(data);
});

router.delete('/:id', authenticate, requireApproved, requireManager, async (req, res) => {
  const { data: row } = await supabase.from('promo_videos').select('video_url').eq('id', req.params.id).single();
  const { error } = await supabase.from('promo_videos').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  if (row?.video_url) deleteLocalVideoFile(row.video_url);
  res.json({ success: true });
});

export default router;
