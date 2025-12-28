const { google } = require('googleapis');
const credentials = require('../credentials.json');

const SPREADSHEET_ID = credentials.google.spreadsheet_id;

let sheetsInstance = null;

async function getSheets() {
  if (sheetsInstance) return sheetsInstance;
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: credentials.google.client_email,
      private_key: credentials.google.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const client = await auth.getClient();
  sheetsInstance = google.sheets({ version: 'v4', auth: client });
  return sheetsInstance;
}

async function getSheetData(range) {
  const sheets = await getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return response.data.values || [];
}

async function appendRow(range, values) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    resource: { values: [values] },
  });
}

async function updateRow(range, values) {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'RAW',
    resource: { values: [values] },
  });
}

async function deleteRow(sheetName, rowIndex) {
  const sheets = await getSheets();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex,
          },
        },
      }],
    },
  });
}

async function getUsers() {
  const data = await getSheetData('Users!A2:H');
  return data.map((row, index) => ({
    id: row[0] || '',
    username: row[1] || '',
    email: row[2] || '',
    password: row[3] || '',
    balance: parseInt(row[4]) || 0,
    role: row[5] || 'user',
    createdAt: row[6] || '',
    phone: row[7] || '',
    rowIndex: index + 2
  }));
}

async function addUser(user) {
  const id = 'U' + Date.now();
  await appendRow('Users!A:H', [
    id,
    user.username,
    user.email,
    user.password,
    0,
    user.role || 'user',
    new Date().toISOString(),
    user.phone || ''
  ]);
  return id;
}

async function updateUserBalance(userId, newBalance) {
  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return false;
  
  await updateRow(`Users!E${user.rowIndex}`, [[newBalance]]);
  return true;
}

async function getProducts() {
  const data = await getSheetData('Products!A2:I');
  return data.map((row, index) => ({
    id: row[0] || '',
    name: row[1] || '',
    description: row[2] || '',
    price: parseInt(row[3]) || 0,
    stock: parseInt(row[4]) || 0,
    category: row[5] || '',
    image: row[6] || '',
    isActive: row[7] === 'true',
    createdAt: row[8] || '',
    rowIndex: index + 2
  }));
}

async function addProduct(product) {
  const id = 'P' + Date.now();
  await appendRow('Products!A:I', [
    id,
    product.name,
    product.description,
    product.price,
    product.stock,
    product.category,
    product.image || '',
    'true',
    new Date().toISOString()
  ]);
  return id;
}

async function getServers() {
  const data = await getSheetData('Servers!A2:J');
  return data.map((row, index) => ({
    id: row[0] || '',
    name: row[1] || '',
    ram: row[2] || '',
    cpu: row[3] || '',
    disk: row[4] || '',
    price: parseInt(row[5]) || 0,
    location: row[6] || '',
    duration: row[7] || '',
    isActive: row[8] === 'true',
    description: row[9] || '',
    rowIndex: index + 2
  }));
}

async function addServer(server) {
  const id = 'S' + Date.now();
  await appendRow('Servers!A:J', [
    id,
    server.name,
    server.ram,
    server.cpu,
    server.disk,
    server.price,
    server.location,
    server.duration,
    'true',
    server.description || ''
  ]);
  return id;
}

async function getTransactions() {
  const data = await getSheetData('Transactions!A2:J');
  return data.map((row, index) => ({
    id: row[0] || '',
    userId: row[1] || '',
    type: row[2] || '',
    amount: parseInt(row[3]) || 0,
    status: row[4] || '',
    description: row[5] || '',
    paymentMethod: row[6] || '',
    refId: row[7] || '',
    createdAt: row[8] || '',
    productId: row[9] || '',
    rowIndex: index + 2
  }));
}

async function addTransaction(transaction) {
  const id = 'T' + Date.now();
  await appendRow('Transactions!A:J', [
    id,
    transaction.userId,
    transaction.type,
    transaction.amount,
    transaction.status,
    transaction.description,
    transaction.paymentMethod || '',
    transaction.refId || '',
    new Date().toISOString(),
    transaction.productId || ''
  ]);
  return id;
}

async function getSettings() {
  const data = await getSheetData('Settings!A2:C');
  const settings = {};
  data.forEach(row => {
    settings[row[0]] = row[1];
  });
  return settings;
}

async function updateSetting(key, value) {
  const data = await getSheetData('Settings!A2:C');
  const rowIndex = data.findIndex(row => row[0] === key);
  
  if (rowIndex >= 0) {
    await updateRow(`Settings!B${rowIndex + 2}`, [[value]]);
  } else {
    await appendRow('Settings!A:C', [key, value, new Date().toISOString()]);
  }
}

async function getOrders() {
  const data = await getSheetData('Orders!A2:L');
  return data.map((row, index) => ({
    id: row[0] || '',
    userId: row[1] || '',
    username: row[2] || '',
    productType: row[3] || '',
    productId: row[4] || '',
    productName: row[5] || '',
    quantity: parseInt(row[6]) || 1,
    totalPrice: parseInt(row[7]) || 0,
    status: row[8] || '',
    serverDetails: row[9] || '',
    createdAt: row[10] || '',
    completedAt: row[11] || '',
    rowIndex: index + 2
  }));
}

async function addOrder(order) {
  const id = 'O' + Date.now();
  await appendRow('Orders!A:L', [
    id,
    order.userId,
    order.username,
    order.productType,
    order.productId,
    order.productName,
    order.quantity || 1,
    order.totalPrice,
    order.status || 'pending',
    order.serverDetails || '',
    new Date().toISOString(),
    ''
  ]);
  return id;
}

module.exports = {
  getSheetData,
  appendRow,
  updateRow,
  deleteRow,
  getUsers,
  addUser,
  updateUserBalance,
  getProducts,
  addProduct,
  getServers,
  addServer,
  getTransactions,
  addTransaction,
  getSettings,
  updateSetting,
  getOrders,
  addOrder
};
