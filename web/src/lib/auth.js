import crypto from 'node:crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'png-contract-connect-dev-secret';

export function createSessionToken(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
    return null;
  }

  try {
    const json = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');

  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password, passwordHash) {
  if (!password || !passwordHash || typeof passwordHash !== 'string') {
    return false;
  }

  const [salt, expectedHash] = passwordHash.split(':');

  if (!salt || !expectedHash) {
    return false;
  }

  const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');

  return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(derivedKey));
}

export async function getCurrentUser() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get('png_session')?.value;

  if (!token) {
    return null;
  }

  const userPayload = verifySessionToken(token);

  if (!userPayload) {
    return null;
  }

  const { getUserById } = await import('./data-store.js');
  const user = await getUserById(userPayload.id);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    organization: user.organization,
    province: user.province,
    role: user.role,
  };
}
