'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const defaultForm = {
  fullName: '',
  organization: '',
  email: '',
  role: 'contractor',
  phone: '',
  province: 'National Capital District',
  password: '',
  confirmPassword: '',
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: form.fullName,
        organization: form.organization,
        email: form.email,
        role: form.role,
        phone: form.phone,
        province: form.province,
        password: form.password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || 'Unable to create account.');
      return;
    }

    router.push(data.user.role === 'government' ? '/government-dashboard' : '/contractor-dashboard');
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-lg sm:p-10 lg:p-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 text-lg font-bold text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0d3b66] text-sm text-white">
              PNG
            </span>
            PNG Contract Connect
          </Link>
          <Link href="/login" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#0d3b66] hover:text-[#0d3b66]">
            Already have an account?
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">Create account</p>
          <h1 className="mt-3 text-3xl font-black text-slate-900">Register as a contractor or government user</h1>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Full name</label>
            <input
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#0d3b66]"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Business or organization</label>
            <input
              value={form.organization}
              onChange={(event) => setForm((current) => ({ ...current, organization: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#0d3b66]"
              placeholder="Company or department"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Email address</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#0d3b66]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Account type</label>
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#0d3b66]"
            >
              <option value="contractor">Contractor</option>
              <option value="government">Government Department</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Phone number</label>
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#0d3b66]"
              placeholder="+675 ..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Province</label>
            <select
              value={form.province}
              onChange={(event) => setForm((current) => ({ ...current, province: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#0d3b66]"
            >
              <option>National Capital District</option>
              <option>Morobe</option>
              <option>Western Highlands</option>
              <option>East New Britain</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#0d3b66]"
              placeholder="Create a password"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Confirm password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#0d3b66]"
              placeholder="Repeat password"
            />
          </div>

          {error ? (
            <div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#0d3b66]" />
              <span>
                I agree to the terms of use, privacy notice, and procurement compliance requirements for this platform.
              </span>
            </label>
          </div>

          <div className="md:col-span-2">
            <button type="submit" className="w-full rounded-full bg-[#0d3b66] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#123d72]">
              Create account
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
