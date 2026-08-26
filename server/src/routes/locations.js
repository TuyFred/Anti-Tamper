import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { reverseGeocodeFromOsm } from '../lib/geocode.js';

const router = Router();

/** GET /api/locations/rwanda — hierarchical admin divisions from DB */
router.get('/rwanda', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('rwanda_locations')
      .select('province, district, sector, cell, village, level')
      .order('province')
      .order('district')
      .order('sector')
      .order('cell')
      .order('village');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const provinces = [];
    const admin = {};

    for (const row of data || []) {
      if (row.level === 'province' && row.province) {
        if (!provinces.includes(row.province)) provinces.push(row.province);
        if (!admin[row.province]) admin[row.province] = {};
        continue;
      }
      if (!row.province || !row.district || !row.sector || !row.cell || !row.village) continue;

      if (!admin[row.province]) admin[row.province] = {};
      if (!admin[row.province][row.district]) admin[row.province][row.district] = {};
      if (!admin[row.province][row.district][row.sector]) {
        admin[row.province][row.district][row.sector] = {};
      }
      if (!admin[row.province][row.district][row.sector][row.cell]) {
        admin[row.province][row.district][row.sector][row.cell] = [];
      }
      const list = admin[row.province][row.district][row.sector][row.cell];
      if (!list.includes(row.village)) list.push(row.village);
    }

    if (provinces.length === 0) {
      for (const p of Object.keys(admin)) {
        if (!provinces.includes(p)) provinces.push(p);
      }
    }

    res.json({ provinces: provinces.sort(), admin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/locations/reverse?lat=&lng= — street + Rwanda admin divisions (English) */
router.get('/reverse', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng required' });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const address = await reverseGeocodeFromOsm(lat, lng);
    res.json({ lat, lng, ...address });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Geocode failed' });
  }
});

export default router;
