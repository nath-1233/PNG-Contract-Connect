import Link from 'next/link';
import { Suspense } from 'react';

import { getTenders } from '@/lib/data-store';

const filters = ['All', 'Roads', 'IT', 'Health', 'Construction', 'Energy'];

async function TenderListContent() {
  const tenders = (await getTenders()) as Array<{
    id: string;
    title: string;
    department: string;
    location: string;
    category: string;
    value: string;
    closing: string;
    status: string;
  }>;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">Find contracts</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">Government contract opportunities</h1>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
              <input
                className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 sm:w-72"
                placeholder="Search tenders, category or region"
              />
              <button className="rounded-full bg-[#0d3b66] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123d72]">
                Search
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                className={`rounded-full px-3 py-2 text-sm font-medium ${
                  filter === 'All'
                    ? 'bg-[#0d3b66] text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:text-[#0d3b66]'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {tenders.map((tender) => (
            <article key={tender.id} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{tender.department}</p>
                  <h2 className="mt-3 text-xl font-bold text-slate-900">{tender.title}</h2>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">
                  {tender.status}
                </span>
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <p>📍 {tender.location}</p>
                <p>🏷️ {tender.category}</p>
                <p>💰 {tender.value}</p>
                <p>⏰ Closing: {tender.closing}</p>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <Link href={`/tenders/${tender.id}`} className="inline-flex rounded-full bg-[#0d3b66] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123d72]">
                  View details
                </Link>
                <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-[#0d3b66] hover:text-[#0d3b66]">
                  Save tender
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function TenderListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 px-4 py-10 text-center text-slate-600">Loading tenders...</div>}>
      <TenderListContent />
    </Suspense>
  );
}
