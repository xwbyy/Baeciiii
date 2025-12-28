const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { isAdmin } = require('../middleware/auth');
const db = require('../utils/sheetsDb');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Hanya file gambar yang diizinkan'));
  }
});

router.get('/', isAdmin, async (req, res) => {
  try {
    const [users, products, servers, transactions, orders, settings] = await Promise.all([
      db.getUsers().catch(() => []),
      db.getProducts().catch(() => []),
      db.getServers().catch(() => []),
      db.getTransactions().catch(() => []),
      db.getOrders().catch(() => []),
      db.getSettings().catch(() => ({}))
    ]);

    const stats = {
      totalUsers: users.length,
      totalProducts: products.length,
      totalServers: servers.length,
      totalTransactions: transactions.length,
      totalOrders: orders.length,
      totalRevenue: transactions
        .filter(t => t.type === 'purchase' && t.status === 'completed')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0),
      totalDeposits: transactions
        .filter(t => t.type === 'deposit' && t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0)
    };

    res.render('admin', {
      title: 'Dashboard Admin - Baeci Market',
      stats,
      users,
      products,
      servers,
      transactions: transactions.slice(-50).reverse(),
      orders: orders.slice(-50).reverse(),
      settings
    });
  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    res.render('admin', {
      title: 'Dashboard Admin - Baeci Market',
      stats: {},
      users: [],
      products: [],
      servers: [],
      transactions: [],
      orders: [],
      settings: {}
    });
  }
});

router.post('/products/add-json', isAdmin, async (req, res) => {
  try {
    const { name, description, price, stock, category, image } = req.body;

    await db.addProduct({
      name,
      description,
      price: parseInt(price),
      stock: parseInt(stock),
      category,
      image: image || ''
    });

    res.json({ success: true, message: 'Produk berhasil ditambahkan' });
  } catch (error) {
    console.error('Add Product JSON Error:', error);
    res.json({ success: false, message: 'Gagal menambahkan produk' });
  }
});

router.post('/products/add', isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, stock, category } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : '';

    await db.addProduct({
      name,
      description,
      price: parseInt(price),
      stock: parseInt(stock),
      category,
      image
    });

    res.json({ success: true, message: 'Produk berhasil ditambahkan' });
  } catch (error) {
    console.error('Add Product Error:', error);
    res.json({ success: false, message: 'Gagal menambahkan produk' });
  }
});

router.post('/products/update/:id', isAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, stock, category, isActive } = req.body;
    const products = await db.getProducts();
    const product = products.find(p => p.id === req.params.id);

    if (!product) {
      return res.json({ success: false, message: 'Produk tidak ditemukan' });
    }

    const image = req.file ? `/uploads/${req.file.filename}` : product.image;

    await db.updateProduct(req.params.id, {
      name: name || product.name,
      description: description || product.description,
      price: parseInt(price) || product.price,
      stock: parseInt(stock) || product.stock,
      category: category || product.category,
      image,
      isActive: isActive === 'true'
    });

    res.json({ success: true, message: 'Produk berhasil diperbarui' });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.json({ success: false, message: 'Gagal memperbarui produk' });
  }
});

router.delete('/products/:id', isAdmin, async (req, res) => {
  try {
    await db.deleteProduct(req.params.id);
    res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error('Delete Product Error:', error);
    res.json({ success: false, message: 'Gagal menghapus produk' });
  }
});

router.post('/servers/add', isAdmin, async (req, res) => {
  try {
    const { name, ram, cpu, disk, price, location, duration, description } = req.body;

    await db.addServer({
      name,
      ram,
      cpu,
      disk,
      price: parseInt(price),
      location,
      duration,
      description
    });

    res.json({ success: true, message: 'Server berhasil ditambahkan' });
  } catch (error) {
    console.error('Add Server Error:', error);
    res.json({ success: false, message: 'Gagal menambahkan server' });
  }
});

router.post('/servers/update/:id', isAdmin, async (req, res) => {
  try {
    const { name, ram, cpu, disk, price, location, duration, isActive, description } = req.body;
    
    await db.updateServer(req.params.id, {
      name,
      ram,
      cpu,
      disk,
      price: parseInt(price),
      location,
      duration,
      isActive: isActive === 'true',
      description
    });

    res.json({ success: true, message: 'Server berhasil diperbarui' });
  } catch (error) {
    console.error('Update Server Error:', error);
    res.json({ success: false, message: 'Gagal memperbarui server' });
  }
});

router.delete('/servers/:id', isAdmin, async (req, res) => {
  try {
    await db.deleteServer(req.params.id);
    res.json({ success: true, message: 'Server berhasil dihapus' });
  } catch (error) {
    console.error('Delete Server Error:', error);
    res.json({ success: false, message: 'Gagal menghapus server' });
  }
});

router.post('/users/balance/:id', isAdmin, async (req, res) => {
  try {
    const { amount, action } = req.body;
    const users = await db.getUsers();
    const user = users.find(u => u.id === req.params.id);

    if (!user) {
      return res.json({ success: false, message: 'User tidak ditemukan' });
    }

    let newBalance = user.balance;
    if (action === 'add') {
      newBalance += parseInt(amount);
    } else if (action === 'subtract') {
      newBalance -= parseInt(amount);
      if (newBalance < 0) newBalance = 0;
    } else if (action === 'set') {
      newBalance = parseInt(amount);
    }

    await db.updateUserBalance(user.id, newBalance);
    res.json({ success: true, message: 'Saldo berhasil diperbarui', newBalance });
  } catch (error) {
    console.error('Update Balance Error:', error);
    res.json({ success: false, message: 'Gagal memperbarui saldo' });
  }
});

router.post('/users/role/:id', isAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    await db.updateUser(req.params.id, { role });
    res.json({ success: true, message: 'Role berhasil diperbarui' });
  } catch (error) {
    console.error('Update Role Error:', error);
    res.json({ success: false, message: 'Gagal memperbarui role' });
  }
});

router.delete('/users/:id', isAdmin, async (req, res) => {
  try {
    const users = await db.getUsers();
    const user = users.find(u => u.id === req.params.id);

    if (!user) {
      return res.json({ success: false, message: 'User tidak ditemukan' });
    }

    if (user.role === 'admin') {
      return res.json({ success: false, message: 'Tidak dapat menghapus admin' });
    }

    await db.deleteUser(req.params.id);
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.json({ success: false, message: 'Gagal menghapus user' });
  }
});

router.post('/users/password/:id', isAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const bcrypt = require('bcryptjs');
    
    if (!newPassword || newPassword.length < 6) {
      return res.json({ success: false, message: 'Password minimal 6 karakter' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.updateUser(req.params.id, { password: hashedPassword });
    
    res.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.json({ success: false, message: 'Gagal mengubah password' });
  }
});

router.get('/users/:id', isAdmin, async (req, res) => {
  try {
    const users = await db.getUsers();
    const user = users.find(u => u.id === req.params.id);
    
    if (!user) {
      return res.json({ success: false, message: 'User tidak ditemukan' });
    }
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        balance: user.balance,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get User Error:', error);
    res.json({ success: false, message: 'Gagal mengambil data user' });
  }
});

router.delete('/orders/:id', isAdmin, async (req, res) => {
  try {
    await db.deleteOrder(req.params.id);
    res.json({ success: true, message: 'Order berhasil dihapus' });
  } catch (error) {
    console.error('Delete Order Error:', error);
    res.json({ success: false, message: 'Gagal menghapus order' });
  }
});

router.delete('/transactions/:id', isAdmin, async (req, res) => {
  try {
    await db.deleteTransaction(req.params.id);
    res.json({ success: true, message: 'Transaksi berhasil dihapus' });
  } catch (error) {
    console.error('Delete Transaction Error:', error);
    res.json({ success: false, message: 'Gagal menghapus transaksi' });
  }
});

router.post('/transactions/status/:id', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await db.updateTransaction(req.params.id, { status });
    res.json({ success: true, message: 'Status transaksi berhasil diperbarui' });
  } catch (error) {
    console.error('Update Transaction Status Error:', error);
    res.json({ success: false, message: 'Gagal memperbarui status transaksi' });
  }
});

router.get('/products/:id', isAdmin, async (req, res) => {
  try {
    const products = await db.getProducts();
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) {
      return res.json({ success: false, message: 'Produk tidak ditemukan' });
    }
    
    res.json({ success: true, product });
  } catch (error) {
    console.error('Get Product Error:', error);
    res.json({ success: false, message: 'Gagal mengambil data produk' });
  }
});

router.get('/servers/:id', isAdmin, async (req, res) => {
  try {
    const servers = await db.getServers();
    const server = servers.find(s => s.id === req.params.id);
    
    if (!server) {
      return res.json({ success: false, message: 'Server tidak ditemukan' });
    }
    
    res.json({ success: true, server });
  } catch (error) {
    console.error('Get Server Error:', error);
    res.json({ success: false, message: 'Gagal mengambil data server' });
  }
});

router.post('/settings', isAdmin, async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await db.updateSetting(key, value);
    }

    res.json({ success: true, message: 'Pengaturan berhasil disimpan' });
  } catch (error) {
    console.error('Update Settings Error:', error);
    res.json({ success: false, message: 'Gagal menyimpan pengaturan' });
  }
});

router.post('/orders/status/:id', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    const updates = { status };
    if (status === 'completed') {
      updates.completedAt = new Date().toISOString();
    }

    await db.updateOrder(req.params.id, updates);
    res.json({ success: true, message: 'Status order berhasil diperbarui' });
  } catch (error) {
    console.error('Update Order Status Error:', error);
    res.json({ success: false, message: 'Gagal memperbarui status order' });
  }
});

router.post('/api/panel', isAdmin, async (req, res) => {
  try {
    const { domain, apikey, capikey, nestid, egg, loc } = req.body;
    
    await db.updateSetting('panel', {
      domain: domain || '',
      apikey: apikey || '',
      capikey: capikey || '',
      nestid: nestid || '5',
      egg: egg || '15',
      loc: loc || '1'
    });

    res.json({ success: true, message: 'Konfigurasi Panel berhasil disimpan' });
  } catch (error) {
    console.error('Update Panel Settings Error:', error);
    res.json({ success: false, message: 'Gagal menyimpan konfigurasi Panel' });
  }
});

router.get('/api/panel/test', isAdmin, async (req, res) => {
  try {
    const pterodactyl = require('../utils/pterodactyl');
    const result = await pterodactyl.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Test Panel Connection Error:', error);
    res.json({ success: false, message: error.message });
  }
});

router.post('/api/tokopay', isAdmin, async (req, res) => {
  try {
    const { merchant_id, secret_key } = req.body;
    
    await db.updateSetting('tokopay', {
      merchant_id: merchant_id || '',
      secret_key: secret_key || ''
    });

    res.json({ success: true, message: 'Konfigurasi TokoPay berhasil disimpan' });
  } catch (error) {
    console.error('Update TokoPay Settings Error:', error);
    res.json({ success: false, message: 'Gagal menyimpan konfigurasi TokoPay' });
  }
});

module.exports = router;
