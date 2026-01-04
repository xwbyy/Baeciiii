const express = require('express');
const router = express.Router();
const db = require('../utils/sheetsDb');

const digi = require('../utils/digiflazz');

// Digiflazz Routes
router.get('/digiflazz/products', async (req, res) => {
    try {
        const { category } = req.query;
        const result = await digi.getPriceList();
        
        // Digiflazz price-list returns { data: [...] }
        const rawData = result.data || result;
        
        if (rawData && Array.isArray(rawData)) {
            const settings = await db.getSettings();
            const profit = settings.digiflazz?.profit_percent || 10;
            
            // If we got a fallback from cache due to rate limit, result.data will be the array
            const finalData = Array.isArray(rawData) ? rawData : [];
            
            let filtered = finalData;
            if (category) {
                // Mapping category for Digiflazz compatibility
                const catLower = category.toLowerCase();
                
                filtered = finalData.filter(p => {
                    const prodCat = (p.category || '').toLowerCase();
                    
                    if (catLower === 'games' || catLower === 'game') {
                        // Exclude categories that are clearly not games (like Pulsa, PLN, etc)
                        // but included in 'Games' or 'Voucher' search results by Digiflazz
                        const isOperator = prodCat.includes('pulsa') || 
                                         prodCat.includes('data') || 
                                         prodCat.includes('internet') ||
                                         p.brand.toLowerCase().includes('axis') ||
                                         p.brand.toLowerCase().includes('telkom') ||
                                         p.brand.toLowerCase().includes('xl') ||
                                         p.brand.toLowerCase().includes('indosat') ||
                                         p.brand.toLowerCase().includes('smartfren') ||
                                         p.brand.toLowerCase().includes('tri');

                        if (isOperator) return false;
                        
                        return prodCat.includes('game') || prodCat.includes('voucher');
                    }
                    if (catLower === 'emoney' || catLower === 'e-money') {
                        return prodCat.includes('e-money') || prodCat.includes('saldo');
                    }
                    if (catLower === 'pln') {
                        return prodCat.includes('pln');
                    }
                    if (catLower === 'pulsa') {
                        return prodCat.includes('pulsa');
                    }
                    if (catLower === 'data') {
                        return prodCat.includes('data') || prodCat.includes('internet');
                    }
                    
                    return prodCat === catLower;
                });
            }
            
            const processed = filtered.map(p => ({
                ...p,
                user_price: digi.calculatePrice(p.price, profit)
            }));
            
            res.json({ success: true, data: processed });
        } else {
            console.error('Digiflazz PriceList Invalid Format:', result);
            res.json({ success: false, message: 'Gagal memuat produk Digiflazz: Format data tidak valid' });
        }
    } catch (error) {
        console.error('Digiflazz Product Route Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/digiflazz/topup', async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ success: false, message: 'Silakan login' });
        
        const { sku, customerNo, price } = req.body;
        const users = await db.getUsers();
        const user = users.find(u => u.id === req.session.user.id);
        
        if (user.balance < price) {
            return res.status(400).json({ success: false, message: 'Saldo tidak mencukupi' });
        }

        const refId = 'DIGI' + Date.now();
        const result = await digi.topup(refId, customerNo, sku);
        
        if (result.data) {
            const data = result.data;
            // Potong saldo jika tidak gagal langsung
            if (data.status !== 'Gagal') {
                await db.updateUserBalance(user.id, user.balance - price);
                
                // Jika statusnya 'Sukses' langsung dari API (biasanya inquiry/cek), set completed
                // Jika tidak, biarkan 'processing' menunggu callback
                const finalStatus = data.status === 'Sukses' ? 'completed' : 'processing';
                
                await db.addTransaction({
                    userId: user.id,
                    type: 'purchase',
                    amount: -price,
                    status: finalStatus,
                    description: `Topup ${data.buyer_sku_code} ke ${customerNo}`,
                    refId: refId
                });

                await db.addOrder({
                    userId: user.id,
                    username: user.username,
                    productType: 'Digital',
                    productId: refId,
                    productName: `${data.buyer_sku_code} - ${customerNo}`,
                    totalPrice: price,
                    status: finalStatus
                });
            }
            res.json({ success: data.status !== 'Gagal', data: data, message: data.message });
        } else {
            res.json({ success: false, message: 'Gagal memproses transaksi' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const otpApi = require('../utils/otp');

// OTP Routes
router.get('/otp/services', async (req, res) => {
    try {
        const result = await otpApi.getServices();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/otp/countries', async (req, res) => {
    try {
        const { service_id } = req.query;
        const result = await otpApi.getCountries(service_id);
        
        if (result.success) {
            const settings = await db.getSettings();
            const profit = settings.otp?.profit_percent || 10;
            
            result.data = result.data.map(country => ({
                ...country,
                pricelist: country.pricelist.map(price => ({
                    ...price,
                    user_price: otpApi.calculatePrice(price.price, profit)
                }))
            }));
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/otp/operators', async (req, res) => {
    try {
        const { country, provider_id } = req.query;
        const result = await otpApi.getOperators(country, provider_id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/otp/order', async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ success: false, message: 'Silakan login' });
        
        const { number_id, provider_id, operator_id, price } = req.body;
        
        // Check balance
        const users = await db.getUsers();
        const user = users.find(u => u.id === req.session.user.id);
        
        if (user.balance < price) {
            return res.status(400).json({ success: false, message: 'Saldo tidak mencukupi' });
        }

        const result = await otpApi.createOrder(number_id, provider_id, operator_id);
        
        if (result.success) {
            // Deduct balance
            await db.updateUserBalance(user.id, user.balance - price);
            
            // Add transaction
            await db.addTransaction({
                userId: user.id,
                type: 'purchase',
                amount: -price,
                status: 'completed',
                description: `Beli OTP ${result.data.service} (${result.data.phone_number})`,
                refId: result.data.order_id
            });

            // Add order
            await db.addOrder({
                userId: user.id,
                username: user.username,
                productType: 'OTP',
                productId: result.data.order_id,
                productName: `${result.data.service} - ${result.data.phone_number}`,
                totalPrice: price,
                status: 'processing'
            });
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/otp/status/:order_id', async (req, res) => {
    try {
        const status = await otpApi.getStatus(req.params.order_id);
        res.json(status);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/otp/set-status', async (req, res) => {
    try {
        const { order_id, status } = req.body;
        const result = await otpApi.setStatus(order_id, status);
        
        if (result.success && status === 'cancel') {
            // Refund balance if canceled
            const orders = await db.getOrders();
            const order = orders.find(o => o.productId === order_id);
            if (order && order.status !== 'cancelled') {
                const users = await db.getUsers();
                const user = users.find(u => u.id === order.userId);
                await db.updateUserBalance(user.id, user.balance + order.totalPrice);
                await db.updateOrder(order.id, { status: 'cancelled' });
                
                await db.addTransaction({
                    userId: user.id,
                    type: 'refund',
                    amount: order.totalPrice,
                    status: 'completed',
                    description: `Refund OTP ${order.productName}`,
                    refId: order_id
                });
            }
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * API Notification Route
 * Handle various system notifications and trigger telegram alerts
 */
router.post('/notify', async (req, res) => {
  const { type, data } = req.body;
  
  if (!type || !data) {
    return res.status(400).json({ success: false, message: 'Missing type or data' });
  }

  let message = '';
  
  try {
    switch (type) {
      case 'new_user':
        message = `👤 <b>User Baru Terdaftar!</b>\n` +
                  `━━━━━━━━━━━━━━━━━━\n` +
                  `📛 Nama: ${data.username}\n` +
                  `📧 Email: ${data.email}\n` +
                  `📅 Waktu: ${new Date().toLocaleString('id-ID')}`;
        break;

      case 'new_order':
        message = `🛒 <b>Order Baru Masuk!</b>\n` +
                  `━━━━━━━━━━━━━━━━━━\n` +
                  `👤 User: ${data.username}\n` +
                  `📦 Produk: ${data.productName}\n` +
                  `💰 Harga: Rp ${data.price.toLocaleString('id-ID')}\n` +
                  `💳 Metode: ${data.paymentMethod || 'Saldo'}\n` +
                  `📅 Waktu: ${new Date().toLocaleString('id-ID')}`;
        break;

      case 'server_buy':
        message = `🚀 <b>Pembelian Server Baru!</b>\n` +
                  `━━━━━━━━━━━━━━━━━━\n` +
                  `👤 User: ${data.username}\n` +
                  `🖥 Plan: ${data.planName}\n` +
                  `💰 Harga: Rp ${data.price.toLocaleString('id-ID')}\n` +
                  `⏳ Durasi: ${data.duration}\n` +
                  `📅 Waktu: ${new Date().toLocaleString('id-ID')}`;
        break;

      case 'deposit_request':
        message = `💸 <b>Permintaan Deposit!</b>\n` +
                  `━━━━━━━━━━━━━━━━━━\n` +
                  `👤 User: ${data.username}\n` +
                  `💰 Jumlah: Rp ${data.amount.toLocaleString('id-ID')}\n` +
                  `💳 Metode: ${data.method}\n` +
                  `📅 Waktu: ${new Date().toLocaleString('id-ID')}`;
        break;

      case 'deposit_success':
        message = `✅ <b>Deposit Berhasil!</b>\n` +
                  `━━━━━━━━━━━━━━━━━━\n` +
                  `👤 User: ${data.username}\n` +
                  `💰 Jumlah: Rp ${data.amount.toLocaleString('id-ID')}\n` +
                  `💹 Saldo Akhir: Rp ${data.newBalance.toLocaleString('id-ID')}\n` +
                  `📅 Waktu: ${new Date().toLocaleString('id-ID')}`;
        break;

      default:
        message = `📢 <b>Notifikasi Sistem</b>\n` +
                  `━━━━━━━━━━━━━━━━━━\n` +
                  `📝 Info: ${data.message || 'No details'}`;
    }

    // Optional: Save to internal notifications log in sheets/db
    if (data.userId) {
      await db.addNotification({
        userId: data.userId,
        title: type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        message: message.replace(/<[^>]*>/g, ''), // Strip HTML for internal log
        type: type,
        createdAt: new Date().toISOString()
      }).catch(err => console.error('Failed to log notification to DB:', err));
    }

    res.json({ success: true, message: 'Notification logged' });
  } catch (error) {
    console.error('API Notify Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * TokoPay Callback Webhook
 * Handle asynchronous payment notifications
 */
router.post('/webhook/tokopay', async (req, res) => {
    try {
        const { merchant_id, ref_id, status, amount, signature } = req.body;
        const settings = await db.getSettings();
        const tokopaySettings = settings.tokopay || {};
        
        // Basic verification (can be improved with HMAC if provided by TokoPay docs)
        if (merchant_id !== tokopaySettings.merchant_id) {
            return res.status(403).json({ status: 'error', message: 'Invalid merchant' });
        }

        if (status === 'Paid' || status === 'Success') {
            const transactions = await db.getTransactions();
            const transaction = transactions.find(t => t.refId === ref_id);

            if (transaction && transaction.status === 'pending') {
                await db.updateTransaction(transaction.id, { status: 'completed' });

                const users = await db.getUsers();
                const user = users.find(u => u.id === transaction.userId);
                
                if (user) {
                    const newBalance = user.balance + transaction.amount;
                    await db.updateUserBalance(user.id, newBalance);

                    // Notify public activity
                    const domain = process.env.DOMAIN || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
                    const axios = require('axios');
                    await axios.post(`${domain}/api/notify`, {
                        type: 'deposit_success',
                        data: {
                            userId: user.id,
                            username: user.username,
                            amount: transaction.amount,
                            newBalance: newBalance
                        }
                    }).catch(err => console.error('Webhook notify error:', err.message));
                }
            }
        }

        res.json({ status: 'ok' });
    } catch (error) {
        console.error('TokoPay Webhook Error:', error);
        res.status(500).json({ status: 'error' });
    }
});

/**
 * Public Activity API
 * Returns latest activities/notifications in JSON format
 */
router.get('/notify', async (req, res) => {
  try {
    const notifications = await db.getNotifications();
    // Sort by latest and limit to 50
    const latest = notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)
      .map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        createdAt: n.createdAt
      }));

    res.json({
      success: true,
      total: latest.length,
      data: latest
    });
  } catch (error) {
    console.error('GET API Notify Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
