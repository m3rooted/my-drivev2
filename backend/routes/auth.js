const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { isRegistrationAllowed, isRegistrationInviteValid } = require('../utils/runtimeConfig');
const {
  isRecord,
  isValidEmail,
  isValidPassword,
  normalizeDisplayName,
  normalizeEmail
} = require('../utils/validation');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const body = req.body;
    const email = normalizeEmail(body?.email);
    const name = normalizeDisplayName(body?.name, 80);
    const password = body?.password;

    if (!isRecord(body) || !isValidEmail(email) || !name || !isValidPassword(password)) {
      return res.status(400).json({ error: 'Enter a valid name, email, and password of at least 12 characters' });
    }

    if (
      process.env.NODE_ENV === 'production'
      && (
        !isRegistrationAllowed(email, process.env.REGISTRATION_INVITES)
        || !isRegistrationInviteValid(email, body.inviteCode, process.env.REGISTRATION_INVITES)
      )
    ) {
      return res.status(403).json({ error: 'Registration is closed or the invitation is invalid' });
    }

    const user = await User.create({ email, password, name });
    
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Register error:', error);
    if (error.message === 'User already exists') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = isRecord(req.body) ? req.body : {};
    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail) || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = await User.findByEmail(normalizedEmail);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await User.validatePassword(user, password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

module.exports = router;
