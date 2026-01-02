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
    const { serverId, serverName, duration, referralCode, location } = req.body;
    
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
      '1day': 0.05,
      '3day': 0.15,
      '7day': 0.35,
      '15day': 0.65,
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

    // Get Ram, Disk, CPU from name if not set in DB - Muuclin Format
    let ram = server.ram;
    let disk = server.disk;
    let cpu = server.cpu;

    if (!ram || !disk || !cpu) {
      const plan = server.name.toLowerCase();
      if (plan.includes('1gb')) { ram = 1000; disk = 1000; cpu = 40; }
      else if (plan.includes('2gb')) { ram = 2000; disk = 1000; cpu = 60; }
      else if (plan.includes('3gb')) { ram = 3000; disk = 2000; cpu = 80; }
      else if (plan.includes('4gb')) { ram = 4000; disk = 2000; cpu = 100; }
      else if (plan.includes('5gb')) { ram = 5000; disk = 3000; cpu = 120; }
      else if (plan.includes('6gb')) { ram = 6000; disk = 3000; cpu = 140; }
      else if (plan.includes('7gb')) { ram = 7000; disk = 4000; cpu = 160; }
      else if (plan.includes('8gb')) { ram = 8000; disk = 4000; cpu = 180; }
      else if (plan.includes('9gb')) { ram = 9000; disk = 5000; cpu = 200; }
      else if (plan.includes('10gb')) { ram = 10000; disk = 5000; cpu = 220; }
      else if (plan.includes('unli') || plan.includes('unlimited')) { ram = 0; disk = 0; cpu = 0; }
    }

    const ramValue = parseInt(ram) === 0 ? 0 : parseInt(ram);
    const diskValue = parseInt(disk) === 0 ? 0 : parseInt(disk);
    const cpuValue = parseInt(cpu);
    
    // Setup Pterodactyl variables (untuk panel server)
    let panelUser = null, panelServer = null, panelPassword = null;
    let panelUserPassword = null;
    const settings = await db.getSettings() || {};

    try {
      console.log('Creating server with specs (Muuclin):', { ram: ramValue, disk: diskValue, cpu: cpuValue });
      
      // Create panel user jika Pterodactyl tersedia
      if (pterodactyl && settings.panel?.domain) {
        const panelUsername = `${user.username}-${Date.now()}`;
        panelPassword = Math.random().toString(36).substring(2, 12);
        const userResult = await pterodactyl.createUser(panelUsername, user.username);
        panelUser = userResult.user || userResult;
        panelUserPassword = userResult.password || panelPassword;
        
        panelServer = await pterodactyl.createServer({
          name: serverName || `${user.username} Server`,
          userId: panelUser.id,
          ram: ramValue,
          disk: diskValue,
          cpu: cpuValue
        });
        console.log('Server created successfully:', panelServer.id);
      } else {
        console.log('Pterodactyl panel tidak tersedia, melanjutkan tanpa panel');
      }
    } catch (error) {
      console.error('Error creating server on Pterodactyl:', error);
      // Try to cleanup the user if server creation fails
      if (panelUser) {
        try {
          await pterodactyl.deleteUser(panelUser.id);
          console.log('Cleaned up panel user after server creation failure');
        } catch (cleanupError) {
          console.error('Failed to cleanup panel user:', cleanupError);
        }
      }
      return res.json({ 
        success: false, 
        message: 'Gagal membuat server: ' + (error.message || 'Unknown error')
      });
    }

    const newBalance = user.balance - totalPrice;
    await db.updateUserBalance(user.id, newBalance);

    const durationText = {
      '1day': '1 Hari',
      '3day': '3 Hari',
      '7day': '7 Hari',
      '15day': '15 Hari',
      '1month': '1 Bulan',
      '3month': '3 Bulan',
      '6month': '6 Bulan',
      '1year': '1 Tahun'
    };

    const orderDetails = {
      ram: parseInt(ram),
      cpu: parseInt(cpu),
      disk: parseInt(disk),
      location: location || 'Singapore',
      duration: durationText[duration] || '1 Bulan'
    };
    
    if (panelUser && panelUser.id) {
      orderDetails.panelUserId = panelUser.id;
      orderDetails.panelServerId = panelServer?.id;
      orderDetails.panelUsername = panelUser.username || `${user.username}-${Date.now()}`;
      orderDetails.panelPassword = panelUserPassword;
      orderDetails.panelUrl = settings.panel?.domain;
    }

    const orderId = await db.addOrder({
      userId: user.id,
      username: user.username,
      productType: 'server',
      productId: serverId,
      productName: serverName || server.name,
      totalPrice,
      status: 'completed',
      serverDetails: orderDetails
    });

    await db.addTransaction({
      userId: user.id,
      type: 'purchase',
      amount: -totalPrice,
      status: 'completed',
      description: `Pembelian server ${serverName || server.name} - ${parseInt(ram)}MB RAM, ${parseInt(cpu)} CPU`,
      productId: orderId
    });

    req.session.user.balance = newBalance;

    res.json({ 
      success: true, 
      message: 'Server berhasil dibuat!',
      orderId,
      newBalance,
      serverCredentials: panelUser ? {
        username: panelUser.username,
        password: panelPassword,
        loginUrl: settings.panel?.domain
      } : null
    });
  } catch (error) {
    console.error('Purchase Error:', error);
    res.json({ success: false, message: 'Terjadi kesalahan: ' + error.message });
  }
});

module.exports = router;
