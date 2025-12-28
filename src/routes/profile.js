const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const db = require('../utils/sheetsDb');
const bcrypt = require('bcryptjs');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const users = await db.getUsers();
    const user = users.find(u => u.id === req.session.user.id);

    if (user) {
      req.session.user.balance = user.balance;
    }

    const notifications = await db.getNotifications(req.session.user.id).catch(() => []);

    res.render('profile', {
      title: 'Profil - Baeci Market',
      error: null,
      success: null,
      notifications: notifications.slice(-10).reverse()
    });
  } catch (error) {
    console.error('Profile Error:', error);
    res.render('profile', {
      title: 'Profil - Baeci Market',
      error: 'Gagal memuat profil',
      success: null,
      notifications: []
    });
  }
});

router.post('/notifications/read/:id', isAuthenticated, async (req, res) => {
  try {
    await db.markNotificationRead(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.json({ success: false });
  }
});

router.get('/transactions', isAuthenticated, async (req, res) => {
  try {
    const transactions = await db.getTransactions();
    const userTransactions = transactions
      .filter(t => t.userId === req.session.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render('transactions', {
      title: 'Riwayat Transaksi - Baeci Market',
      transactions: userTransactions
    });
  } catch (error) {
    console.error('Transactions Error:', error);
    res.render('transactions', {
      title: 'Riwayat Transaksi - Baeci Market',
      transactions: []
    });
  }
});

router.get('/orders', isAuthenticated, async (req, res) => {
  try {
    const orders = await db.getOrders();
    const products = await db.getProducts();
    const userOrders = orders
      .filter(o => o.userId === req.session.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(order => ({
        ...order,
        product: order.productType === 'product' ? products.find(p => p.id === order.productId) : null
      }));

    res.render('orders', {
      title: 'Pesanan Saya - Baeci Market',
      orders: userOrders
    });
  } catch (error) {
    console.error('Orders Error:', error);
    res.render('orders', {
      title: 'Pesanan Saya - Baeci Market',
      orders: []
    });
  }
});

router.post('/update', isAuthenticated, async (req, res) => {
  try {
    const { phone, currentPassword, newPassword } = req.body;
    const users = await db.getUsers();
    const user = users.find(u => u.id === req.session.user.id);

    if (!user) {
      return res.json({ success: false, message: 'User tidak ditemukan' });
    }

    if (phone) {
      await db.updateUser(user.id, { phone });
      req.session.user.phone = phone;
    }

    if (currentPassword && newPassword) {
      let isValidPassword = false;
      
      if (user.password.startsWith('$2')) {
        isValidPassword = await bcrypt.compare(currentPassword, user.password);
      } else {
        isValidPassword = user.password === currentPassword;
      }

      if (!isValidPassword) {
        return res.json({ success: false, message: 'Password saat ini salah' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.updateUser(user.id, { password: hashedPassword });
    }

    res.json({ success: true, message: 'Profil berhasil diperbarui' });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.json({ success: false, message: 'Gagal memperbarui profil' });
  }
});

module.exports = router;
