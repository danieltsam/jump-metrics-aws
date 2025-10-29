// AI GENERATED FILE - This file was created by an AI assistant
import { Router } from 'express';
import { listUsers, authenticate, signToken } from '../services/auth.js';
import { cognitoService } from '../services/cognitoService.js';

const router = Router();

// POST /api/v1/auth/login -> returns JWT and user
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'username and password required' });

  try {
    const cognitoAvailable = await cognitoService.isAvailable();
    if (cognitoAvailable) {
      const result = await cognitoService.signIn(username, password);
      if (result.success) {
        console.log('🔍 Login successful for user:', result.user.username);
        console.log('📋 User groups:', result.user.groups);
        console.log('👑 User role:', result.user.role);
        
        return res.status(200).json({
          token: result.tokens.accessToken,
          user: {
            sub: result.user.username,
            username: result.user.username,
            email: result.user.email,
            role: result.user.role,
            groups: result.user.groups || []
          },
          cognito: true,
          tokens: result.tokens
        });
      }
      if (result.challenge === 'NEW_PASSWORD_REQUIRED') {
        return res.status(202).json({ challenge: 'NEW_PASSWORD_REQUIRED', session: result.session, message: result.message });
      }
      return res.status(401).json({ message: result.message || 'Invalid credentials', error: result.error });
    }

    // If Cognito is not configured, allow local auth fallback for dev/test
    const user = authenticate(username, password);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const token = await signToken({ id: user.id, username: user.username, role: user.role });
    return res.status(200).json({ token, user: { id: user.id, username: user.username, role: user.role }, cognito: false });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ message: 'Authentication service error' });
  }
});

// POST /api/v1/auth/register -> self-service registration (Cognito)
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'username, email, and password required' });
  }
  try {
    const cognitoAvailable = await cognitoService.isAvailable();
    if (!cognitoAvailable) return res.status(503).json({ message: 'Cognito not configured' });
    const result = await cognitoService.signUp(username, password, email);
    if (result.success) {
      return res.status(201).json({
        message: result.userConfirmed ? 'User registered and confirmed' : 'User registered, please verify your email',
        userConfirmed: result.userConfirmed
      });
    }
    return res.status(400).json({ message: result.message, error: result.error });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Registration service error' });
  }
});

// POST /api/v1/auth/confirm -> confirm sign-up
router.post('/confirm', async (req, res) => {
  const { username, code } = req.body || {};
  if (!username || !code) return res.status(400).json({ message: 'username and code required' });
  try {
    const cognitoAvailable = await cognitoService.isAvailable();
    if (!cognitoAvailable) return res.status(503).json({ message: 'Cognito not configured' });
    const result = await cognitoService.confirmSignUp(username, code);
    if (result.success) return res.status(200).json({ message: 'Email confirmed' });
    return res.status(400).json({ message: result.message, error: result.error });
  } catch (error) {
    console.error('Confirm error:', error);
    return res.status(500).json({ message: 'Confirmation service error' });
  }
});

// POST /api/v1/auth/resend -> resend confirmation code
router.post('/resend', async (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ message: 'username required' });
  try {
    const cognitoAvailable = await cognitoService.isAvailable();
    if (!cognitoAvailable) return res.status(503).json({ message: 'Cognito not configured' });
    const result = await cognitoService.resendConfirmationCode(username);
    if (result.success) return res.status(200).json({ message: 'Confirmation code sent' });
    return res.status(400).json({ message: result.message, error: result.error });
  } catch (error) {
    console.error('Resend error:', error);
    return res.status(500).json({ message: 'Resend service error' });
  }
});

// GET /api/v1/auth/users (debug/dev only) -> list users without passwords
router.get('/users', (req, res) => {
  res.status(200).json({ users: listUsers() });
});

export default router;
