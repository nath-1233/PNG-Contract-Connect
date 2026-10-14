import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";

import { getTenders } from "@/lib/data-store";

type PortalTender = {
  id: string;
  title: string;
  department: string;
  location: string;
  deadline: string;
  status: string;
  value: string;
};

const stats = [
  { label: "Provinces covered", value: "22" },
  { label: "Tender categories", value: "16" },
  { label: "Average response time", value: "24 hrs" },
  { label: "Procurement modules", value: "6" },
];

const categories = [
  "Building and Construction",
  "Roads and Infrastructure",
  "Electrical and Mechanical Engineering",
  "Information Technology and Software Development",
  "Telecommunications",
  "Transportation and Logistics",
  "Healthcare and Medical Supplies",
  "Education and Training",
  "Agriculture and Fisheries",
  "Mining and Natural Resources",
  "Energy and Renewable Energy",
  "Cleaning and Maintenance",
  "Consultancy and Professional Services",
  "Office Supplies and Equipment",
  "Security Services",
  "Environmental Services",
];

const steps = [
  {
    number: "01",
    title: "Create secure account",
    description:
      "Register as a contractor or government user with role-based portal access. External business and identity verification is not connected yet.",
  },
  {
    number: "02",
    title: "Search and apply",
    description:
      "Find relevant tenders by category, province, deadline, and project value using streamlined filters and alerts.",
  },
  {
    number: "03",
    title: "Track transparent evaluation",
    description:
      "Monitor submission progress, receive notifications, and review evaluation outcomes through auditable workflows.",
  },
];

const featureGroups = [
  {
    title: "For Contractors",
    items: [
      "Register business and individual profiles",
      "Use search, filters, and saved tenders",
      "Submit bid summaries; attach documents after encrypted storage is configured",
      "Track bid decisions and contract milestones",
    ],
  },
  {
    title: "For Government",
    items: [
      "Publish tenders and manage documents",
      "Score bids against published evaluation criteria",
      "Record conflict declarations and a file-backed activity trail",
      "Track milestones and invoice status",
    ],
  },
];

const securityFeatures = [
  "Server-side role checks protect government evaluation and contractor records",
  "Passwords are hashed before storage",
  "Eligibility is shown for review; business identity is not externally verified",
  "  Bid-document uploads require deployment configuration for private AWS S3, KMS encryption, and GuardDuty malware scanning",
  "The workspace activity hash chain is illustrative and is not immutable storage",
];

async function LiveTenderSnapshot() {
  const tenders = (await getTenders()) as PortalTender[];
  const acceptingBids = tenders.filter((tender) => ["Open", "Closing Soon"].includes(tender.status));
  const nextDeadline = acceptingBids[0];

  return (
    <div className="w-full rounded-[2rem] border border-slate-200 bg-slate-950 p-6 text-white shadow-2xl shadow-slate-300/40">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Live portal</p>
          <h2 className="mt-2 text-2xl font-bold">Tender snapshot</h2>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300">Active</span>
      </div>
      <div className="space-y-4">
        {[
          { label: "Contracts accepting bids", value: String(acceptingBids.length) },
          { label: "Closing soon", value: String(acceptingBids.filter((tender) => tender.status === "Closing Soon").length) },
          { label: "Publishing organizations", value: String(new Set(tenders.map((tender) => tender.department)).size) },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
            <span className="text-sm text-slate-300">{item.label}</span>
            <span className="text-xl font-bold text-white">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        {nextDeadline ? (
          <>
            <p className="text-sm text-slate-300">Latest contract opportunity</p>
            <Link href={`/tenders/${nextDeadline.id}`} className="mt-2 block text-lg font-semibold text-white hover:underline">{nextDeadline.title}</Link>
            <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
              <span>Closing date</span>
              <span className="font-medium text-slate-100">{nextDeadline.deadline}</span>
            </div>
          </>
        ) : <p className="text-sm text-slate-300">There are no open contracts at this time.</p>}
      </div>
    </div>
  );
}

async function LatestOpportunities() {
  const tenders = (await getTenders()) as PortalTender[];
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {tenders.slice(0, 3).map((tender) => (
        <article key={tender.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{tender.department}</p>
              <h3 className="mt-3 text-xl font-bold text-slate-900">{tender.title}</h3>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-700">{tender.status}</span>
          </div>
          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>📍 {tender.location}</p>
            <p>⏰ Closing: {tender.deadline}</p>
            <p>💰 Estimated value: {tender.value}</p>
          </div>
          <Link href={`/tenders/${tender.id}`} className="mt-6 inline-flex rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[#0d3b66] hover:text-[#0d3b66]">
            View details
          </Link>
        </article>
      ))}
      {!tenders.length ? <p className="text-slate-600">No contracts have been published yet.</p> : null}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-xl bg-white shadow-sm">
              <Image
                src="/png-digital-bird-emblem.png"
                alt="Papua New Guinea digital bird emblem"
                width={44}
                height={44}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">PNG Contract Connect</p>
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                Procurement platform
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex">
            <a href="#home" className="transition hover:text-[#0d3b66]">Home</a>
            <a href="#find-contracts" className="transition hover:text-[#0d3b66]">Find Contracts</a>
            <a href="#government" className="transition hover:text-[#0d3b66]">Government</a>
            <a href="#how-it-works" className="transition hover:text-[#0d3b66]">How to Apply</a>
            <a href="#support" className="transition hover:text-[#0d3b66]">Help Centre</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#0d3b66] hover:text-[#0d3b66] sm:inline-flex"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex rounded-full bg-[#0d3b66] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#123d72]"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <main id="home">
        <section className="bg-[radial-gradient(circle_at_top,_rgba(13,59,102,0.18),_transparent_38%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_100%)]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.3fr_0.7fr] lg:px-8 lg:py-20">
            <div className="flex flex-col justify-center">
              <span className="mb-5 inline-flex w-fit items-center rounded-full border border-[#0d3b66]/20 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#0d3b66]">
                Connecting Papua New Guinea to government contract opportunities
              </span>

              <h1 className="max-w-xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Secure access to government tenders across PNG.
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
                PNG Contract Connect helps businesses, contractors, suppliers, and government departments manage procurement opportunities with transparency, accountability, and secure digital workflows.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <a
                  href="#find-contracts"
                  className="inline-flex items-center justify-center rounded-full bg-[#d62828] px-6 py-3 text-base font-semibold text-white transition hover:bg-[#b21f1f]"
                >
                  Find contracts
                </a>
                <a
                  href="#government"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-800 transition hover:border-[#0d3b66] hover:text-[#0d3b66]"
                >
                  Government access
                </a>
              </div>

              <div className="mt-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
                <input
                  aria-label="Search contract opportunities"
                  placeholder="Search by keyword, category, or province"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:border-[#0d3b66]"
                />
                <button className="rounded-full bg-[#0d3b66] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#123d72]">
                  Search
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <Suspense fallback={<div className="h-80 w-full animate-pulse rounded-[2rem] bg-slate-900" />}>
                <LiveTenderSnapshot />
              </Suspense>
            </div>
          </div>

          <div className="mx-auto grid max-w-7xl gap-5 px-4 pb-16 sm:px-6 lg:grid-cols-4 lg:px-8">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-3xl font-black text-[#0d3b66]">{stat.value}</p>
                <p className="mt-2 text-sm text-slate-600">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="find-contracts" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">Latest opportunities</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">Government contracts to explore</h2>
            </div>
            <Link href="/tenders" className="text-sm font-semibold text-[#0d3b66] hover:text-[#123d72]">
              Browse all tenders →
            </Link>
          </div>

          <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl bg-slate-200" />}>
            <LatestOpportunities />
          </Suspense>
        </section>

        <section className="bg-slate-900 py-16 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#f9b5b5]">Contract categories</p>
              <h2 className="mt-3 text-3xl font-bold">Procurement opportunities across PNG</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => (
                <div key={category} className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4 text-sm text-slate-200 shadow-sm">
                  {category}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">How it works</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">A clear, secure procurement workflow</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="inline-flex rounded-full bg-[#edf4ff] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#0d3b66]">
                  {step.number}
                </span>
                <h3 className="mt-5 text-xl font-bold text-slate-900">{step.title}</h3>
                <p className="mt-3 text-base leading-7 text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="government" className="bg-slate-100 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">Built for both sides</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900">Operational clarity for contractors and government teams</h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {featureGroups.map((group) => (
                <div key={group.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-2xl font-bold text-slate-900">{group.title}</h3>
                  <ul className="mt-5 space-y-4">
                    {group.items.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-slate-700">
                        <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0d3b66] text-[10px] text-white">
                          ✓
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">Procurement operations · MVP</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold text-slate-900">From published contract to delivery and payment tracking</h2>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">
              Explore the role-based procurement workbench for bid evaluation, milestones, invoice status,
              conflict declarations and an activity trail. AWS document uploads require deployment
              configuration; external identity, banking and automated risk integrations are not connected.
            </p>
            <Link href="/procurement-workspace" className="mt-6 inline-flex rounded-full bg-[#0d3b66] px-6 py-3 text-sm font-semibold text-white hover:bg-[#123d72]">
              Open procurement workspace
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl bg-[#0d3b66] p-8 text-white shadow-lg">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-200">Current MVP safeguards</p>
              <h2 className="mt-3 text-3xl font-bold">What the portal protects—and what is not connected yet</h2>
              <ul className="mt-6 space-y-4">
                {securityFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-slate-100">
                    <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#d62828] text-[10px] font-bold text-white">
                      •
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d62828]">PNG-specific requirements</p>
              <h3 className="mt-3 text-2xl font-bold text-slate-900">Built for the local procurement environment</h3>
              <div className="mt-6 space-y-4 text-slate-600">
                <p>• Province and National Capital District selection</p>
                <p>• Kina (PGK) formatting for contract values</p>
                <p>• Papua New Guinea Time (UTC+10) deadlines</p>
                <p>• Support for provincial and departmental procurement accounts</p>
                <p>• Configurable integration with official government systems</p>
              </div>
            </div>
          </div>
        </section>

        <section id="support" className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[2rem] border border-slate-200 bg-gradient-to-r from-[#0d3b66] via-[#123d72] to-[#0f2f4c] p-8 text-white shadow-lg">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-200">Support and public notices</p>
                  <h2 className="mt-3 text-3xl font-bold">Need help with tender submissions or procurement guidance?</h2>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/login" className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0d3b66]">
                    Help centre
                  </Link>
                  <Link href="/register" className="inline-flex items-center justify-center rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white">
                    Contact support
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-xl bg-white">
                <Image
                  src="/png-digital-bird-emblem.png"
                  alt="Papua New Guinea digital bird emblem"
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="font-bold text-white">PNG Contract Connect</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">
              A secure, accessible tendering and procurement platform designed for Papua New Guinea.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Navigation</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>Home</li>
              <li>Find Contracts</li>
              <li>Government Departments</li>
              <li>How to Apply</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Resources</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>Privacy Policy</li>
              <li>Terms of Use</li>
              <li>Security Information</li>
              <li>FAQs</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-200">Contact</h3>
            <ul className="mt-4 space-y-2 text-sm text-slate-400">
              <li>Port Moresby, PNG</li>
              <li>support@pngcontractconnect.com</li>
              <li>+675 3000 000</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
