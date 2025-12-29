const express = require('express');
const session = require('express-session');
const path = require('path');
const rateLimit = require('express-rate-limit');
const credentials = require('./credentials.json');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

// Security: Rate limiting to prevent brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi nanti.'
});
app.use('/auth/', limiter);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: credentials.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAdmin = req.session.user?.role === 'admin';
  
  if (req.session.user) {
    try {
      const db = require('./utils/sheetsDb');
      res.locals.notifications = await db.getNotifications(req.session.user.id).catch(() => []);
    } catch (e) {
      res.locals.notifications = [];
    }
  } else {
    res.locals.notifications = [];
  }
  next();
});

const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/server');
const productRoutes = require('./routes/products');
const depositRoutes = require('./routes/deposit');
const adminRoutes = require('./routes/admin');
const profileRoutes = require('./routes/profile');
const apiRoutes = require('./routes/api');
const { initCron } = require('./utils/cron');

initCron();

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/server', serverRoutes);
app.use('/products', productRoutes);
app.use('/deposit', depositRoutes);
app.use('/admin', adminRoutes);
app.use('/profile', profileRoutes);
app.use('/api', apiRoutes);

app.use((req, res) => {
  res.status(404).render('404', { title: 'Halaman Tidak Ditemukan' });
});

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Baeci Market running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
