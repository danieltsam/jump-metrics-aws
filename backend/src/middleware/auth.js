// AI GENERATED FILE - This file was created by an AI assistant
import { cognitoService } from '../services/cognitoService.js';
import { verifyToken } from '../services/auth.js';

export async function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  let token = null;
  if (auth.startsWith('Bearer ')) token = auth.slice('Bearer '.length);
  if (!token && req.query && typeof req.query.token === 'string') token = req.query.token;
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Try Cognito first
    const cognitoAvailable = await cognitoService.isAvailable();
    if (cognitoAvailable) {
      const verification = await cognitoService.verifyToken(token);
      if (verification.valid) {
        const userInfo = await cognitoService.getUserInfo(token);
        req.user = {
          id: userInfo.username,
          username: userInfo.username,
          email: userInfo.email,
          role: userInfo.role,
          groups: userInfo.groups || [],
          cognito: true
        };
        return next();
      }
    }

    // Fallback to simple JWT verification with Secrets Manager
    const payload = await verifyToken(token);
    if (payload) {
      req.user = {
        id: payload.sub,
        username: payload.username,
        role: payload.role,
        cognito: false
      };
      return next();
    }

    return res.status(401).json({ message: 'Unauthorized' });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (req.user.role === 'admin') return next();
    if (req.user.role !== role) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

export function requireAdminGroup(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  
  // Check if user is in admin group (Cognito) or has admin role (fallback)
  const isAdmin = req.user.groups?.includes('admin') || req.user.role === 'admin';
  
  if (!isAdmin) {
    return res.status(403).json({ 
      message: 'Forbidden - Admin group required',
      userGroups: req.user.groups || [],
      userRole: req.user.role
    });
  }
  
  next();
}
