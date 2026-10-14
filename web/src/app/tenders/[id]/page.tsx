import Link from 'next/link';
import { Suspense } from 'react';

import { getTenderById } from '@/lib/data-store';
import ApplyForm from './ApplyForm';

async function TenderDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tender = (await getTenderById(id)) as {
    id: string;
    title: string;
    department: string;
    location: string;
    category: string;
    value: string;
    closing: string;
    status: string;
    summary: string;
    requirements: string[];
    documents: string[];
  } | null;

  if (!tender) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Tender not found</h1>
          <Link href="/tenders" className="mt-5 inline-flex rounded-full bg-[#0d3b66] px-5 py-3 text-sm font-semibold text-white hover:bg-[#123d72]">
            Back to tenders
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/tenders" className="text-sm font-semibold text-[#0d3b66] hover:text-[#123d72]">
            ← Back to tenders
          </Link>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">
            {tender.status}
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">{tender.department}</p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">{tender.title}</h1>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Category</p>
                <p className="mt-2 text-base font-semibold text-slate-800">{tender.category}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Location</p>
                <p className="mt-2 text-base font-semibold text-slate-800">{tender.location}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Budget</p>
                <p className="mt-2 text-base font-semibold text-slate-800">{tender.value}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Closing date</p>
                <p className="mt-2 text-base font-semibold text-slate-800">{tender.closing}</p>
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold text-slate-900">Tender summary</h2>
              <p className="mt-3 text-base leading-7 text-slate-600">{tender.summary}</p>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold text-slate-900">Requirements</h2>
              <ul className="mt-4 space-y-3 text-slate-600">
                {tender.requirements.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0d3b66] text-[10px] text-white">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold text-slate-900">Required documents</h2>
              <ul className="mt-4 space-y-3 text-slate-600">
                {tender.documents.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#d62828] text-[10px] text-white">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-[#0d3b66] p-6 text-white shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-sky-200">Apply now</p>
              <h2 className="mt-3 text-2xl font-bold">Submit your response</h2>
              <p className="mt-3 text-sm leading-6 text-sky-100">
                Complete the application form, upload required documents, and confirm before the deadline.
              </p>
              <ApplyForm tenderId={tender.id} />
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Official contact</h3>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>📧 procurement@works.gov.pg</p>
                <p>📞 +675 3000 129</p>
                <p>🕒 Clarification window open until 11 Nov 2026</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function TenderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 px-4 py-10 text-center text-slate-600">Loading tender details...</div>}>
      <TenderDetailContent params={params} />
    </Suspense>
  );
}
