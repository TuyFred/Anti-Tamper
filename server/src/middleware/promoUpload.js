import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { config } from '../config/supabase.js';
import { publicVideoUrl as buildPublicVideoUrl } from '../lib/videoUrl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../uploads/promo-videos');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'mkv', 'm4v', 'wmv', 'flv', '3gp', '3g2', 'mpg', 'mpeg',
]);

const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/x-m4v',
  'video/x-ms-wmv',
  'video/x-flv',
  'video/3gpp',
  'video/3gpp2',
  'video/mpeg',
  'application/octet-stream',
]);

export function mimeFromUrl(url) {
  if (!url) return 'video/mp4';
  const ext = url.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const map = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    ogv: 'video/ogg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    m4v: 'video/x-m4v',
    wmv: 'video/x-ms-wmv',
    flv: 'video/x-flv',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    mpg: 'video/mpeg',
    mpeg: 'video/mpeg',
  };
  return map[ext] || 'video/mp4';
}

export function publicVideoUrl(filename, req) {
  return buildPublicVideoUrl(filename, req);
}

function isAllowedVideo(file) {
  const ext = path.extname(file.originalname).slice(1).toLowerCase();
  if (VIDEO_EXTENSIONS.has(ext)) return true;
  if (VIDEO_MIMES.has(file.mimetype)) return true;
  return file.mimetype?.startsWith('video/');
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const safeBase = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40) || 'video';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    cb(null, `${safeBase}-${unique}${ext}`);
  },
});

export const promoVideoUpload = multer({
  storage,
  limits: { fileSize: config.upload.maxPromoVideoBytes },
  fileFilter: (_req, file, cb) => {
    if (isAllowedVideo(file)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported video format. Use MP4, WebM, MOV, or other common video types.'));
    }
  },
});

export function deleteLocalVideoFile(videoUrl) {
  if (!videoUrl || !videoUrl.includes('/uploads/promo-videos/')) return;

  try {
    const filename = path.basename(videoUrl.split('?')[0]);
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('Failed to delete promo video file:', err.message);
  }
}
