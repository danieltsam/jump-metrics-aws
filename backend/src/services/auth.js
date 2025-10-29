// AI GENERATED FILE - This file was created by an AI assistant
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { secretsManagerService } from './secretsManagerService.js';

// Construct hard-coded users at startup using config for admin
const hardcodedUsers = [
  { id: 'u-admin', username: config.adminUser, role: 'admin', password: config.adminPass },
  { id: 'u-user', username: 'user', role: 'user', password: 'user' }
];

export function listUsers() {
  return hardcodedUsers.map(({ password, ...rest }) => rest);
}

export function findUserByUsername(username) {
  return hardcodedUsers.find(u => u.username === username) || null;
}

export function authenticate(username, password) {
  const u = hardcodedUsers.find(x => x.username === username && x.password === password);
  if (!u) return null;
  const { password: _pw, ...user } = u;
  return user;
}

export async function signToken(user, opts = {}) {
  const payload = { sub: user.id, username: user.username, role: user.role };
  
  // Try to get JWT secret from Secrets Manager, fallback to config
  let jwtSecret = config.jwtSecret;
  try {
    const secretFromManager = await secretsManagerService.getJwtSecret();
    if (secretFromManager) {
      jwtSecret = secretFromManager;
      console.log('🔒 Using JWT secret from Secrets Manager');
    }
  } catch (error) {
    console.warn('⚠️ Failed to get JWT secret from Secrets Manager, using config fallback:', error.message);
  }
  
  const token = jwt.sign(payload, jwtSecret, { expiresIn: opts.expiresIn || '1d' });
  return token;
}

export async function verifyToken(token) {
  try {
    // Try to get JWT secret from Secrets Manager, fallback to config
    let jwtSecret = config.jwtSecret;
    try {
      const secretFromManager = await secretsManagerService.getJwtSecret();
      if (secretFromManager) {
        jwtSecret = secretFromManager;
      }
    } catch (error) {
      // Use config fallback silently
    }
    
    return jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }
}
