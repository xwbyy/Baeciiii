const { google } = require('googleapis');
const credentials = require('../credentials.json');

const SPREADSHEET_ID = credentials.google.spreadsheet_id;

const SHEETS = {
  users: { name: 'users', headers: ['id', 'username', 'email', 'password', 'phone', 'balance', 'role', 'createdAt', 'referralCode', 'referredBy'] },
  products: { name: 'products', headers: ['id', 'name', 'description', 'price', 'stock', 'category', 'image', 'isActive', 'createdAt', 'linkDown'] },
  servers: { name: 'servers', headers: ['id', 'name', 'ram', 'cpu', 'disk', 'price', 'location', 'duration', 'description', 'isActive'] },
  transactions: { name: 'transactions', headers: ['id', 'userId', 'type', 'amount', 'status', 'description', 'paymentMethod', 'refId', 'createdAt', 'productId'] },
  orders: { name: 'orders', headers: ['id', 'userId', 'username', 'productType', 'productId', 'productName', 'quantity', 'totalPrice', 'status', 'serverDetails', 'createdAt', 'completedAt'] },
  vouchers: { name: 'vouchers', headers: ['id', 'code', 'discountType', 'discountValue', 'minPurchase', 'maxUsage', 'usedCount', 'expiryDate', 'isActive'] },
  settings: { name: 'settings', headers: ['key', 'value'] },
  notifications: { name: 'notifications', headers: ['id', 'userId', 'title', 'message', 'isRead', 'type', 'createdAt'] }
};

let sheetsClient = null;

const cache = {
  users: { data: null, timestamp: 0 },
  products: { data: null, timestamp: 0 },
  servers: { data: null, timestamp: 0 },
  transactions: { data: null, timestamp: 0 },
  orders: { data: null, timestamp: 0 },
  vouchers: { data: null, timestamp: 0 },
  settings: { data: null, timestamp: 0 },
  notifications: { data: null, timestamp: 0 },
  sheetsChecked: false
};

const CACHE_TTL = 30000;

function invalidateCache(sheetName) {
  if (cache[sheetName]) {
    cache[sheetName].data = null;
    cache[sheetName].timestamp = 0;
  }
}

function isCacheValid(sheetName) {
  const c = cache[sheetName];
  return c && c.data !== null && (Date.now() - c.timestamp) < CACHE_TTL;
}

async function getClient() {
  if (sheetsClient) return sheetsClient;
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.google.client_email,
      private_key: credentials.google.private_key
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

async function ensureAllSheetsExist() {
  if (cache.sheetsChecked) return;
  
  const sheets = await getClient();
  
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);
    
    for (const [key, config] of Object.entries(SHEETS)) {
      if (!existingSheets.includes(config.name)) {
        try {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
              requests: [{
                addSheet: { properties: { title: config.name } }
              }]
            }
          });
          
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${config.name}!A1`,
            valueInputOption: 'RAW',
            resource: { values: [config.headers] }
          });
          
          console.log(`Sheet "${config.name}" created with headers`);
        } catch (e) {
          if (!e.message.includes('already exists')) {
            console.error(`Error creating sheet ${config.name}:`, e.message);
          }
        }
      }
    }
    
    cache.sheetsChecked = true;
    console.log('All sheets initialized');
  } catch (error) {
    console.error('Error initializing sheets:', error.message);
  }
}

async function initializeSheets() {
  await ensureAllSheetsExist();
}

async function getSheetData(sheetName) {
  if (isCacheValid(sheetName)) {
    return cache[sheetName].data;
  }
  
  const sheets = await getClient();
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`
    });
    
    const rows = response.data.values || [];
    if (rows.length <= 1) {
      cache[sheetName] = { data: [], timestamp: Date.now() };
      return [];
    }
    
    const headers = rows[0];
    const data = rows.slice(1).map((row, index) => {
      const obj = { rowIndex: index + 2 };
      headers.forEach((header, i) => {
        obj[header] = row[i] || '';
      });
      return obj;
    });
    
    cache[sheetName] = { data, timestamp: Date.now() };
    console.log(`\x1b[32m[DB SUCCESS]\x1b[0m Berhasil memuat ${data.length} data dari sheet: \x1b[36m${sheetName}\x1b[0m`);
    return data;
  } catch (error) {
    console.error(`\x1b[31m[DB ERROR]\x1b[0m Gagal membaca ${sheetName}:`, error.message);
    if (cache[sheetName].data) return cache[sheetName].data;
    return [];
  }
}

async function appendRow(sheetName, data, headers) {
  const sheets = await getClient();
  const row = headers.map(h => data[h] !== undefined ? String(data[h]) : '');
  
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:Z`,
      valueInputOption: 'RAW',
      resource: { values: [row] }
    });
    invalidateCache(sheetName);
    console.log(`\x1b[32m[DB INSERT]\x1b[0m Berhasil menambah baris baru di \x1b[36m${sheetName}\x1b[0m`);
    return true;
  } catch (error) {
    console.error(`\x1b[31m[DB ERROR]\x1b[0m Gagal menambah baris di ${sheetName}:`, error.message);
    return false;
  }
}

async function updateRow(sheetName, rowIndex, data, headers) {
  const sheets = await getClient();
  const row = headers.map(h => data[h] !== undefined ? String(data[h]) : '');
  
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${rowIndex}`,
      valueInputOption: 'RAW',
      resource: { values: [row] }
    });
    invalidateCache(sheetName);
    console.log(`\x1b[32m[DB UPDATE]\x1b[0m Berhasil memperbarui baris ${rowIndex} di \x1b[36m${sheetName}\x1b[0m`);
    return true;
  } catch (error) {
    console.error(`\x1b[31m[DB ERROR]\x1b[0m Gagal memperbarui ${sheetName} baris ${rowIndex}:`, error.message);
    return false;
  }
}

async function deleteRow(sheetName, rowIndex) {
  const sheets = await getClient();
  
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    
    if (!sheet) return false;
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex
            }
          }
        }]
      }
    });
    invalidateCache(sheetName);
    return true;
  } catch (error) {
    console.error(`Error deleting row from ${sheetName}:`, error.message);
    return false;
  }
}

async function getUsers() {
  await ensureAllSheetsExist();
  const users = await getSheetData('users');
  return users.map(u => ({
    ...u,
    balance: parseInt(u.balance) || 0
  }));
}

async function addUser(user) {
  const id = 'U' + Date.now();
  const newUser = {
    id,
    username: user.username,
    email: user.email,
    password: user.password,
    phone: user.phone || '',
    balance: user.balance || 0,
    role: user.role || 'user',
    createdAt: new Date().toISOString()
  };
  await appendRow('users', newUser, SHEETS.users.headers);
  return id;
}

async function updateUserBalance(userId, newBalance) {
  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return false;
  
  user.balance = newBalance;
  return await updateRow('users', user.rowIndex, user, SHEETS.users.headers);
}

async function updateUser(userId, updates) {
  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return false;
  
  const updated = { ...user, ...updates };
  return await updateRow('users', user.rowIndex, updated, SHEETS.users.headers);
}

async function deleteUser(userId) {
  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return false;
  return await deleteRow('users', user.rowIndex);
}

async function getProducts() {
  await ensureAllSheetsExist();
  const products = await getSheetData('products');
  return products.map(p => ({
    ...p,
    price: parseInt(p.price) || 0,
    stock: parseInt(p.stock) || 0,
    isActive: p.isActive !== 'false',
    downloadLink: p.linkDown || ''
  }));
}

async function addProduct(product) {
  const id = product.id || ('P' + Date.now());
  const newProduct = {
    id,
    name: product.name,
    description: product.description || '',
    price: parseInt(product.price),
    stock: parseInt(product.stock) || 0,
    category: product.category || '',
    image: product.image || '',
    isActive: 'true',
    createdAt: product.createdAt || new Date().toISOString(),
    linkDown: product.downloadLink || ''
  };
  await appendRow('products', newProduct, SHEETS.products.headers);
  return id;
}

async function updateProduct(productId, updates) {
  const products = await getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return false;
  
  const updated = { 
    ...product, 
    ...updates, 
    isActive: String(updates.isActive !== false),
    linkDown: updates.downloadLink !== undefined ? updates.downloadLink : product.linkDown
  };
  return await updateRow('products', product.rowIndex, updated, SHEETS.products.headers);
}

async function deleteProduct(productId) {
  const products = await getProducts();
  const product = products.find(p => p.id === productId);
  if (!product) return false;
  return await deleteRow('products', product.rowIndex);
}

async function getServers() {
  await ensureAllSheetsExist();
  const servers = await getSheetData('servers');
  return servers.map(s => ({
    ...s,
    price: parseInt(s.price) || 0,
    isActive: s.isActive !== 'false'
  }));
}

async function addServer(server) {
  const id = server.id || ('S' + Date.now());
  const newServer = {
    id,
    name: server.name,
    ram: server.ram,
    cpu: server.cpu,
    disk: server.disk,
    price: parseInt(server.price),
    location: server.location || '',
    duration: server.duration || '30 Hari',
    description: server.description || '',
    isActive: 'true'
  };
  await appendRow('servers', newServer, SHEETS.servers.headers);
  return id;
}

async function updateServer(serverId, updates) {
  const servers = await getServers();
  const server = servers.find(s => s.id === serverId);
  if (!server) return false;
  
  const updated = { ...server, ...updates, isActive: String(updates.isActive !== false) };
  return await updateRow('servers', server.rowIndex, updated, SHEETS.servers.headers);
}

async function deleteServer(serverId) {
  const servers = await getServers();
  const server = servers.find(s => s.id === serverId);
  if (!server) return false;
  return await deleteRow('servers', server.rowIndex);
}

async function getTransactions() {
  await ensureAllSheetsExist();
  const transactions = await getSheetData('transactions');
  return transactions.map(t => ({
    ...t,
    amount: parseInt(t.amount) || 0
  }));
}

async function addTransaction(transaction) {
  const id = 'T' + Date.now();
  const newTransaction = {
    id,
    userId: transaction.userId,
    type: transaction.type,
    amount: transaction.amount,
    status: transaction.status,
    description: transaction.description || '',
    paymentMethod: transaction.paymentMethod || '',
    refId: transaction.refId || '',
    createdAt: new Date().toISOString(),
    productId: transaction.productId || ''
  };
  await appendRow('transactions', newTransaction, SHEETS.transactions.headers);
  return id;
}

async function updateTransaction(transactionId, updates) {
  const transactions = await getTransactions();
  const transaction = transactions.find(t => t.id === transactionId);
  if (!transaction) return false;
  
  const updated = { ...transaction, ...updates };
  return await updateRow('transactions', transaction.rowIndex, updated, SHEETS.transactions.headers);
}

async function deleteTransaction(transactionId) {
  const transactions = await getTransactions();
  const transaction = transactions.find(t => t.id === transactionId);
  if (!transaction) return false;
  return await deleteRow('transactions', transaction.rowIndex);
}

async function getOrders() {
  await ensureAllSheetsExist();
  const orders = await getSheetData('orders');
  return orders.map(o => ({
    ...o,
    quantity: parseInt(o.quantity) || 1,
    totalPrice: parseInt(o.totalPrice) || 0
  }));
}

async function addOrder(order) {
  const id = 'O' + Date.now();
  const newOrder = {
    id,
    userId: order.userId,
    username: order.username,
    productType: order.productType,
    productId: order.productId,
    productName: order.productName,
    quantity: order.quantity || 1,
    totalPrice: order.totalPrice,
    status: order.status || 'pending',
    serverDetails: typeof order.serverDetails === 'object' ? JSON.stringify(order.serverDetails) : (order.serverDetails || ''),
    createdAt: new Date().toISOString(),
    completedAt: ''
  };
  await appendRow('orders', newOrder, SHEETS.orders.headers);
  return id;
}

async function updateOrder(orderId, updates) {
  const orders = await getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return false;
  
  if (updates.serverDetails && typeof updates.serverDetails === 'object') {
    updates.serverDetails = JSON.stringify(updates.serverDetails);
  }
  
  const updated = { ...order, ...updates };
  return await updateRow('orders', order.rowIndex, updated, SHEETS.orders.headers);
}

async function getVouchers() {
  await ensureAllSheetsExist();
  const vouchers = await getSheetData('vouchers');
  return vouchers.map(v => ({
    ...v,
    discountValue: parseInt(v.discountValue) || 0,
    minPurchase: parseInt(v.minPurchase) || 0,
    maxUsage: parseInt(v.maxUsage) || 0,
    usedCount: parseInt(v.usedCount) || 0,
    isActive: v.isActive !== 'false'
  }));
}

async function addVoucher(voucher) {
  const id = 'V' + Date.now();
  const newVoucher = {
    id,
    code: voucher.code.toUpperCase(),
    discountType: voucher.discountType || 'fixed',
    discountValue: parseInt(voucher.discountValue),
    minPurchase: parseInt(voucher.minPurchase) || 0,
    maxUsage: parseInt(voucher.maxUsage) || 0,
    usedCount: 0,
    expiryDate: voucher.expiryDate || '',
    isActive: 'true'
  };
  await appendRow('vouchers', newVoucher, SHEETS.vouchers.headers);
  return id;
}

async function updateVoucher(voucherId, updates) {
  const vouchers = await getVouchers();
  const voucher = vouchers.find(v => v.id === voucherId);
  if (!voucher) return false;
  const updated = { ...voucher, ...updates, isActive: String(updates.isActive !== false) };
  return await updateRow('vouchers', voucher.rowIndex, updated, SHEETS.vouchers.headers);
}

async function deleteVoucher(voucherId) {
  const vouchers = await getVouchers();
  const voucher = vouchers.find(v => v.id === voucherId);
  if (!voucher) return false;
  return await deleteRow('vouchers', voucher.rowIndex);
}

async function deleteOrder(orderId) {
  const orders = await getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return false;
  return await deleteRow('orders', order.rowIndex);
}

async function getSettings() {
  await ensureAllSheetsExist();
  
  if (isCacheValid('settings')) {
    return cache.settings.data;
  }
  
  const rows = await getSheetData('settings');
  
  const settings = {};
  rows.forEach(row => {
    try {
      settings[row.key] = JSON.parse(row.value);
    } catch {
      settings[row.key] = row.value;
    }
  });
  
  cache.settings.data = settings;
  cache.settings.timestamp = Date.now();
  
  return settings;
}

async function updateSetting(key, value) {
  const rows = await getSheetData('settings');
  const existing = rows.find(r => r.key === key);
  
  const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
  
  invalidateCache('settings');
  
  if (existing) {
    return await updateRow('settings', existing.rowIndex, { key, value: valueStr }, SHEETS.settings.headers);
  } else {
    return await appendRow('settings', { key, value: valueStr }, SHEETS.settings.headers);
  }
}

async function getNotifications(userId = null) {
  await ensureAllSheetsExist();
  const notifications = await getSheetData('notifications');
  if (userId) {
    return notifications.filter(n => n.userId === userId || n.userId === 'all');
  }
  return notifications;
}

async function addNotification(notification) {
  const id = 'N' + Date.now();
  const newNotification = {
    id,
    userId: notification.userId || 'all',
    title: notification.title,
    message: notification.message,
    isRead: 'false',
    type: notification.type || 'info',
    createdAt: new Date().toISOString()
  };
  await appendRow('notifications', newNotification, SHEETS.notifications.headers);
  return id;
}

async function markNotificationRead(notificationId) {
  const notifications = await getNotifications();
  const notification = notifications.find(n => n.id === notificationId);
  if (!notification) return false;
  
  const updated = { ...notification, isRead: 'true' };
  return await updateRow('notifications', notification.rowIndex, updated, SHEETS.notifications.headers);
}

module.exports = {
  getUsers,
  addUser,
  updateUserBalance,
  updateUser,
  deleteUser,
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getServers,
  addServer,
  updateServer,
  deleteServer,
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getOrders,
  addOrder,
  updateOrder,
  deleteOrder,
  getVouchers,
  addVoucher,
  updateVoucher,
  deleteVoucher,
  getSettings,
  updateSetting,
  getNotifications,
  addNotification,
  markNotificationRead,
  initializeSheets,
  invalidateCache
};
