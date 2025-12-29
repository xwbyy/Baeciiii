const express = require('express');
const router = express.Router();
const { sendNotification } = require('../utils/telegram');
const db = require('../utils/sheetsDb');

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

    // Send to Telegram Admin
    await sendNotification(message);

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

    res.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    console.error('API Notify Error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
