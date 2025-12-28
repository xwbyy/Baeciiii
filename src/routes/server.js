const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const db = require('../utils/sheetsDb');
const pterodactyl = require('../utils/pterodactyl');

router.get('/', async (req, res) => {
  try {
    const servers = await db.getServers();
    res.render('server', {
      title: 'Beli Server - Baeci Market',
      servers: servers.filter(s => s.isActive),
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Server List Error:', error);
    res.render('server', {
      title: 'Beli Server - Baeci Market',
      servers: [],
      error: 'Gagal memuat daftar server',
      success: null
    });
  }
});

router.get('/buy/:id', isAuthenticated, async (req, res) => {
  try {
    const servers = await db.getServers();
    const server = servers.find(s => s.id === req.params.id);
    
    if (!server) {
      return res.redirect('/server');
    }

    const users = await db.getUsers();
    const user = users.find(u => u.id === req.session.user.id);

    res.render('server-buy', {
      title: `Beli ${server.name} - Baeci Market`,
      server,
      userBalance: user?.balance || 0,
      error: null
    });
  } catch (error) {
    console.error('Server Buy Page Error:', error);
    res.redirect('/server');
  }
});

router.post('/purchase', isAuthenticated, async (req, res) => {
  try {
    const { serverId, serverName, duration, referralCode } = req.body;
    
    const servers = await db.getServers();
    const server = servers.find(s => s.id === serverId);
    
    if (!server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }

    const users = await db.getUsers();
    const user = users.find(u => u.id === req.session.user.id);
    
    if (!user) {
      return res.json({ success: false, message: 'User tidak ditemukan' });
    }

    const durationMultiplier = {
      '1month': 1,
      '3month': 3,
      '6month': 6,
      '1year': 12
    };

    const multiplier = durationMultiplier[duration] || 1;
    let totalPriceBase = server.price * multiplier;

    if (duration === '3month') totalPriceBase = Math.floor(totalPriceBase * 0.95);
    if (duration === '6month') totalPriceBase = Math.floor(totalPriceBase * 0.90);
    if (duration === '1year') totalPriceBase = Math.floor(totalPriceBase * 0.85);

    let totalPrice = totalPriceBase;
    let voucher = null;
    const { voucherCode } = req.body;

    if (voucherCode) {
      const vouchers = await db.getVouchers();
      voucher = vouchers.find(v => v.code === voucherCode.toUpperCase() && v.isActive);
      
      if (voucher) {
        if (totalPriceBase < voucher.minPurchase) {
          return res.json({ success: false, message: `Minimal pembelian Rp ${voucher.minPurchase.toLocaleString()} untuk voucher ini` });
        }
        if (voucher.usedCount >= voucher.maxUsage) {
          return res.json({ success: false, message: 'Voucher sudah habis digunakan' });
        }
        
        const discount = voucher.discountType === 'percent' 
          ? Math.floor(totalPriceBase * (voucher.discountValue / 100))
          : voucher.discountValue;
        
        totalPrice = Math.max(0, totalPriceBase - discount);
      } else {
        return res.json({ success: false, message: 'Voucher tidak valid atau sudah tidak aktif' });
      }
    }

    if (user.balance < totalPrice) {
      return res.json({ 
        success: false, 
        message: `Saldo tidak cukup. Dibutuhkan Rp ${totalPrice.toLocaleString('id-ID')}, saldo Anda Rp ${user.balance.toLocaleString('id-ID')}` 
      });
    }

    const settings = await db.getSettings();
    if (!settings.panel?.domain || !settings.panel?.apikey) {
      return res.json({ 
        success: false, 
        message: 'Panel belum dikonfigurasi. Hubungi admin.' 
      });
    }

    const panelUsername = (serverName || user.username).toLowerCase().replace(/[^a-z0-9]/g, '') + Date.now().toString().slice(-4);
    
    let panelUser, panelPassword, panelServer;
    
    try {
      console.log('Creating panel user:', panelUsername);
      const userResult = await pterodactyl.createUser(panelUsername, serverName || user.username);
      panelUser = userResult.user;
      panelPassword = userResult.password;
      console.log('Panel user created:', panelUser.id);
    } catch (error) {
      console.error('Error creating panel user:', error);
      return res.json({ 
        success: false, 
        message: 'Gagal membuat akun panel: ' + error.message 
      });
    }

    const ramValue = parseInt(server.ram) * 1000;
    const diskValue = parseInt(server.disk) * 1000;
    const cpuValue = parseInt(server.cpu);
    
    try {
      console.log('Creating server with specs:', { ram: ramValue, disk: diskValue, cpu: cpuValue });
      panelServer = await pterodactyl.createServer({
        name: serverName || `${user.username} Server`,
        userId: panelUser.id,
        ram: ramValue,
        disk: diskValue,
        cpu: cpuValue
      });
      console.log('Server created successfully:', panelServer.id);
    } catch (error) {
      console.error('Error creating server on Pterodactyl:', error);
      // Try to cleanup the user if server creation fails
      try {
        await pterodactyl.deleteUser(panelUser.id);
        console.log('Cleaned up panel user after server creation failure');
      } catch (cleanupError) {
        console.error('Failed to cleanup panel user:', cleanupError);
      }
      return res.json({ 
        success: false, 
        message: 'Gagal membuat server di panel: ' + (error.message || 'Unknown error')
      });
    }

    const newBalance = user.balance - totalPrice;
    await db.updateUserBalance(user.id, newBalance);

    const durationText = {
      '1month': '1 Bulan',
      '3month': '3 Bulan',
      '6month': '6 Bulan',
      '1year': '1 Tahun'
    };

    const orderId = await db.addOrder({
      userId: user.id,
      username: user.username,
      productType: 'server',
      productId: serverId,
      productName: serverName || server.name,
      totalPrice,
      status: 'completed',
      serverDetails: JSON.stringify({
        ram: server.ram,
        cpu: server.cpu,
        disk: server.disk,
        location: server.location,
        duration: durationText[duration] || '1 Bulan',
        panelUserId: panelUser.id,
        panelServerId: panelServer.id,
        panelUsername: panelUser.username,
        panelPassword: panelPassword,
        panelUrl: settings.panel.domain
      })
    });

    await db.addTransaction({
      userId: user.id,
      type: 'purchase',
      amount: -totalPrice,
      status: 'completed',
      description: `Pembelian server ${serverName || server.name}`,
      productId: orderId
    });

    req.session.user.balance = newBalance;

    res.json({ 
      success: true, 
      message: 'Server berhasil dibuat!',
      orderId,
      newBalance,
      serverCredentials: {
        username: panelUser.username,
        password: panelPassword,
        loginUrl: settings.panel.domain
      }
    });
  } catch (error) {
    console.error('Purchase Error:', error);
    res.json({ success: false, message: 'Terjadi kesalahan: ' + error.message });
  }
});

module.exports = router;
