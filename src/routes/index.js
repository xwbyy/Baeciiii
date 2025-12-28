const express = require('express');
const router = express.Router();
const db = require('../utils/sheetsDb');

router.get('/', async (req, res) => {
  try {
    const settings = await db.getSettings().catch(() => ({}));
    const products = await db.getProducts().catch(() => []);
    const servers = await db.getServers().catch(() => []);
    const orders = await db.getOrders().catch(() => []);

    const stats = {
      serverCount: servers.length > 0 ? servers.length * 100 : 500,
      customerCount: orders.length > 0 ? orders.length * 50 : 1000,
      uptime: '99.9%'
    };

    res.render('index', {
      title: 'Baeci Market - Marketplace Premium',
      settings,
      products: products.filter(p => p.isActive).slice(0, 6),
      servers: servers.filter(s => s.isActive),
      stats
    });
  } catch (error) {
    console.error('Index Error:', error);
    res.render('index', {
      title: 'Baeci Market - Marketplace Premium',
      settings: {},
      products: [],
      servers: [],
      stats: { serverCount: 500, customerCount: 1000, uptime: '99.9%' }
    });
  }
});

module.exports = router;
