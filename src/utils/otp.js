const axios = require('axios');
const db = require('./sheetsDb');

const OTP_BASE_URL = 'https://www.rumahotp.com/api';

async function getOtpConfig() {
    const settings = await db.getSettings();
    return settings.otp || { apikey: '', profit_percent: 10 };
}

const otpApi = {
    getServices: async () => {
        try {
            const config = await getOtpConfig();
            if (!config.apikey) {
                return { success: false, message: 'API Key belum dikonfigurasi di Admin' };
            }
            const response = await axios.get(`${OTP_BASE_URL}/v2/services`, {
                headers: { 
                    'x-apikey': config.apikey,
                    'Accept': 'application/json'
                }
            });
            
            // Berdasarkan dokumentasi success.json: 
            // { "success": true, "data": [...] } atau { "success": false, "data": {...} }
            // Tapi dokumen juga bilang "Response berhasil" bisa "success": false di contoh teks.
            // Kita prioritaskan keberadaan 'data' array.
            if (response.data && Array.isArray(response.data.data)) {
                return { success: true, data: response.data.data };
            }
            
            // Handle error case based on error.json
            if (response.data && response.data.success === false) {
                const errMsg = response.data.error?.message || response.data.message || 'Gagal memuat layanan';
                return { success: false, message: errMsg };
            }

            return { success: false, message: 'Format data RumahOTP tidak valid' };
        } catch (error) {
            console.error('getServices Error:', error.response?.data || error.message);
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || 'Gagal memuat layanan';
            return { success: false, message: errMsg };
        }
    },
    
    getCountries: async (serviceId) => {
        try {
            const config = await getOtpConfig();
            const response = await axios.get(`${OTP_BASE_URL}/v2/countries?service_id=${serviceId}`, {
                headers: { 
                    'x-apikey': config.apikey,
                    'Accept': 'application/json'
                }
            });
            
            if (response.data && Array.isArray(response.data.data)) {
                return { success: true, data: response.data.data };
            }
            
            if (response.data && response.data.success === false) {
                const errMsg = response.data.error?.message || response.data.message || 'Gagal memuat negara';
                return { success: false, message: errMsg };
            }

            return { success: false, message: 'Format data negara tidak valid' };
        } catch (error) {
            console.error('getCountries Error:', error.response?.data || error.message);
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || 'Gagal memuat negara';
            return { success: false, message: errMsg };
        }
    },

    getOperators: async (country, providerId) => {
        try {
            const config = await getOtpConfig();
            const response = await axios.get(`${OTP_BASE_URL}/v2/operators?country=${country}&provider_id=${providerId}`, {
                headers: { 
                    'x-apikey': config.apikey,
                    'Accept': 'application/json'
                }
            });
            
            // Dokumentasi operators-v2.json menggunakan "status": true bukan "success"
            const isSuccess = response.data.status === true || response.data.success === true;
            if (isSuccess && Array.isArray(response.data.data)) {
                return { success: true, data: response.data.data };
            }
            
            if (response.data && (response.data.success === false || response.data.status === false)) {
                const errMsg = response.data.error?.message || response.data.message || 'Gagal memuat operator';
                return { success: false, message: errMsg };
            }

            return { success: false, message: 'Format data operator tidak valid' };
        } catch (error) {
            console.error('getOperators Error:', error.response?.data || error.message);
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || 'Gagal memuat operator';
            return { success: false, message: errMsg };
        }
    },

    createOrder: async (numberId, providerId, operatorId) => {
        try {
            const config = await getOtpConfig();
            const response = await axios.get(`${OTP_BASE_URL}/v2/orders?number_id=${numberId}&provider_id=${providerId}&operator_id=${operatorId}`, {
                headers: { 
                    'x-apikey': config.apikey,
                    'Accept': 'application/json'
                }
            });
            
            if (response.data && response.data.success === true && response.data.data) {
                return { success: true, data: response.data.data };
            }
            
            const errMsg = response.data?.error?.message || response.data?.message || 'Gagal membuat pesanan';
            return { success: false, message: errMsg };
        } catch (error) {
            console.error('createOrder Error:', error.response?.data || error.message);
            const errMsg = error.response?.data?.error?.message || error.response?.data?.message || 'Gagal membuat pesanan';
            return { success: false, message: errMsg };
        }
    },

    getStatus: async (orderId) => {
        try {
            const config = await getOtpConfig();
            const response = await axios.get(`${OTP_BASE_URL}/v1/orders/get_status?order_id=${orderId}`, {
                headers: { 
                    'x-apikey': config.apikey,
                    'Accept': 'application/json'
                }
            });
            
            if (response.data && response.data.success === true && response.data.data) {
                return { success: true, data: response.data.data };
            }
            
            const errMsg = response.data?.error?.message || response.data?.message || 'Gagal mengecek status';
            return { success: false, message: errMsg };
        } catch (error) {
            console.error('getStatus Error:', error.response?.data || error.message);
            return { success: false, message: 'Gagal mengecek status' };
        }
    },

    setStatus: async (orderId, status) => {
        try {
            const config = await getOtpConfig();
            const response = await axios.get(`${OTP_BASE_URL}/v1/orders/set_status?order_id=${orderId}&status=${status}`, {
                headers: { 
                    'x-apikey': config.apikey,
                    'Accept': 'application/json'
                }
            });
            
            if (response.data && response.data.success === true && response.data.data) {
                return { success: true, data: response.data.data };
            }
            
            const errMsg = response.data?.error?.message || response.data?.message || 'Gagal mengatur status';
            return { success: false, message: errMsg };
        } catch (error) {
            console.error('setStatus Error:', error.response?.data || error.message);
            return { success: false, message: 'Gagal mengatur status' };
        }
    },

    calculatePrice: (basePrice, profitPercent) => {
        return Math.ceil(basePrice + (basePrice * (profitPercent / 100)));
    }
};

module.exports = otpApi;
