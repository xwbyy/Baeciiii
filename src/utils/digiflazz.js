const axios = require('axios');
const crypto = require('crypto');
const db = require('./sheetsDb');

async function getDigiflazzConfig() {
    const settings = await db.getSettings();
    const config = settings.digiflazz || { username: '', dev_apikey: '', prod_apikey: '', mode: 'development', profit_percent: 10 };
    
    // Determine which key to use based on mode
    const apikey = config.mode === 'production' ? config.prod_apikey : config.dev_apikey;
    
    return {
        ...config,
        apikey: apikey || config.apikey // Fallback to old apikey field if new ones are empty
    };
}

let priceListCache = {
    data: null,
    timestamp: 0
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 jam untuk menghindari rate limit API pricelist

const digiflazz = {
    generateSign: (username, apikey, cmd) => {
        return crypto.createHash('md5').update(username + apikey + cmd).digest('hex');
    },

    getSaldo: async () => {
        const config = await getDigiflazzConfig();
        const sign = digiflazz.generateSign(config.username, config.apikey, 'depo');
        const response = await axios.post('https://api-proxy.baeci-host.xyz/v1/cek-saldo', {
            cmd: 'deposit',
            username: config.username,
            sign: sign
        });
        return response.data;
    },

    getPriceList: async (forceRefresh = false) => {
        const config = await getDigiflazzConfig();
        if (!config.username || !config.apikey) {
            console.warn('[Digiflazz] Username or API Key missing in settings');
            return priceListCache.data ? { data: priceListCache.data } : { data: [] };
        }

        const now = Date.now();
        // 1. Cek cache memori dulu (kecuali dipaksa refresh)
        if (!forceRefresh && priceListCache.data && (now - priceListCache.timestamp < CACHE_DURATION)) {
            console.log('[Digiflazz] Using memory cached price list');
            return { data: priceListCache.data };
        }

        // 2. Cek cache di Database (Google Sheets) jika memori kosong atau expired (kecuali dipaksa refresh)
        if (!forceRefresh) {
            try {
                const settings = await db.getSettings();
                if (settings.digiflazz_cache && settings.digiflazz_cache_time) {
                    const cacheTime = parseInt(settings.digiflazz_cache_time);
                    if (now - cacheTime < CACHE_DURATION) {
                        const rawCache = settings.digiflazz_cache;
                        const dataToCache = Array.isArray(rawCache) ? rawCache : (rawCache.data || []);
                        
                        if (dataToCache.length > 0) {
                            console.log('[Digiflazz] Using database cached price list');
                            priceListCache.data = dataToCache;
                            priceListCache.timestamp = cacheTime;
                            return { data: dataToCache };
                        }
                    }
                }
            } catch (e) {
                console.error('[Digiflazz] Failed to read DB cache:', e.message);
            }
        }

        console.log('[Digiflazz] Fetching fresh price list from API...');
        const sign = digiflazz.generateSign(config.username, config.apikey, 'pricelist');
        try {
            const response = await axios.post('https://api-proxy.baeci-host.xyz/v1/price-list', {
                cmd: 'prepaid',
                username: config.username,
                sign: sign
            }, { timeout: 15000 }); // Increase timeout slightly
            
            const responseData = response.data;
            const rawData = responseData.data || responseData;
            
            // Handle rate limit (rc 83)
            if (responseData.rc === '83' || (responseData.data && responseData.data.rc === '83')) {
                console.warn('[Digiflazz] Rate limited (rc 83), using cache if available');
                if (priceListCache.data) return { data: priceListCache.data };
                return { data: [] };
            }
            
            if (Array.isArray(rawData) && rawData.length > 0) {
                // Simpan ke memori
                priceListCache.data = rawData;
                priceListCache.timestamp = now;

                // Simpan ke Database (Background task agar tidak lambat)
                db.updateSetting('digiflazz_cache', rawData).catch(e => console.error('DB Cache update error:', e.message));
                db.updateSetting('digiflazz_cache_time', now.toString()).catch(e => console.error('DB Cache time update error:', e.message));

                return { data: rawData };
            }

            if (priceListCache.data) {
                return { data: priceListCache.data };
            }

            return { data: [] };
        } catch (error) {
            console.error('[Digiflazz] PriceList API Error:', error.message);
            if (priceListCache.data) {
                return { data: priceListCache.data };
            }
            return { data: [] };
        }
    },

    topup: async (refId, customerNo, productCode) => {
        const config = await getDigiflazzConfig();
        const username = String(config.username).trim();
        const apikey = String(config.apikey).trim();
        const ref_id = String(refId).trim();
        
        // Digiflazz Signature Formula for Transaction: md5(username + apikey + ref_id)
        const sign = crypto.createHash('md5').update(username + apikey + ref_id).digest('hex');
        
        const payload = {
            username: username,
            buyer_sku_code: String(productCode).trim(),
            customer_no: String(customerNo).trim(),
            ref_id: ref_id,
            sign: sign,
            cb_url: process.env.CALLBACK_URL || ''
        };
        
        // Only add inquiry if the product code ends with 'check' or 'cek'
        const lowerCode = String(productCode).toLowerCase();
        if (lowerCode.includes('check') || lowerCode.includes('cek')) {
            payload.inquiry = true;
        }

        console.log('[Digiflazz] Request Detail:', {
            url: 'https://api.digiflazz.com/v1/transaction',
            payload: { ...payload, sign: '***' }
        });
        
        try {
            const response = await axios.post('https://api-proxy.baeci-host.xyz/v1/transaction', payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            // Check for known error message about IP
            if (response.data && response.data.data && response.data.data.rc === '45') {
                console.error('[Digiflazz] IP Address Error detected (rc 45)');
            }
            
            return response.data;
        } catch (error) {
            console.error('[Digiflazz] Topup Error Response:', error.response?.data || error.message);
            // Check for signature error in error response if it's 400
            if (error.response && error.response.data && (error.response.data.message === 'Signature Anda salah' || (error.response.data.data && error.response.data.data.message === 'Signature Anda salah'))) {
                console.error('[Digiflazz] CRITICAL: Signature error detected. Verifying formula...');
            }
            if (error.response && error.response.status === 400) {
                const msg = error.response.data?.data?.message || error.response.data?.message || 'Bad Request (400)';
                throw new Error(`Digiflazz Error 400: ${msg}`);
            }
            throw error;
        }
    },

    calculatePrice: (basePrice, profitPercent) => {
        return Math.ceil(basePrice + (basePrice * (profitPercent / 100)));
    }
};

module.exports = digiflazz;
