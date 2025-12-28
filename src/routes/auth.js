const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../utils/sheetsDb');
const { isGuest, isAuthenticated } = require('../middleware/auth');

router.get('/login', isGuest, (req, res) => {
  res.render('login', { 
    title: 'Login - Baeci Market',
    error: null 
  });
});

router.post('/login', isGuest, async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = await db.getUsers();
    
    const user = users.find(u => u.email === email || u.username === email);
    
    if (!user) {
      return res.render('login', { 
        title: 'Login - Baeci Market',
        error: 'Email atau password salah' 
      });
    }

    let isValidPassword = false;
    
    if (user.password.startsWith('$2')) {
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      isValidPassword = user.password === password;
    }

    if (!isValidPassword) {
      return res.render('login', { 
        title: 'Login - Baeci Market',
        error: 'Email atau password salah' 
      });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      balance: user.balance,
      role: user.role,
      phone: user.phone
    };

    if (user.role === 'admin') {
      return res.redirect('/admin');
    }
    
    res.redirect('/');
  } catch (error) {
    console.error('Login Error:', error);
    res.render('login', { 
      title: 'Login - Baeci Market',
      error: 'Terjadi kesalahan, silakan coba lagi' 
    });
  }
});

router.get('/register', isGuest, (req, res) => {
  res.render('register', { 
    title: 'Daftar - Baeci Market',
    error: null 
  });
});

router.post('/register', isGuest, async (req, res) => {
  try {
    const { username, email, password, confirmPassword, phone } = req.body;

    if (password !== confirmPassword) {
      return res.render('register', { 
        title: 'Daftar - Baeci Market',
        error: 'Password tidak cocok' 
      });
    }

    const users = await db.getUsers();
    
    if (users.find(u => u.email === email)) {
      return res.render('register', { 
        title: 'Daftar - Baeci Market',
        error: 'Email sudah terdaftar' 
      });
    }

    if (users.find(u => u.username === username)) {
      return res.render('register', { 
        title: 'Daftar - Baeci Market',
        error: 'Username sudah digunakan' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const userId = await db.addUser({
      username,
      email,
      password: hashedPassword,
      role: 'user',
      phone
    });

    req.session.user = {
      id: userId,
      username,
      email,
      balance: 0,
      role: 'user',
      phone
    };

    res.redirect('/');
  } catch (error) {
    console.error('Register Error:', error);
    res.render('register', { 
      title: 'Daftar - Baeci Market',
      error: 'Terjadi kesalahan, silakan coba lagi' 
    });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
