const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const db = require('../utils/sheetsDb');

router.get('/', async (req, res) => {
  try {
    const products = await db.getProducts();
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    
    res.render('products', {
      title: 'Produk - Baeci Market',
      products: products.filter(p => p.isActive),
      categories,
      selectedCategory: req.query.category || null
    });
  } catch (error) {
    console.error('Products Error:', error);
    res.render('products', {
      title: 'Produk - Baeci Market',
      products: [],
      categories: [],
      selectedCategory: null
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const products = await db.getProducts();
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) {
      return res.redirect('/products');
    }

    res.render('product-detail', {
      title: `${product.name} - Baeci Market`,
      product
    });
  } catch (error) {
    console.error('Product Detail Error:', error);
    res.redirect('/products');
  }
});

router.post('/buy/:id', isAuthenticated, async (req, res) => {
  try {
    const { quantity, voucherCode } = req.body;
    const qty = parseInt(quantity) || 1;

    const products = await db.getProducts();
    const product = products.find(p => p.id === req.params.id);
    
    if (!product) {
      return res.json({ success: false, message: 'Produk tidak ditemukan' });
    }

    if (!product.isActive) {
      return res.json({ success: false, message: 'Produk tidak tersedia' });
    }

    if (product.stock < qty) {
      return res.json({ success: false, message: 'Stok tidak mencukupi' });
    }

    const totalPriceBase = product.price * qty;
    let totalPrice = totalPriceBase;
    let voucher = null;

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

    const users = await db.getUsers();
    const user = users.find(u => u.id === req.session.user.id);
    
    if (!user) {
      return res.json({ success: false, message: 'User tidak ditemukan' });
    }

    if (user.balance < totalPrice) {
      return res.json({ 
        success: false, 
        message: `Saldo tidak cukup. Dibutuhkan Rp ${totalPrice.toLocaleString('id-ID')}` 
      });
    }

    const newBalance = user.balance - totalPrice;
    await db.updateUserBalance(user.id, newBalance);

    if (voucher) {
      await db.updateVoucher(voucher.id, { usedCount: voucher.usedCount + 1 });
    }

    const newStock = product.stock - qty;
    await db.updateProduct(product.id, { stock: newStock });

    const orderId = await db.addOrder({
      userId: user.id,
      username: user.username,
      productType: 'product',
      productId: product.id,
      productName: product.name,
      quantity: qty,
      totalPrice,
      status: 'completed'
    });

    await db.addTransaction({
      userId: user.id,
      type: 'purchase',
      amount: -totalPrice,
      status: 'completed',
      description: `Pembelian ${product.name} x${qty}${voucher ? ' (Voucher: ' + voucher.code + ')' : ''}`,
      productId: orderId
    });

    req.session.user.balance = newBalance;

    res.json({ 
      success: true, 
      message: 'Pembelian berhasil!',
      orderId,
      newBalance
    });
  } catch (error) {
    console.error('Product Purchase Error:', error);
    res.json({ success: false, message: 'Terjadi kesalahan saat pembelian' });
  }
});

module.exports = router;
