'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type SessionUser = {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  role: string;
};

type ApplicationSummary = {
  id: string;
  tenderId: string;
  tenderTitle: string;
  status: string;
  submittedAt: string;
  documents?: { name: string; index: number }[];
};

type TenderSummary = {
  id: string;
  title: string;
  department: string;
  deadline: string;
  status: string;
  category: string;
  value: string;
};

export default function ContractorDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const sessionResponse = await fetch('/api/auth/session');
        const sessionData = await sessionResponse.json();

        if (!sessionResponse.ok || !sessionData.user || sessionData.user.role !== 'contractor') {
          router.replace('/login');
          return;
        }

        setUser(sessionData.user);
        const [applicationsResponse, tendersResponse] = await Promise.all([
          fetch('/api/applications'),
          fetch('/api/tenders'),
        ]);
        const [applicationsData, tendersData] = await Promise.all([
          applicationsResponse.json(),
          tendersResponse.json(),
        ]);
        if (!applicationsResponse.ok || !tendersResponse.ok) {
          throw new Error(applicationsData.error || tendersData.error || 'Unable to load your procurement activity.');
        }

        setApplications(applicationsData.applications);
        setTenders(tendersData.tenders.filter((tender: TenderSummary) => ['Open', 'Closing Soon'].includes(tender.status)));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load your procurement activity.');
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [router]);

  if (loading) {
    return <main className="min-h-screen bg-slate-100 px-4 py-10 text-center text-slate-600">Loading contractor dashboard...</main>;
  }

  const submittedTenderIds = new Set(applications.map((application) => application.tenderId));
  const availableTenders = tenders.filter((tender) => !submittedTenderIds.has(tender.id));

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">Contractor portal</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Welcome back, {user?.fullName || 'Contractor'}</h1>
            <p className="mt-2 text-slate-600">{user?.organization} · Find contracts and track your bids.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/procurement-workspace" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-[#0d3b66] hover:border-[#0d3b66]">
              Contract workspace
            </Link>
            <Link href="/tenders" className="rounded-full bg-[#0d3b66] px-5 py-3 text-center text-sm font-semibold text-white hover:bg-[#123d72]">
              Browse all contracts
            </Link>
          </div>
        </header>

        {error ? <p role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { label: 'Applications submitted', value: applications.length },
            { label: 'Applications in review', value: applications.filter((application) => application.status.toLowerCase().includes('review')).length },
            { label: 'Open contracts', value: tenders.length },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-3xl font-black text-[#0d3b66]">{stat.value}</p>
              <p className="mt-2 text-sm text-slate-600">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-2">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">My applications</h2>
            <div className="mt-5 space-y-3">
              {applications.length ? applications.map((application) => (
                <article key={application.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{application.tenderTitle}</p>
                      <p className="mt-1 text-sm text-slate-500">Submitted {new Date(application.submittedAt).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{application.status}</span>
                  </div>
                  <Link href={`/tenders/${application.tenderId}`} className="mt-3 inline-flex text-sm font-semibold text-[#0d3b66] hover:underline">View contract</Link>
                  {application.documents?.length ? (
                    <ul className="mt-3 border-t border-slate-200 pt-3">
                      {application.documents.map((document) => (
                        <li key={document.index}>
                          <a href={`/api/applications/${application.id}/documents/${document.index}`} className="text-sm font-semibold text-[#0d3b66] hover:underline">
                            Download {document.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              )) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">You have not submitted any applications yet.</p>}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Contracts accepting bids</h2>
                <p className="mt-1 text-sm text-slate-500">New opportunities published by organizations</p>
              </div>
              <Link href="/tenders" className="text-sm font-semibold text-[#0d3b66] hover:underline">View all</Link>
            </div>
            <div className="mt-5 space-y-3">
              {availableTenders.length ? availableTenders.slice(0, 5).map((tender) => (
                <Link key={tender.id} href={`/tenders/${tender.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-[#0d3b66]">
                  <p className="font-semibold text-slate-900">{tender.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{tender.department} · {tender.category}</p>
                  <p className="mt-1 text-sm text-slate-500">Value {tender.value} · Closes {tender.deadline}</p>
                </Link>
              )) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No new contracts are available right now.</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
