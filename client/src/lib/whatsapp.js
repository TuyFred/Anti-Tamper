export const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '250791691817';
export const WHATSAPP_DISPLAY = import.meta.env.VITE_WHATSAPP_DISPLAY || '+250 791 691 817';

export const WHATSAPP_BUSINESS_MESSAGE = `Hello Smart Box Delivery Team,

I would like information about your secure delivery service. I am interested in sending official documents, legal papers, medical items, or other parcels through your anti-tamper Smart Box system in Rwanda.

Could you please help me with:
• How to register and request a delivery
• Pricing and payment options (MoMo / bank transfer)
• Service areas and estimated delivery times
• Confidential or high-security shipments

Thank you.`;

export function whatsappUrl(number = WHATSAPP_NUMBER, message = WHATSAPP_BUSINESS_MESSAGE) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
