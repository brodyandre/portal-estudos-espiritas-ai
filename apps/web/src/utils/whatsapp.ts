const sanitizeWhatsappNumber = (value: string) => {
  return value.replace(/\D/g, "");
};

export const buildWhatsAppUrl = (phone: string, message: string) => {
  const normalizedPhone = sanitizeWhatsappNumber(phone);
  const encodedMessage = encodeURIComponent(message);

  if (!normalizedPhone) {
    return `https://wa.me/?text=${encodedMessage}`;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
};

export const getWhatsAppPhoneLabel = (phone: string) => {
  return sanitizeWhatsappNumber(phone);
};
