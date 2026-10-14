import { cookies } from 'next/headers';

import { createSessionToken } from '@/lib/auth';
import { createUser, getUserByEmail } from '@/lib/data-store';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const fullName = String(body.fullName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const organization = String(body.organization || '').trim();
  const phone = String(body.phone || '').trim();
  const province = String(body.province || 'Other').trim();
  const role = String(body.role || 'contractor').trim();

  if (!fullName || !email || !password || !organization) {
    return Response.json({ error: 'Please complete all required fields.' }, { status: 400 });
  }

  if (await getUserByEmail(email)) {
    return Response.json({ error: 'An account with this email already exists.' }, { status: 400 });
  }

  const user = await createUser({
    fullName,
    email,
    password,
    organization,
    phone,
    province,
    role,
  });

  if (!user) {
    return Response.json({ error: 'Unable to create account. Please try again.' }, { status: 400 });
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
