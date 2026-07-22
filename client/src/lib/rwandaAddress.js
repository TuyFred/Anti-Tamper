export const RWANDA_PROVINCES = [
  'City of Kigali',
  'Eastern Province',
  'Northern Province',
  'Southern Province',
  'Western Province',
];

export const PACKAGE_TYPES = [
  { value: 'documents', label: 'Official documents', desc: 'Contracts, certificates, IDs' },
  { value: 'legal', label: 'Legal papers', desc: 'Court files, notarized documents' },
  { value: 'medical', label: 'Medical / health', desc: 'Samples, prescriptions, reports' },
  { value: 'parcel', label: 'General parcel', desc: 'Small goods and packages' },
  { value: 'confidential', label: 'Confidential / secret', desc: 'Sealed, high-security content' },
  { value: 'other', label: 'Other', desc: 'Describe in instructions' },
];

export const EMPTY_RWANDA_ADDRESS = {
  province: 'City of Kigali',
  district: '',
  sector: '',
  cell: '',
  village: '',
  road: '',
  landmark: '',
};

export function formatRwandaAddress(addr) {
  if (!addr) return '';
  const parts = [
    addr.road && `Road ${addr.road}`,
    addr.village,
    addr.cell && `Cell ${addr.cell}`,
    addr.sector && `Sector ${addr.sector}`,
    addr.district && `District ${addr.district}`,
    addr.province,
    addr.landmark,
  ].filter(Boolean);
  return parts.join(', ');
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180)
    * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const KIGALI_CENTER = [-1.9403, 29.8739];
