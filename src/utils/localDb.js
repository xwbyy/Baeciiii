const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');

function readJson(filename) {
  const filePath = path.join(dataDir, filename);
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error.message);
    return [];
  }
}

function writeJson(filename, data) {
  const filePath = path.join(dataDir, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error.message);
    return false;
  }
}

async function getUsers() {
  const users = readJson('users.json');
  return users.map((user, index) => ({
    ...user,
    balance: parseInt(user.balance) || 0,
    rowIndex: index + 2
  }));
}

async function addUser(user) {
  const users = readJson('users.json');
  const id = 'U' + Date.now();
  const newUser = {
    id,
    username: user.username,
    email: user.email,
    password: user.password,
    balance: 0,
    role: user.role || 'user',
    createdAt: new Date().toISOString(),
    phone: user.phone || ''
  };
  users.push(newUser);
  writeJson('users.json', users);
  return id;
}

async function updateUserBalance(userId, newBalance) {
  const users = readJson('users.json');
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return false;
  users[index].balance = newBalance;
  writeJson('users.json', users);
  return true;
}

async function getProducts() {
  const products = readJson('products.json');
  return products.map((product, index) => ({
    ...product,
    price: parseInt(product.price) || 0,
    stock: parseInt(product.stock) || 0,
    isActive: product.isActive !== false,
    rowIndex: index + 2
  }));
}

async function addProduct(product) {
  const products = readJson('products.json');
  const id = 'P' + Date.now();
  const newProduct = {
    id,
    name: product.name,
    description: product.description,
    price: parseInt(product.price),
    stock: parseInt(product.stock),
    category: product.category,
    image: product.image || '',
    isActive: true,
    createdAt: new Date().toISOString()
  };
  products.push(newProduct);
  writeJson('products.json', products);
  return id;
}

async function updateProduct(productId, updates) {
  const products = readJson('products.json');
  const index = products.findIndex(p => p.id === productId);
  if (index === -1) return false;
  products[index] = { ...products[index], ...updates };
  writeJson('products.json', products);
  return true;
}

async function deleteProduct(productId) {
  const products = readJson('products.json');
  const filtered = products.filter(p => p.id !== productId);
  writeJson('products.json', filtered);
  return true;
}

async function getServers() {
  const servers = readJson('servers.json');
  return servers.map((server, index) => ({
    ...server,
    price: parseInt(server.price) || 0,
    isActive: server.isActive !== false,
    rowIndex: index + 2
  }));
}

async function addServer(server) {
  const servers = readJson('servers.json');
  const id = 'S' + Date.now();
  const newServer = {
    id,
    name: server.name,
    ram: server.ram,
    cpu: server.cpu,
    disk: server.disk,
    price: parseInt(server.price),
    location: server.location,
    duration: server.duration,
    isActive: true,
    description: server.description || ''
  };
  servers.push(newServer);
  writeJson('servers.json', servers);
  return id;
}

async function updateServer(serverId, updates) {
  const servers = readJson('servers.json');
  const index = servers.findIndex(s => s.id === serverId);
  if (index === -1) return false;
  servers[index] = { ...servers[index], ...updates };
  writeJson('servers.json', servers);
  return true;
}

async function deleteServer(serverId) {
  const servers = readJson('servers.json');
  const filtered = servers.filter(s => s.id !== serverId);
  writeJson('servers.json', filtered);
  return true;
}

async function getTransactions() {
  const transactions = readJson('transactions.json');
  return transactions.map((t, index) => ({
    ...t,
    amount: parseInt(t.amount) || 0,
    rowIndex: index + 2
  }));
}

async function addTransaction(transaction) {
  const transactions = readJson('transactions.json');
  const id = 'T' + Date.now();
  const newTransaction = {
    id,
    userId: transaction.userId,
    type: transaction.type,
    amount: transaction.amount,
    status: transaction.status,
    description: transaction.description,
    paymentMethod: transaction.paymentMethod || '',
    refId: transaction.refId || '',
    createdAt: new Date().toISOString(),
    productId: transaction.productId || ''
  };
  transactions.push(newTransaction);
  writeJson('transactions.json', transactions);
  return id;
}

async function updateTransaction(transactionId, updates) {
  const transactions = readJson('transactions.json');
  const index = transactions.findIndex(t => t.id === transactionId);
  if (index === -1) return false;
  transactions[index] = { ...transactions[index], ...updates };
  writeJson('transactions.json', transactions);
  return true;
}

async function getOrders() {
  const orders = readJson('orders.json');
  return orders.map((o, index) => ({
    ...o,
    quantity: parseInt(o.quantity) || 1,
    totalPrice: parseInt(o.totalPrice) || 0,
    rowIndex: index + 2
  }));
}

async function addOrder(order) {
  const orders = readJson('orders.json');
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
    serverDetails: order.serverDetails || '',
    createdAt: new Date().toISOString(),
    completedAt: ''
  };
  orders.push(newOrder);
  writeJson('orders.json', orders);
  return id;
}

async function updateOrder(orderId, updates) {
  const orders = readJson('orders.json');
  const index = orders.findIndex(o => o.id === orderId);
  if (index === -1) return false;
  orders[index] = { ...orders[index], ...updates };
  writeJson('orders.json', orders);
  return true;
}

async function getSettings() {
  return readJson('settings.json');
}

async function updateSetting(key, value) {
  const settings = readJson('settings.json');
  settings[key] = value;
  writeJson('settings.json', settings);
  return true;
}

async function deleteUser(userId) {
  const users = readJson('users.json');
  const filtered = users.filter(u => u.id !== userId);
  writeJson('users.json', filtered);
  return true;
}

async function updateUser(userId, updates) {
  const users = readJson('users.json');
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) return false;
  users[index] = { ...users[index], ...updates };
  writeJson('users.json', users);
  return true;
}

async function deleteOrder(orderId) {
  const orders = readJson('orders.json');
  const filtered = orders.filter(o => o.id !== orderId);
  writeJson('orders.json', filtered);
  return true;
}

async function deleteTransaction(transactionId) {
  const transactions = readJson('transactions.json');
  const filtered = transactions.filter(t => t.id !== transactionId);
  writeJson('transactions.json', filtered);
  return true;
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
  getSettings,
  updateSetting
};
