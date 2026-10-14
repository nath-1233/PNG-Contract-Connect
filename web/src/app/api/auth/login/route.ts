import { cookies } from 'next/headers';

import { createSessionToken } from '@/lib/auth';
import { authenticateUser, getUserByEmail } from '@/lib/data-store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) {
    return Response.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const user = await authenticateUser({ email, password });

  if (!user) {
    return Response.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const sessionToken = createSessionToken({
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  });

  const cookieStore = await cookies();
  cookieStore.set('png_session', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return Response.json({
    success: true,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      organization: user.organization,
      province: user.province,
      role: user.role,
    },
  });
}
