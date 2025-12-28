const axios = require('axios');
const crypto = require('crypto');
const db = require('./sheetsDb');

const API_BASE = 'https://api.tokopay.id/v1';

async function getCredentials() {
  const settings = await db.getSettings();
  return {
    merchantId: settings.tokopay?.merchant_id || '',
    secretKey: settings.tokopay?.secret_key || ''
  };
}

function generateSignature(merchantId, secretKey) {
  return crypto.createHash('md5').update(merchantId + secretKey).digest('hex');
}

async function getPaymentMethods() {
  return [
    { code: 'QRIS', name: 'QRIS (All E-Wallet)', fee: '0.7%', min: 1000 },
    { code: 'DANA', name: 'DANA', fee: '1.5%', min: 1000 },
    { code: 'OVO', name: 'OVO', fee: '2%', min: 10000 },
    { code: 'GOPAY', name: 'GoPay', fee: '2%', min: 1000 },
    { code: 'SHOPEEPAY', name: 'ShopeePay', fee: '1.5%', min: 1000 },
    { code: 'LINKAJA', name: 'LinkAja', fee: '1.5%', min: 1000 },
    { code: 'BRIVA', name: 'BRI Virtual Account', fee: 'Rp 1.000', min: 10000 },
    { code: 'BCAVA', name: 'BCA Virtual Account', fee: 'Rp 1.500', min: 10000 },
    { code: 'BNIVA', name: 'BNI Virtual Account', fee: 'Rp 1.000', min: 10000 },
    { code: 'MANDIRIVA', name: 'Mandiri Virtual Account', fee: 'Rp 1.000', min: 10000 }
  ];
}

async function createOrder(refId, nominal, method) {
  try {
    const { merchantId, secretKey } = await getCredentials();
    
    if (!merchantId || !secretKey) {
      throw new Error('TokoPay belum dikonfigurasi');
    }
    
    const url = `${API_BASE}/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${refId}&nominal=${nominal}&metode=${method}`;
    
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('TokoPay Error:', error.response?.data || error.message);
    throw new Error('Gagal membuat order pembayaran');
  }
}

async function checkOrderStatus(refId, nominal, method) {
  try {
    const { merchantId, secretKey } = await getCredentials();
    
    if (!merchantId || !secretKey) {
      throw new Error('TokoPay belum dikonfigurasi');
    }
    
    const url = `${API_BASE}/order?merchant=${merchantId}&secret=${secretKey}&ref_id=${refId}&nominal=${nominal}&metode=${method}`;
    
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('TokoPay Status Error:', error.response?.data || error.message);
    throw new Error('Gagal mengecek status order');
  }
}

async function getMerchantBalance() {
  try {
    const { merchantId, secretKey } = await getCredentials();
    
    if (!merchantId || !secretKey) {
      return null;
    }
    
    const signature = generateSignature(merchantId, secretKey);
    const url = `${API_BASE}/merchant/balance?merchant=${merchantId}&signature=${signature}`;
    
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('TokoPay Balance Error:', error.response?.data || error.message);
    return null;
  }
}

module.exports = {
  getPaymentMethods,
  createOrder,
  checkOrderStatus,
  getMerchantBalance,
  getCredentials
};
