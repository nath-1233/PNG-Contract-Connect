'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type User = { id: string; fullName: string; organization: string; role: string };
type Tender = {
  id: string;
  title: string;
  department: string;
  publisherId?: string;
  category: string;
  value: string;
  deadline: string;
  requirements: string[];
  documents: string[];
};
type Application = {
  id: string;
  tenderId: string;
  tenderTitle: string;
  organization: string;
  status: string;
  submittedAt: string;
  applicantName?: string;
  proposal?: string;
};
type Milestone = {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  evidence: string;
};
type Invoice = {
  id: string;
  applicationId: string;
  invoiceNumber: string;
  amount: number;
  description: string;
  status: string;
};
type Declaration = {
  id: string;
  applicationId: string | null;
  declarationType: string;
  noConflict: boolean;
  statement: string;
  declarerName: string;
  declaredAt: string;
};
type Evaluation = {
  id: string;
  applicationId: string;
  scores: { technical: number; experience: number; compliance: number; price: number };
  totalScore: number;
  decision: string;
  comments: string;
  evaluatedAt: string;
};
type AuditEntry = {
  id: string;
  timestamp: string;
  actorName: string;
  event: string;
  hash: string;
};
type Workspace = {
  milestones: Milestone[];
  invoices: Invoice[];
  declarations: Declaration[];
  evaluations: Evaluation[];
  auditEntries: AuditEntry[];
};
type IntegrationState = {
  identityVerification: string;
  documentStorage: string;
  financeAndBanking: string;
  automatedSuspiciousBidAlerts: string;
};

const emptyWorkspace: Workspace = {
  milestones: [],
  invoices: [],
  declarations: [],
  evaluations: [],
  auditEntries: [],
};

const moduleCards = [
  { id: 'marketplace', number: '01', title: 'Contract marketplace', description: 'Browse published government opportunities.' },
  { id: 'contractor', number: '02', title: 'Contractor portal', description: 'Review eligibility and follow submitted bids.' },
  { id: 'evaluation', number: '03', title: 'Government evaluation', description: 'Score bids against consistent criteria.' },
  { id: 'monitoring', number: '04', title: 'Contract monitoring', description: 'Record milestones, deadlines and progress.' },
  { id: 'payments', number: '05', title: 'Payment management', description: 'Track invoice submission and approval states.' },
  { id: 'trust', number: '06', title: 'Trust and transparency', description: 'Record declarations and inspect an audit trail.' },
];

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load procurement workspace.');
  return data as T;
}

export default function ProcurementWorkspacePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState('');
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [integrations, setIntegrations] = useState<IntegrationState | null>(null);
  const [auditChainValid, setAuditChainValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [scores, setScores] = useState({ technical: '', experience: '', compliance: '', price: '' });
  const [decision, setDecision] = useState('In review');
  const [evaluationComments, setEvaluationComments] = useState('');
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [milestoneDueDate, setMilestoneDueDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [invoiceDescription, setInvoiceDescription] = useState('');
  const [declarationApplicationId, setDeclarationApplicationId] = useState('');
  const [declarationStatement, setDeclarationStatement] = useState('');
  const [noConflict, setNoConflict] = useState<boolean | null>(null);

  const loadWorkspace = useCallback(async (tenderId: string) => {
    if (!tenderId) {
      setWorkspace(emptyWorkspace);
      return;
    }
    const data = await readJson<{
      workspace: Workspace;
      integrations: IntegrationState;
      auditChainValid: boolean;
    }>(await fetch(`/api/procurement-workspaces/${encodeURIComponent(tenderId)}`));
    setWorkspace(data.workspace);
    setIntegrations(data.integrations);
    setAuditChainValid(data.auditChainValid);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await readJson<{ user: User }>(await fetch('/api/auth/session'));
        if (!active) return;
        setUser(session.user);
        const [tenderData, applicationData] = await Promise.all([
          readJson<{ tenders: Tender[] }>(await fetch('/api/tenders')),
          readJson<{ applications: Application[] }>(await fetch('/api/applications')),
        ]);
        if (!active) return;
        const ownedTenders = session.user.role === 'admin'
          ? tenderData.tenders
          : session.user.role === 'government'
            ? tenderData.tenders.filter((tender) =>
                tender.publisherId === session.user.id ||
                (!tender.publisherId && tender.department.toLowerCase() === session.user.organization.toLowerCase()),
              )
            : tenderData.tenders.filter((tender) =>
                applicationData.applications.some((application) => application.tenderId === tender.id),
              );
        setTenders(ownedTenders);
        setApplications(applicationData.applications);
        setSelectedTenderId(ownedTenders[0]?.id || '');
      } catch (loadError) {
        if (loadError instanceof Error && loadError.message === 'Not authenticated.') {
          router.replace('/login?returnTo=%2Fprocurement-workspace');
          return;
        }
        setError(loadError instanceof Error ? loadError.message : 'Unable to load procurement workspace.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [loadWorkspace, router]);

  const currentTender = tenders.find((tender) => tender.id === selectedTenderId);
  const currentApplications = applications.filter((application) => application.tenderId === selectedTenderId);
  const isGovernment = user?.role === 'government' || user?.role === 'admin';
  const awardedApplication = useMemo(
    () => currentApplications.find((application) =>
      workspace.evaluations.some((evaluation) =>
        evaluation.applicationId === application.id && evaluation.decision === 'Awarded',
      ),
    ),
    [currentApplications, workspace.evaluations],
  );

  useEffect(() => {
    if (!selectedTenderId) return;
    let active = true;
    async function refresh() {
      try {
        const data = await readJson<{
          workspace: Workspace;
          integrations: IntegrationState;
          auditChainValid: boolean;
        }>(await fetch(`/api/procurement-workspaces/${encodeURIComponent(selectedTenderId)}`));
        if (!active) return;
        setWorkspace(data.workspace);
        setIntegrations(data.integrations);
        setAuditChainValid(data.auditChainValid);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load selected contract.');
      }
    }
    void refresh();
    return () => { active = false; };
  }, [selectedTenderId]);

  const performAction = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await readJson(await fetch(`/api/procurement-workspaces/${encodeURIComponent(selectedTenderId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }));
      await loadWorkspace(selectedTenderId);
      setNotice('Your update was saved to this procurement workspace.');
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to save this update.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitEvaluation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedApplicationId) return;
    await performAction({
      action: 'evaluate',
      applicationId: selectedApplicationId,
      scores: {
        technical: Number(scores.technical),
        experience: Number(scores.experience),
        compliance: Number(scores.compliance),
        price: Number(scores.price),
      },
      decision,
      comments: evaluationComments,
    });
  };

  const submitMilestone = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await performAction({ action: 'add-milestone', title: milestoneTitle, dueDate: milestoneDueDate })) {
      setMilestoneTitle('');
      setMilestoneDueDate('');
    }
  };

  const submitInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!awardedApplication) return;
    if (await performAction({
      action: 'submit-invoice',
      applicationId: awardedApplication.id,
      invoiceNumber,
      amount: invoiceAmount,
      description: invoiceDescription,
    })) {
      setInvoiceNumber('');
      setInvoiceAmount('');
      setInvoiceDescription('');
    }
  };

  const submitDeclaration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const declarationApplication = isGovernment ? selectedApplicationId : declarationApplicationId;
    if (await performAction({
      action: 'declare-conflict',
      ...(declarationApplication ? { applicationId: declarationApplication } : {}),
      noConflict,
      statement: declarationStatement,
    })) {
      setDeclarationStatement('');
    }
  };

  const updateMilestone = async (milestone: Milestone, status: string, evidence: string) => {
    await performAction({
      action: 'update-milestone',
      milestoneId: milestone.id,
      status,
      evidence,
    });
  };

  const updateInvoice = async (invoiceId: string, status: string) => {
    await performAction({ action: 'update-invoice', invoiceId, status });
  };

  if (loading) return <main className="min-h-screen bg-slate-100 px-4 py-12 text-center text-slate-600">Loading procurement workspace...</main>;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[2rem] bg-[#0d3b66] p-7 text-white sm:p-10">
          <Link href="/" className="text-sm font-semibold text-sky-100 hover:underline">← PNG Contract Connect</Link>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.22em] text-sky-200">Procurement operations</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Six procurement modules</h1>
          <p className="mt-3 max-w-3xl leading-7 text-sky-100">
            A role-protected MVP for publishing, bidding, evaluation, delivery, invoices and trust records.
            Identity checks, finance/banking connections and automated risk alerts are not connected. Bid attachments use encrypted AWS storage only after deployment configuration and remain unavailable until GuardDuty reports a clean scan.
          </p>
        </header>

        <nav aria-label="Procurement modules" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {moduleCards.map((item) => (
            <a key={item.id} href={`#${item.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-[#0d3b66]">
              <span className="text-xs font-bold tracking-widest text-[#d62828]">{item.number}</span>
              <h2 className="mt-1 font-bold">{item.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
            </a>
          ))}
        </nav>

        {error ? <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
        {notice ? <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p> : null}

        <section id="marketplace" className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <ModuleHeading number="01" title="Contract marketplace" subtitle="Published construction, supply, maintenance and service opportunities." />
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm font-semibold text-slate-700">Workspace contract
              <select value={selectedTenderId} onChange={(event) => {
                setSelectedTenderId(event.target.value);
                setSelectedApplicationId('');
              }} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3">
                {tenders.map((tender) => <option key={tender.id} value={tender.id}>{tender.title}</option>)}
              </select>
            </label>
            <Link href="/tenders" className="rounded-full bg-[#0d3b66] px-5 py-3 text-center text-sm font-bold text-white">Browse public contracts</Link>
          </div>
          {currentTender ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="font-bold">{currentTender.title}</p>
              <p className="mt-1 text-sm text-slate-600">{currentTender.department} · {currentTender.category} · {currentTender.value}</p>
              <p className="mt-1 text-sm text-slate-600">Bid deadline: {currentTender.deadline}</p>
            </div>
          ) : <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No workspace contracts are available for this account yet. Browse the public marketplace or submit a bid first.</p>}
        </section>

        <section id="contractor" className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <ModuleHeading number="02" title="Contractor portal" subtitle="Registration, eligibility checks, bid applications and supporting documents." />
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="font-bold">Eligibility checklist</h3>
              <p className="mt-1 text-sm text-slate-600">Requirements published by the contract owner. This page does not verify documents or business identity.</p>
              <ul className="mt-3 space-y-2">
                {(currentTender?.requirements || []).map((requirement) => (
                  <li key={requirement} className="rounded-xl border border-slate-200 p-3 text-sm">{requirement} <span className="ml-2 text-xs font-semibold text-amber-700">Review required</span></li>
                ))}
                {!currentTender?.requirements.length ? <li className="text-sm text-slate-500">No eligibility requirements listed.</li> : null}
              </ul>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-bold text-amber-950">Encrypted bid document storage</h3>
              <p className="mt-2 text-sm leading-6 text-amber-900">Supporting documents are uploaded to a private AWS S3 bucket in ap-southeast-2 with KMS encryption. Bucket, KMS and GuardDuty malware-scanning configuration must be enabled at deployment; documents are not attached to bids or downloadable until GuardDuty confirms a clean scan.</p>
              {currentApplications.length ? <p className="mt-3 text-sm font-semibold text-amber-950">Applications on this contract: {currentApplications.length}</p> : null}
              <Link href={currentTender ? `/tenders/${currentTender.id}` : '/tenders'} className="mt-3 inline-flex text-sm font-bold text-[#0d3b66] hover:underline">View contract and apply →</Link>
            </div>
          </div>
        </section>

        <section id="evaluation" className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <ModuleHeading number="03" title="Government evaluation dashboard" subtitle="Score eligible bids against transparent criteria and record a decision." />
          {isGovernment ? currentApplications.length ? (
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                {currentApplications.map((application) => {
                  const evaluation = workspace.evaluations.find((item) => item.applicationId === application.id);
                  return <button key={application.id} type="button" onClick={() => setSelectedApplicationId(application.id)} className={`w-full rounded-xl border p-4 text-left ${selectedApplicationId === application.id ? 'border-[#0d3b66] bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                    <span className="font-semibold">{application.applicantName || application.organization}</span>
                    <span className="ml-2 text-sm text-slate-500">{evaluation ? `${evaluation.decision} · ${evaluation.totalScore}/20` : 'Not scored'}</span>
                  </button>;
                })}
              </div>
              <form onSubmit={submitEvaluation} className="space-y-3 rounded-2xl bg-slate-50 p-4">
                <label className="block text-sm font-semibold">Bid to evaluate
                  <select required value={selectedApplicationId} onChange={(event) => setSelectedApplicationId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2">
                    <option value="">Select a bid</option>
                    {currentApplications.map((application) => <option key={application.id} value={application.id}>{application.applicantName || application.organization}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['technical', 'experience', 'compliance', 'price'] as const).map((criterion) => (
                    <label key={criterion} className="text-sm font-medium capitalize">{criterion} score (0–5)
                      <input type="number" min="0" max="5" required value={scores[criterion]} onChange={(event) => setScores({ ...scores, [criterion]: event.target.value === '' ? '' : Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
                    </label>
                  ))}
                </div>
                <label className="block text-sm font-semibold">Decision
                  <select value={decision} onChange={(event) => setDecision(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2">
                    {['In review', 'Shortlisted', 'Unsuccessful', 'Awarded'].map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <textarea value={evaluationComments} onChange={(event) => setEvaluationComments(event.target.value)} maxLength={1000} rows={3} placeholder="Evaluation rationale (up to 1,000 characters)" className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
                <button disabled={saving || !selectedApplicationId} className="rounded-full bg-[#0d3b66] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save evaluation'}</button>
              </form>
            </div>
          ) : <p className="mt-4 text-sm text-slate-600">No bids have been received for this contract.</p>
            : <p className="mt-4 text-sm text-slate-600">Bid evaluation is available to the owning government department and administrators.</p>}
          {workspace.evaluations.map((evaluation) => (
            <p key={evaluation.id} className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
              Bid decision: <strong>{evaluation.decision}</strong> · Total score: {evaluation.totalScore}/20
            </p>
          ))}
        </section>

        <section id="monitoring" className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <ModuleHeading number="04" title="Contract monitoring" subtitle="Track delivery milestones, due dates, progress evidence and completion." />
          {isGovernment ? <form onSubmit={submitMilestone} className="mt-5 grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
            <input required maxLength={120} value={milestoneTitle} onChange={(event) => setMilestoneTitle(event.target.value)} placeholder="Milestone, e.g. site mobilisation" className="rounded-xl border border-slate-300 p-3 text-sm" />
            <input required type="date" value={milestoneDueDate} onChange={(event) => setMilestoneDueDate(event.target.value)} className="rounded-xl border border-slate-300 p-3 text-sm" />
            <button disabled={saving || !currentTender} className="rounded-full bg-[#0d3b66] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Add milestone</button>
          </form> : null}
          <div className="mt-5 space-y-3">
            {workspace.milestones.map((milestone) => <MilestoneCard key={milestone.id} milestone={milestone} canUpdate={Boolean(isGovernment || awardedApplication)} saving={saving} onSave={updateMilestone} />)}
            {!workspace.milestones.length ? <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No milestones recorded for this contract.</p> : null}
          </div>
          <p className="mt-4 text-xs text-slate-500">Progress entries are informational records in this MVP, not official completion certification.</p>
        </section>

        <section id="payments" className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <ModuleHeading number="05" title="Payment management" subtitle="Submit invoices and track approval states. No funds are moved by this portal." />
          {awardedApplication && !isGovernment ? <form onSubmit={submitInvoice} className="mt-5 grid gap-3 md:grid-cols-2">
            <input required maxLength={80} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Invoice reference" className="rounded-xl border border-slate-300 p-3 text-sm" />
            <input required type="number" min="0.01" max="1000000000" step="0.01" value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} placeholder="Amount (PGK)" className="rounded-xl border border-slate-300 p-3 text-sm" />
            <input required maxLength={500} value={invoiceDescription} onChange={(event) => setInvoiceDescription(event.target.value)} placeholder="Description of delivered work" className="rounded-xl border border-slate-300 p-3 text-sm md:col-span-2" />
            <button disabled={saving} className="w-fit rounded-full bg-[#0d3b66] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Submit invoice</button>
          </form> : null}
          <div className="mt-5 space-y-3">
            {workspace.invoices.map((invoice) => <article key={invoice.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{invoice.invoiceNumber} · PGK {invoice.amount.toLocaleString('en-PG', { minimumFractionDigits: 2 })}</p>
                <p className="mt-1 text-sm text-slate-600">{invoice.description} · <strong>{invoice.status}</strong></p>
              </div>
              {isGovernment && invoice.status === 'Submitted' ? <div className="flex gap-2">
                <button disabled={saving} onClick={() => void updateInvoice(invoice.id, 'Approved')} className="rounded-full border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800">Approve</button>
                <button disabled={saving} onClick={() => void updateInvoice(invoice.id, 'Rejected')} className="rounded-full border border-red-300 px-3 py-2 text-xs font-bold text-red-800">Reject</button>
              </div> : null}
              {isGovernment && invoice.status === 'Approved' ? <button disabled={saving} onClick={() => void updateInvoice(invoice.id, 'Paid')} className="rounded-full bg-[#0d3b66] px-4 py-2 text-xs font-bold text-white">Mark reconciled / paid</button> : null}
            </article>)}
            {!workspace.invoices.length ? <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">{isGovernment ? 'No invoices submitted.' : awardedApplication ? 'No invoices submitted yet.' : 'Invoices are enabled only after a bid is recorded as awarded.'}</p> : null}
          </div>
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Finance and banking integrations are not connected. “Paid” is a manual status only; do not treat it as bank reconciliation.</p>
        </section>

        <section id="trust" className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <ModuleHeading number="06" title="Trust and transparency" subtitle="Capture conflict declarations and review the hash-linked activity record." />
          <form onSubmit={submitDeclaration} className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4">
            {!isGovernment ? <label className="block text-sm font-semibold">Application
              <select required value={declarationApplicationId} onChange={(event) => setDeclarationApplicationId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2">
                <option value="">Select your bid</option>
                {currentApplications.map((application) => <option key={application.id} value={application.id}>{application.tenderTitle} · {application.status}</option>)}
              </select>
            </label> : null}
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="mb-2 font-semibold">{isGovernment ? 'Officer conflict-of-interest declaration' : 'Bidder conflict-of-interest declaration'}</legend>
              <label><input type="radio" name="conflict-declaration" checked={noConflict === true} onChange={() => setNoConflict(true)} /> No conflict to declare</label>
              <label><input type="radio" name="conflict-declaration" checked={noConflict === false} onChange={() => setNoConflict(false)} /> Potential conflict to disclose</label>
            </fieldset>
            {isGovernment ? <p className="text-xs text-slate-500">Select the bid above before recording an officer declaration. A no-conflict declaration is required for that bid before evaluation.</p> : null}
            <textarea required minLength={10} maxLength={1000} value={declarationStatement} onChange={(event) => setDeclarationStatement(event.target.value)} placeholder="Declaration statement (do not include confidential bid or personal data)" rows={3} className="w-full rounded-lg border border-slate-300 p-3 text-sm" />
            <button disabled={saving || noConflict === null || (!isGovernment && !currentApplications.length) || (isGovernment && !selectedApplicationId)} className="rounded-full bg-[#0d3b66] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Record declaration</button>
          </form>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="font-bold">Declarations</h3>
              <div className="mt-3 space-y-2">
                {workspace.declarations.map((declaration) => <article key={declaration.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <p className="font-semibold">{declaration.declarationType} · {declaration.noConflict ? 'No conflict declared' : 'Potential conflict disclosed'}</p>
                  <p className="mt-1 text-slate-600">{declaration.statement}</p>
                  <p className="mt-1 text-xs text-slate-500">{declaration.declarerName} · {new Date(declaration.declaredAt).toLocaleString()}</p>
                </article>)}
                {!workspace.declarations.length ? <p className="text-sm text-slate-500">No declarations recorded.</p> : null}
              </div>
            </div>
            <div>
              <h3 className="font-bold">Audit trail</h3>
              <p className={`mt-2 rounded-lg p-3 text-sm ${auditChainValid ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                Hash-chain check: {auditChainValid ? 'valid for records currently stored' : 'not verified'}
              </p>
              <div className="mt-3 max-h-64 space-y-2 overflow-auto">
                {workspace.auditEntries.map((entry) => <article key={entry.id} className="rounded-lg bg-slate-50 p-3 text-xs">
                  <p className="font-semibold">{entry.event.replaceAll('-', ' ')} · {entry.actorName}</p>
                  <p className="mt-1 text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
                  <p className="mt-1 break-all font-mono text-slate-400">{entry.hash}</p>
                </article>)}
                {!workspace.auditEntries.length ? <p className="text-sm text-slate-500">No audit events recorded yet.</p> : null}
              </div>
            </div>
          </div>
          <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            This MVP audit chain is tamper-evident for stored records; it is not immutable or independently verified.
            External identity verification and automated suspicious-bidding alerts are not connected. Document storage status is reported separately below.
            {integrations ? ` Current integration status: identity ${integrations.identityVerification}, file storage ${integrations.documentStorage}, finance ${integrations.financeAndBanking}, alerts ${integrations.automatedSuspiciousBidAlerts}.` : ''}
          </p>
        </section>

        <footer className="mt-8 text-center text-xs text-slate-500">
          Production workspace records require the connected Neon Postgres database. Local development without DATABASE_URL uses an ignored file-backed store.
        </footer>
      </div>
    </main>
  );
}

function ModuleHeading({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return <div>
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d62828]">Module {number}</p>
    <h2 className="mt-1 text-2xl font-bold">{title}</h2>
    <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
  </div>;
}

function MilestoneCard({ milestone, canUpdate, saving, onSave }: {
  milestone: Milestone;
  canUpdate: boolean;
  saving: boolean;
  onSave: (milestone: Milestone, status: string, evidence: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(milestone.status);
  const [evidence, setEvidence] = useState(milestone.evidence);
  return <article className="grid gap-3 rounded-xl border border-slate-200 p-4 lg:grid-cols-[1fr_10rem_1fr_auto] lg:items-center">
    <div><p className="font-semibold">{milestone.title}</p><p className="text-sm text-slate-500">Due {milestone.dueDate}</p></div>
    <select disabled={!canUpdate} value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-300 p-2 text-sm">
      {['Planned', 'In progress', 'Completed', 'Blocked'].map((value) => <option key={value}>{value}</option>)}
    </select>
    <input disabled={!canUpdate} maxLength={1000} value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Progress evidence / update" className="rounded-lg border border-slate-300 p-2 text-sm disabled:bg-slate-100" />
    {canUpdate ? <button disabled={saving} onClick={() => void onSave(milestone, status, evidence)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Save</button> : null}
  </article>;
}
