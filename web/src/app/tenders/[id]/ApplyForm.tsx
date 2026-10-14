'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Application = {
  tenderId: string;
};

export default function ApplyForm({ tenderId }: { tenderId: string }) {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [proposal, setProposal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadApplicationStatus() {
      try {
        const sessionResponse = await fetch('/api/auth/session');
        if (!sessionResponse.ok) return;
        const sessionData = await sessionResponse.json();
        if (!active) return;
        setRole(sessionData.user?.role || null);

        if (sessionData.user?.role === 'contractor') {
          const response = await fetch('/api/applications');
          if (!response.ok) throw new Error('Unable to check your applications.');
          const data = await response.json();
          if (active) setHasApplied((data.applications as Application[]).some((application) => application.tenderId === tenderId));
        }
      } catch (statusError) {
        if (active) setError(statusError instanceof Error ? statusError.message : 'Unable to check your applications.');
      }
    }

    void loadApplicationStatus();
    return () => {
      active = false;
    };
  }, [tenderId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenderId, proposal }),
      });
      const data = await response.json();

      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Unable to submit your application.');
      setSubmitted(true);
      setHasApplied(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6">
      {error ? <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {submitted || hasApplied ? (
        <p role="status" className="rounded-2xl bg-emerald-100 p-4 text-sm font-semibold text-emerald-800">
          {submitted ? 'Your application has been submitted to the organization.' : 'You have already applied for this contract.'}
        </p>
      ) : role === 'contractor' ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="proposal" className="block text-sm font-medium text-sky-100">Your bid summary</label>
          <textarea
            id="proposal"
            required
            minLength={20}
            rows={4}
            value={proposal}
            onChange={(event) => setProposal(event.target.value)}
            placeholder="Describe your proposed approach and relevant experience (at least 20 characters)."
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-sky-200 focus:border-white"
          />
          <button disabled={submitting} type="submit" className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0d3b66] hover:bg-slate-100 disabled:opacity-60">
            {submitting ? 'Submitting...' : 'Submit application'}
          </button>
        </form>
      ) : role ? (
        <p className="rounded-2xl bg-white/10 p-4 text-sm text-sky-100">Sign in with a contractor account to apply.</p>
      ) : (
        <Link href="/login" className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0d3b66] hover:bg-slate-100">
          Sign in to apply
        </Link>
      )}
    </div>
  );
}
