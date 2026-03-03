/**
 * Standalone Auth Setup Script
 * 
 * Generates a session token for the admin user so you can
 * access the dashboard without Manus OAuth.
 * 
 * Run: node scripts/setup-standalone-auth.mjs
 * 
 * It will output a cookie value you can set in your browser,
 * or you can use the /api/auth/login endpoint.
 */

import { SignJWT } from 'jose';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET not set. Please configure your .env file.');
  process.exit(1);
}

async function generateToken() {
  const secretKey = new TextEncoder().encode(JWT_SECRET);
  const oneYearMs = 1000 * 60 * 60 * 24 * 365;
  const expirationSeconds = Math.floor((Date.now() + oneYearMs) / 1000);

  const token = await new SignJWT({
    openId: 'admin',
    appId: 'standalone',
    name: 'Admin',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);

  console.log('');
  console.log('✅ Admin session token generated!');
  console.log('');
  console.log('=== TOKEN ===');
  console.log(token);
  console.log('=============');
  console.log('');
  console.log('Para usar no browser, abra o DevTools (F12) > Console e cole:');
  console.log('');
  console.log(`  document.cookie = "app_session_id=${token}; path=/; max-age=31536000";`);
  console.log('');
  console.log('Depois recarregue a página (F5).');
  console.log('');
}

generateToken().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
