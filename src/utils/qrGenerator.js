const QRCode = require('qrcode');

const generateQR = async (data) => {
  try {
    return await QRCode.toDataURL(data);  // Trả về base64 URL
  } catch (err) {
    throw new Error('QR generation failed');
  }
};

module.exports = { generateQR };