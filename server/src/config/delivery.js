export const deliveryConfig = {
  currency: process.env.DELIVERY_CURRENCY || 'RWF',
  baseFare: parseFloat(process.env.DELIVERY_BASE_FARE || '2000'),
  ratePerKm: parseFloat(process.env.DELIVERY_RATE_PER_KM || '500'),
  minDistanceKm: parseFloat(process.env.DELIVERY_MIN_DISTANCE_KM || '1'),
  defaultDistanceKm: parseFloat(process.env.DELIVERY_DEFAULT_DISTANCE_KM || '5'),
  tokenExpiryHours: parseInt(process.env.UNLOCK_TOKEN_EXPIRY_HOURS || '48', 10),
  payment: {
    momoNumber: process.env.MOMO_PAY_NUMBER || '+250 791 691 817',
    momoName: process.env.MOMO_PAY_NAME || 'Smart Box Delivery',
    bankName: process.env.BANK_NAME || 'Bank of Kigali',
    bankAccount: process.env.BANK_ACCOUNT || '00000-0000000-00',
    bankAccountName: process.env.BANK_ACCOUNT_NAME || 'Smart Box Delivery Ltd',
  },
  whatsapp: {
    number: process.env.WHATSAPP_SUPPORT || '250791691817',
    display: process.env.WHATSAPP_DISPLAY || '+250 791 691 817',
  },
};
