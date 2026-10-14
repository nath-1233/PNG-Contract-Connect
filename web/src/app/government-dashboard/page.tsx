'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const metrics = [
  { label: 'Active tenders', value: '38' },
  { label: 'Submissions', value: '1,462' },
  { label: 'Evaluators assigned', value: '12' },
  { label: 'Awards this month', value: '7' },
];

const evaluators = [
  { name: 'Miriam Tana', role: 'Technical evaluator' },
  { name: 'John Kila', role: 'Financial review' },
  { name: 'Lydia Wau', role: 'Compliance officer' },
];

type RoleUser = {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  role: string;
};

type TenderSummary = {
  id: string;
  title: string;
  deadline: string;
  status: string;
};

type ApplicationSummary = {
  id: string;
  tenderId: string;
  tenderTitle: string;
  status: string;
  submittedAt: string;
};

export default function GovernmentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<RoleUser | null>(null);
  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      const sessionResponse = await fetch('/api/auth/session');
      const sessionData = await sessionResponse.json();

      if (!sessionResponse.ok || !sessionData.user || !['government', 'admin'].includes(sessionData.user.role)) {
        router.replace('/login');
        return;
      }

      setUser(sessionData.user);

      const tendersResponse = await fetch('/api/tenders');
      const tendersData = await tendersResponse.json();
      const applicationResponse = await fetch('/api/applications');
      const applicationData = await applicationResponse.json();

      setTenders((tendersData.tenders || []).slice(0, 3));
      setApplications((applicationData.applications || []).slice(0, 3));
    }

    void loadDashboard();
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">Government dashboard</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Procurement oversight</h1>
          </div>
          <button className="rounded-full bg-[#0d3b66] px-5 py-3 text-sm font-semibold text-white hover:bg-[#123d72]">
            Publish tender
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-3xl font-black text-[#0d3b66]">{metric.value}</p>
              <p className="mt-2 text-sm text-slate-600">{metric.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Tender pipeline</h2>
            <div className="mt-6 space-y-4">
              {tenders.map((tender) => (
                <div key={tender.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{tender.title}</p>
                      <p className="mt-1 text-sm text-slate-500">Deadline: {tender.deadline}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">
                      {tender.status}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                    <span>Submissions</span>
                    <span className="font-semibold text-slate-800">{applications.filter((item) => item.tenderId === tender.id).length}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">Assigned evaluators</h2>
              <div className="mt-5 space-y-4">
                {evaluators.map((evaluator) => (
                  <div key={evaluator.name} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                    <div>
                      <p className="font-semibold text-slate-800">{evaluator.name}</p>
                      <p className="text-sm text-slate-500">{evaluator.role}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-[#0d3b66] p-6 text-white shadow-sm">
              <h2 className="text-xl font-bold">Approval queue</h2>
              <ul className="mt-4 space-y-3 text-sm text-sky-100">
                <li>• 3 award recommendations awaiting sign-off</li>
                <li>• 2 clarification requests pending response</li>
                <li>• 1 contract milestone due this week</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
