'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getSafeInternalRedirectPath } from '@/lib/post-login-redirect';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: 'admin@pngcontractconnect.com',
    password: 'Admin@123',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || 'Unable to sign in.');
      return;
    }

    const defaultPath = data.user.role === 'government' ? '/government-dashboard' : '/contractor-dashboard';
    const returnTo = new URLSearchParams(window.location.search).get('returnTo');
    router.push(getSafeInternalRedirectPath(returnTo, defaultPath));
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-lg lg:grid-cols-[1.1fr_0.9fr]">
        <section className="bg-[linear-gradient(135deg,#0d3b66,#123d72,#1a4f84)] p-8 text-white sm:p-12">
          <Link href="/" className="inline-flex items-center gap-3 text-lg font-bold">
            <span className="h-10 w-10 overflow-hidden rounded-xl bg-white">
              <Image
                src="/png-digital-bird-emblem.png"
                alt="Papua New Guinea digital bird emblem"
                width={40}
                height={40}
                className="h-full w-full object-contain"
              />
            </span>
            PNG Contract Connect
          </Link>

          <h1 className="mt-10 text-4xl font-black leading-tight">Secure access to PNG procurement opportunities.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-sky-100">
            Sign in to manage tenders, track applications, review evaluations, and stay updated on procurement activity across Papua New Guinea.
          </p>

          <div className="mt-10 space-y-4">
            {[
              'Manage submitted applications',
              'Receive deadline and award alerts',
              'Access role-based dashboard view',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#d62828] text-xs font-bold text-white">✓</span>
                <span className="text-sm text-sky-50">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="p-8 sm:p-12">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">Welcome back</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">Login to your account</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="name@company.com"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 outline-none focus:border-[#0d3b66]"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Enter your password"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 outline-none focus:border-[#0d3b66]"
              />
            </div>

            <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[#0d3b66]" />
                Remember me
              </label>
              <Link href="/" className="font-semibold text-[#0d3b66] hover:text-[#123d72]">
                Forgot password?
              </Link>
            </div>

            {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

            <button
              type="submit"
              className="w-full rounded-full bg-[#0d3b66] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#123d72]"
            >
              Sign in
            </button>
          </form>

          <div className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold text-[#0d3b66] hover:text-[#123d72]">
              Create one now
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
