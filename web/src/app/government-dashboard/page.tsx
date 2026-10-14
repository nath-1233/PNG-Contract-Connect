'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type RoleUser = {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  role: string;
};

type TenderSummary = {
  id: string;
  publisherId?: string;
  title: string;
  department: string;
  location: string;
  category: string;
  value: string;
  deadline: string;
  closing: string;
  status: string;
};

type ApplicationSummary = {
  id: string;
  tenderId: string;
  tenderTitle: string;
  applicantName: string;
  organization: string;
  proposal: string;
  status: string;
  submittedAt: string;
  documents?: { name: string; index: number }[];
};

const emptyForm = {
  title: '',
  department: '',
  location: '',
  category: '',
  value: '',
  deadline: '',
  summary: '',
  requirements: '',
  documents: '',
};

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Unable to load procurement data.');
  }
  return data;
}

export default function GovernmentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<RoleUser | null>(null);
  const [tenders, setTenders] = useState<TenderSummary[]>([]);
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const session = await readResponse<{ user: RoleUser }>(await fetch('/api/auth/session'));
        if (!['government', 'admin'].includes(session.user.role)) {
          router.replace('/login');
          return;
        }

        setUser(session.user);
        const [tenderData, applicationData] = await Promise.all([
          readResponse<{ tenders: TenderSummary[] }>(await fetch('/api/tenders')),
          readResponse<{ applications: ApplicationSummary[] }>(await fetch('/api/applications')),
        ]);
        setTenders(tenderData.tenders);
        setApplications(applicationData.applications);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.message === 'Not authenticated.') {
          router.replace('/login');
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Unable to load procurement data.');
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();
  }, [router]);

  const handlePublish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const deadline = new Date(`${form.deadline}T12:00:00`);
      const deadlineText = deadline.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      const response = await fetch('/api/tenders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          department: form.department || user?.organization || '',
          location: form.location,
          category: form.category,
          value: form.value,
          deadline: deadlineText,
          closing: `${deadlineText}, 5:00 PM (UTC+10)`,
          summary: form.summary,
          requirements: form.requirements.split('\n').map((item) => item.trim()).filter(Boolean),
          documents: form.documents.split('\n').map((item) => item.trim()).filter(Boolean),
        }),
      });
      const data = await readResponse<{ tender: TenderSummary }>(response);
      setTenders((current) => [data.tender, ...current]);
      setForm(emptyForm);
      setShowForm(false);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Unable to publish this contract.');
    } finally {
      setSaving(false);
    }
  };

  const publishedTenders = tenders.filter((tender) =>
    user?.role === 'admin'
      ? true
      : tender.publisherId === user?.id ||
        (!tender.publisherId && tender.department?.toLowerCase() === user?.organization.toLowerCase()),
  );
  const visibleTenderIds = new Set(publishedTenders.map((tender) => tender.id));
  const incomingApplications = applications.filter((application) => visibleTenderIds.has(application.tenderId));

  if (loading) {
    return <main className="min-h-screen bg-slate-100 px-4 py-10 text-center text-slate-600">Loading procurement dashboard...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">Organization portal</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Contracts and incoming bids</h1>
            <p className="mt-2 text-slate-600">{user?.organization} · Publish opportunities and review contractor applications.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/tenders" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:border-[#0d3b66]">
              View public portal
            </Link>
            <Link href="/procurement-workspace" className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-[#0d3b66] hover:border-[#0d3b66]">
              Evaluation and monitoring
            </Link>
            <button
              type="button"
              onClick={() => setShowForm((current) => !current)}
              className="rounded-full bg-[#0d3b66] px-5 py-3 text-sm font-semibold text-white hover:bg-[#123d72]"
            >
              {showForm ? 'Close form' : 'Publish a contract'}
            </button>
          </div>
        </header>

        {error ? <p role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        {showForm ? (
          <form onSubmit={handlePublish} className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">New opportunity</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Publish a contract for bidders</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Contract or project title
                <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              </label>
              <label className="text-sm font-medium text-slate-700">Organization / department
                <input required value={form.department || user?.organization || ''} onChange={(event) => setForm({ ...form, department: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              </label>
              <label className="text-sm font-medium text-slate-700">Location
                <input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Province, PNG" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              </label>
              <label className="text-sm font-medium text-slate-700">Category
                <input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Construction, IT, health..." className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              </label>
              <label className="text-sm font-medium text-slate-700">Estimated value
                <input required value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} placeholder="PGK 250,000" className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              </label>
              <label className="text-sm font-medium text-slate-700">Bid closing date
                <input required type="date" min={new Date().toISOString().slice(0, 10)} value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">Project details
                <textarea required rows={4} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              </label>
              <label className="text-sm font-medium text-slate-700">Bidder requirements <span className="font-normal text-slate-500">(one per line)</span>
                <textarea rows={3} value={form.requirements} onChange={(event) => setForm({ ...form, requirements: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              </label>
              <label className="text-sm font-medium text-slate-700">Documents bidders should provide <span className="font-normal text-slate-500">(one per line)</span>
                <textarea rows={3} value={form.documents} onChange={(event) => setForm({ ...form, documents: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              </label>
            </div>
            <button disabled={saving} type="submit" className="mt-6 rounded-full bg-[#0d3b66] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'Publishing...' : 'Publish contract'}
            </button>
          </form>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-3">
          {[
            { label: 'Published contracts', value: publishedTenders.length },
            { label: 'Incoming applications', value: incomingApplications.length },
            { label: 'Applications in review', value: incomingApplications.filter((application) => application.status.toLowerCase().includes('review')).length },
          ].map((metric) => (
            <div key={metric.label} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-3xl font-black text-[#0d3b66]">{metric.value}</p>
              <p className="mt-2 text-sm text-slate-600">{metric.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-8 xl:grid-cols-2">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Your published contracts</h2>
            <div className="mt-5 space-y-3">
              {publishedTenders.length ? publishedTenders.map((tender) => (
                <Link key={tender.id} href={`/tenders/${tender.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-[#0d3b66]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{tender.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{tender.category} · {tender.location}</p>
                      <p className="mt-1 text-sm text-slate-500">Closes {tender.deadline}</p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{tender.status}</span>
                  </div>
                </Link>
              )) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No contracts published yet. Publish your first opportunity above.</p>}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Incoming contractor applications</h2>
                <p className="mt-1 text-sm text-slate-500">Applications for your published contracts</p>
              </div>
              <button type="button" onClick={() => window.location.reload()} className="text-sm font-semibold text-[#0d3b66] hover:underline">Refresh</button>
            </div>
            <div className="mt-5 space-y-3">
              {incomingApplications.length ? incomingApplications.map((application) => (
                <article key={application.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{application.tenderTitle}</p>
                      <p className="mt-1 text-sm text-slate-600">{application.organization} · {application.applicantName}</p>
                      <p className="mt-1 text-xs text-slate-500">Submitted {new Date(application.submittedAt).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{application.status}</span>
                  </div>
                  {application.proposal ? <p className="mt-3 border-t border-slate-200 pt-3 text-sm leading-6 text-slate-700">{application.proposal}</p> : null}
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
              )) : <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No applications have been submitted for your contracts yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
