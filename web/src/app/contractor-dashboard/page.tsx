'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const stats = [
  { label: 'Profile completion', value: '86%' },
  { label: 'Applications submitted', value: '12' },
  { label: 'Active tenders', value: '5' },
  { label: 'Awards won', value: '2' },
];

const saved = [
  'Rural Health Clinic Supply Contract',
  'Water and Sewerage Upgrade',
  'Public Transport Fleet Support',
];

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
};

type TenderSummary = {
  id: string;
  title: string;
  deadline: string;
};

export default function ContractorDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [tenders, setTenders] = useState<TenderSummary[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      const sessionResponse = await fetch('/api/auth/session');
      const sessionData = await sessionResponse.json();

      if (!sessionResponse.ok || !sessionData.user || sessionData.user.role !== 'contractor') {
        router.replace('/login');
        return;
      }

      setUser(sessionData.user);

      const applicationsResponse = await fetch('/api/applications');
      const applicationsData = await applicationsResponse.json();
      const tendersResponse = await fetch('/api/tenders');
      const tendersData = await tendersResponse.json();

      setApplications(applicationsData.applications || []);
      setTenders((tendersData.tenders || []).slice(0, 5));
    }

    void loadDashboard();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">Contractor dashboard</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Welcome back, {user?.fullName || 'Contractor'}</h1>
          </div>
          <button className="rounded-full bg-[#0d3b66] px-5 py-3 text-sm font-semibold text-white hover:bg-[#123d72]">
            Discover new tenders
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-3xl font-black text-[#0d3b66]">{stat.value}</p>
              <p className="mt-2 text-sm text-slate-600">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">My applications</h2>
            <div className="mt-6 space-y-4">
              {applications.length > 0 ? (
                applications.map((application) => {
                  const tender = tenders.find((item) => item.id === application.tenderId);
                  return (
                    <div key={application.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{application.tenderTitle}</p>
                          <p className="mt-1 text-sm text-slate-500">Deadline: {tender?.deadline || application.submittedAt}</p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-700">
                          {application.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No submitted applications yet.
                </p>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Saved tenders</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {saved.map((tender) => (
                  <li key={tender} className="rounded-2xl bg-slate-50 p-3">
                    {tender}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-[#0d3b66] p-6 text-white shadow-sm">
              <h2 className="text-xl font-bold">Notifications</h2>
              <ul className="mt-4 space-y-3 text-sm text-sky-100">
                <li>• Tender update received for Road Maintenance</li>
                <li>• Application acknowledgment sent</li>
                <li>• Clarification request available</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
