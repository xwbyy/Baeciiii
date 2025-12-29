const TelegramBot = require('node-telegram-bot-api');
const db = require('./sheetsDb');
const os = require('os');

// Bot Token and ID from User
const TOKEN = '6513717790:AAHVEFgiLZx6gk5TU8OO3lv5ySENtsOfYSI';
const ADMIN_ID = '1618920755';

let bot;
try {
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log('Telegram Bot initialized');
} catch (error) {
  console.error('Failed to initialize Telegram Bot:', error.message);
}

const sendNotification = async (message, chatId = ADMIN_ID) => {
  if (!bot) return;
  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error sending Telegram notification:', error.message);
  }
};

const getSystemStats = () => {
  const uptime = Math.floor(os.uptime());
  const freeMem = Math.floor(os.freemem() / 1024 / 1024);
  const totalMem = Math.floor(os.totalmem() / 1024 / 1024);
  const load = os.loadavg();
  const cores = os.cpus().length;

  return `<b>📊 System Status</b>
🖥 CPU Cores: ${cores}
📈 Load Average: ${load[0].toFixed(2)}, ${load[1].toFixed(2)}, ${load[2].toFixed(2)}
💾 RAM: ${totalMem - freeMem}MB / ${totalMem}MB free
⏱ Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
};

if (bot) {
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Welcome to Baeci Market Bot! Type /status to check server condition.');
  });

  bot.onText(/\/status/, async (msg) => {
    if (msg.chat.id.toString() !== ADMIN_ID) return;
    bot.sendMessage(msg.chat.id, getSystemStats(), { parse_mode: 'HTML' });
  });

  bot.onText(/\/checkweb/, async (msg) => {
    if (msg.chat.id.toString() !== ADMIN_ID) return;
    const start = Date.now();
    try {
      await fetch('http://localhost:5000');
      const delay = Date.now() - start;
      bot.sendMessage(msg.chat.id, `✅ Website is ONLINE\n⏱ Response time: ${delay}ms`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ Website is OFFLINE\nError: ${e.message}`);
    }
  });
}

module.exports = {
  sendNotification,
  getSystemStats
};
