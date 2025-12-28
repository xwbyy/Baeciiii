const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const { getPaymentMethods, createOrder, checkOrderStatus } = require('../utils/tokopay');
const db = require('../utils/sheetsDb');

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const paymentMethods = await getPaymentMethods();
    
    res.render('deposit', {
      title: 'Deposit Saldo - Baeci Market',
      paymentMethods,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Deposit Page Error:', error);
    res.render('deposit', {
      title: 'Deposit Saldo - Baeci Market',
      paymentMethods: [],
      error: 'Gagal memuat metode pembayaran',
      success: null
    });
  }
});

router.post('/create', isAuthenticated, async (req, res) => {
  try {
    const { amount, method } = req.body;
    const nominal = parseInt(amount);

    if (nominal < 1000) {
      return res.json({ success: false, message: 'Minimal deposit Rp 1.000' });
    }

    if (nominal > 10000000) {
      return res.json({ success: false, message: 'Maksimal deposit Rp 10.000.000' });
    }

    const refId = `DEP${Date.now()}${req.session.user.id.slice(-4)}`;

    const orderResult = await createOrder(refId, nominal, method);

    if (orderResult.status !== 'Success') {
      return res.json({ success: false, message: 'Gagal membuat order pembayaran' });
    }

    await db.addTransaction({
      userId: req.session.user.id,
      type: 'deposit',
      amount: nominal,
      status: 'pending',
      description: `Deposit via ${method}`,
      paymentMethod: method,
      refId
    });

    res.json({
      success: true,
      data: {
        refId,
        payUrl: orderResult.data.pay_url,
        totalBayar: orderResult.data.total_bayar,
        qrLink: orderResult.data.qr_link,
        qrString: orderResult.data.qr_string,
        trxId: orderResult.data.trx_id
      }
    });
  } catch (error) {
    console.error('Create Deposit Error:', error);
    res.json({ success: false, message: 'Terjadi kesalahan saat membuat deposit' });
  }
});

router.get('/check/:refId', isAuthenticated, async (req, res) => {
  try {
    const { refId } = req.params;
    const transactions = await db.getTransactions();
    const transaction = transactions.find(t => t.refId === refId && t.userId === req.session.user.id);

    if (!transaction) {
      return res.json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    if (transaction.status === 'completed') {
      const users = await db.getUsers();
      const user = users.find(u => u.id === req.session.user.id);
      return res.json({ 
        success: true, 
        status: 'Paid', 
        message: 'Deposit sudah berhasil',
        newBalance: user?.balance || req.session.user.balance
      });
    }

    console.log('Checking TokoPay status for refId:', refId);
    const statusResult = await checkOrderStatus(refId, transaction.amount, transaction.paymentMethod);
    console.log('TokoPay Response:', JSON.stringify(statusResult, null, 2));

    const paymentStatus = statusResult.data?.status;
    console.log('Payment status from TokoPay:', paymentStatus);

    if (paymentStatus === 'Paid' || paymentStatus === 'Success') {
      await db.updateTransaction(transaction.id, { status: 'completed' });

      const users = await db.getUsers();
      const user = users.find(u => u.id === req.session.user.id);
      
      if (user) {
        const newBalance = (user.balance || 0) + transaction.amount;
        await db.updateUserBalance(user.id, newBalance);
        req.session.user.balance = newBalance;
        console.log('Balance updated to:', newBalance);
      }

      return res.json({ 
        success: true, 
        status: 'Paid', 
        message: 'Deposit berhasil!',
        newBalance: req.session.user.balance
      });
    }

    res.json({ 
      success: true, 
      status: paymentStatus || 'Unpaid',
      message: 'Menunggu pembayaran'
    });
  } catch (error) {
    console.error('Check Deposit Error:', error);
    res.json({ success: false, status: 'Error', message: 'Gagal mengecek status deposit' });
  }
});

router.post('/cancel/:refId', isAuthenticated, async (req, res) => {
  try {
    const { refId } = req.params;
    const transactions = await db.getTransactions();
    const transaction = transactions.find(t => t.refId === refId && t.userId === req.session.user.id);

    if (!transaction) {
      return res.json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    if (transaction.status !== 'pending') {
      return res.json({ success: false, message: 'Transaksi tidak dapat dibatalkan' });
    }

    await db.updateTransaction(transaction.id, { status: 'cancelled' });
    res.json({ success: true, message: 'Deposit berhasil dibatalkan' });
  } catch (error) {
    console.error('Cancel Deposit Error:', error);
    res.json({ success: false, message: 'Gagal membatalkan deposit' });
  }
});

router.post('/callback', async (req, res) => {
  try {
    const { ref_id, status } = req.body;

    if (status === 'Paid') {
      const transactions = await db.getTransactions();
      const transaction = transactions.find(t => t.refId === ref_id);

      if (transaction && transaction.status === 'pending') {
        await db.updateTransaction(transaction.id, { status: 'completed' });

        const users = await db.getUsers();
        const user = users.find(u => u.id === transaction.userId);
        
        if (user) {
          const newBalance = user.balance + transaction.amount;
          await db.updateUserBalance(user.id, newBalance);
        }
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Callback Error:', error);
    res.json({ status: 'error' });
  }
});

module.exports = router;
