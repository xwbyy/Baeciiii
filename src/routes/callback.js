const express = require('express');
const router = express.Router();
const db = require('../utils/sheetsDb');

router.post('/callback/digiflazz', async (req, res) => {
    try {
        const { data } = req.body;
        console.log('[Digiflazz Callback] Received:', JSON.stringify(data, null, 2));

        if (!data || !data.ref_id) {
            return res.status(400).send('Invalid data');
        }

        const orders = await db.getOrders();
        const order = orders.find(o => o.productId === data.ref_id);

        if (order) {
            const statusMapping = {
                'Sukses': 'completed',
                'Gagal': 'cancelled',
                'Pending': 'processing'
            };

            const newStatus = statusMapping[data.status] || 'processing';
            
            if (order.status !== newStatus) {
                await db.updateOrder(order.id, { status: newStatus });
                
                // Update transaction status too
                const transactions = await db.getTransactions();
                const trans = transactions.find(t => t.refId === data.ref_id);
                if (trans) {
                    await db.updateTransaction(trans.id, { status: newStatus === 'completed' ? 'completed' : (newStatus === 'cancelled' ? 'failed' : 'processing') });
                }

                // If Gagal, refund balance
                if (data.status === 'Gagal') {
                    const users = await db.getUsers();
                    const user = users.find(u => u.id === order.userId);
                    if (user) {
                        await db.updateUserBalance(user.id, user.balance + order.totalPrice);
                        await db.addTransaction({
                            userId: user.id,
                            type: 'refund',
                            amount: order.totalPrice,
                            status: 'completed',
                            description: `Refund Gagal: ${order.productName}`,
                            refId: 'REF' + data.ref_id
                        });
                    }
                }

                // Notification for user
                await db.addNotification({
                    userId: order.userId,
                    title: `Status Pesanan: ${data.status}`,
                    message: `Pesanan ${order.productName} Anda sekarang berstatus ${data.status}. SN: ${data.sn || '-'}`,
                    type: data.status === 'Sukses' ? 'success' : (data.status === 'Gagal' ? 'danger' : 'warning')
                });
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('[Digiflazz Callback Error]:', error);
        res.status(500).send('Error');
    }
});

module.exports = router;
