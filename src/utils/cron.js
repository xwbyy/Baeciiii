const cron = require('node-cron');
const db = require('./sheetsDb');
const telegram = require('./telegram');
const pterodactyl = require('./pterodactyl');

const initCron = () => {
  // Every hour check for expired servers
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Checking expired orders...');
    try {
      const orders = await db.getOrders();
      const now = new Date();

      for (const order of orders) {
        if (order.productType === 'server' && order.status === 'completed' && order.serverDetails) {
          try {
            const details = JSON.parse(order.serverDetails);
            // Calculate expiry based on duration stored in serverDetails
            let durationDays = 30; // Default
            if (details.duration) {
              const daysMatch = details.duration.match(/(\d+)\s*Hari/i);
              const monthsMatch = details.duration.match(/(\d+)\s*Bulan/i);
              const yearsMatch = details.duration.match(/(\d+)\s*Tahun/i);
              
              if (daysMatch) durationDays = parseInt(daysMatch[1]);
              else if (monthsMatch) durationDays = parseInt(monthsMatch[1]) * 30;
              else if (yearsMatch) durationDays = parseInt(yearsMatch[1]) * 365;
            }

            const expiryDate = new Date(createdAt.getTime() + (durationDays * 24 * 60 * 60 * 1000));
            const timeDiff = expiryDate.getTime() - now.getTime();
            const daysRemaining = Math.ceil(timeDiff / (24 * 60 * 60 * 1000));

            if (now > expiryDate) {
              console.log(`[CRON] Order ${order.id} expired. Deleting server...`);
              
              if (details.panelServerId) {
                await pterodactyl.deleteServer(details.panelServerId).catch(err => console.error('Failed to delete panel server:', err.message));
              }
              if (details.panelUserId) {
                await pterodactyl.deleteUser(details.panelUserId).catch(err => console.error('Failed to delete panel user:', err.message));
              }

              await db.updateOrder(order.id, { status: 'expired' });
              
              await telegram.sendNotification(`🚨 <b>Server Expired</b>\nOrder ID: ${order.id}\nUser: ${order.username}\nAction: Auto-deleted`);
              
              // Notifikasi ke Dashboard User (Sudah Expired)
              await db.addNotification({
                userId: order.userId,
                title: 'Server Telah Kadaluarsa',
                message: `Server Anda (${order.productName}) telah berakhir dan dihapus secara otomatis. Silakan hubungi admin jika ingin berlangganan kembali.`,
                type: 'danger'
              });
            } else if (daysRemaining <= 3) {
              // Notifikasi H-3, H-2, H-1
              const notifiedKey = `notified_expiry_${order.id}_day_${daysRemaining}`;
              const settings = await db.getSettings();
              
              if (!settings[notifiedKey]) {
                const message = daysRemaining > 0 
                  ? `Server Anda (${order.productName}) akan berakhir dalam ${daysRemaining} hari lagi. Segera perpanjang agar data tetap aman!`
                  : `Server Anda (${order.productName}) akan berakhir hari ini! Segera perpanjang sebelum dihapus otomatis.`;

                await telegram.sendNotification(`⚠️ <b>Server Expiring Soon</b>\nOrder ID: ${order.id}\nUser: ${order.username}\nExpires in: ${daysRemaining} day(s).`);
                
                // Notifikasi ke Dashboard User
                await db.addNotification({
                  userId: order.userId,
                  title: 'Peringatan Kadaluarsa',
                  message: message,
                  type: 'warning'
                });

                await db.updateSetting(notifiedKey, 'true');
              }
            }
          } catch (e) {
            console.error(`Error processing order ${order.id}:`, e.message);
          }
        }
      }
    } catch (error) {
      console.error('[CRON ERROR]', error);
    }
  });

  // System health check every 30 mins
  cron.schedule('*/30 * * * *', async () => {
    const stats = telegram.getSystemStats();
    console.log('[CRON] System Health Check');
  });

  // Daily Backup to Telegram Admin (00:00)
  cron.schedule('0 0 * * *', async () => {
    try {
      const users = await db.getUsers();
      const settings = await db.getSettings();
      const backupMsg = `💾 <b>Daily Backup Summary</b>\nTotal Users: ${users.length}\nSite Name: ${settings.siteName || 'N/A'}\nTime: ${new Date().toLocaleString('id-ID')}`;
      await telegram.sendNotification(backupMsg);
    } catch (e) {
      console.error('[BACKUP ERROR]', e);
    }
  });
};

module.exports = { initCron };
