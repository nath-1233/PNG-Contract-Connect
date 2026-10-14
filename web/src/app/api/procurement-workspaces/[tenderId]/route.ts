import crypto from 'node:crypto';

import { getCurrentUser } from '@/lib/auth';
import { isBidDocumentStorageConfigured } from '@/lib/bid-document-storage';
import {
  getApplications,
  getApplicationsForUser,
  getTenderById,
} from '@/lib/data-store';
import {
  appendAuditEntry,
  getProcurementWorkspace,
  updateProcurementWorkspace,
  verifyAuditChain,
} from '@/lib/procurement-workspace';

const decisions = ['In review', 'Shortlisted', 'Unsuccessful', 'Awarded'];
const milestoneStatuses = ['Planned', 'In progress', 'Completed', 'Blocked'];
const invoiceStatuses = ['Approved', 'Rejected', 'Paid'];

type ApplicationRecord = {
  id: string;
  tenderId: string;
};

class WorkspaceActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function isGovernment(user: { role: string }) {
  return user.role === 'admin' || user.role === 'government';
}

function ownsTender(user: { id: string; role: string; organization: string }, tender: {
  publisherId?: string;
  department?: string;
}) {
  return user.role === 'admin' || (
    user.role === 'government' &&
    (tender.publisherId === user.id ||
      (!tender.publisherId && tender.department?.toLowerCase() === user.organization.toLowerCase()))
  );
}

function addAudit(workspace: Awaited<ReturnType<typeof getProcurementWorkspace>>, user: {
  id: string;
  fullName: string;
}, event: string, details: Record<string, string>) {
  appendAuditEntry(workspace, {
    actorId: user.id,
    actorName: user.fullName,
    event,
    details,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenderId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });

  const { tenderId } = await params;
  const tender = await getTenderById(tenderId);
  if (!tender) return Response.json({ error: 'Contract not found.' }, { status: 404 });

  const applications = (isGovernment(user)
    ? await getApplications()
    : await getApplicationsForUser(user.id)) as ApplicationRecord[];
  const tenderApplications = applications.filter((application) => application.tenderId === tenderId);
  if (
    (isGovernment(user) && !ownsTender(user, tender)) ||
    (!isGovernment(user) && (user.role !== 'contractor' || tenderApplications.length === 0))
  ) {
    return Response.json({ error: 'You do not have access to this contract workspace.' }, { status: 403 });
  }

  const workspace = await getProcurementWorkspace(tenderId);
  const ownApplicationIds = new Set(tenderApplications.map((application) => application.id));
  const visibleApplications = tenderApplications.map((application) => {
    const evaluation = workspace.evaluations.find((item: { applicationId: string }) =>
      item.applicationId === application.id,
    );
    return evaluation ? { ...application, status: evaluation.decision } : application;
  });
  const visibleWorkspace = isGovernment(user)
    ? workspace
    : {
        ...workspace,
        invoices: workspace.invoices.filter((invoice: { applicationId: string }) => ownApplicationIds.has(invoice.applicationId)),
        declarations: workspace.declarations.filter((declaration: { applicationId?: string; declaredBy: string }) =>
          declaration.declaredBy === user.id,
        ),
        evaluations: workspace.evaluations.filter((evaluation: { applicationId: string }) =>
          ownApplicationIds.has(evaluation.applicationId),
        ),
        auditEntries: workspace.auditEntries.filter((entry: { details?: { applicationId?: string } }) =>
          !entry.details?.applicationId || ownApplicationIds.has(entry.details.applicationId),
        ),
      };

  return Response.json({
    tender,
    applications: visibleApplications,
    workspace: visibleWorkspace,
    auditChainValid: verifyAuditChain(workspace.auditEntries),
    integrations: {
      identityVerification: 'not-connected',
      documentStorage: isBidDocumentStorageConfigured()
        ? 'AWS S3/KMS configured; GuardDuty clean-scan tags required'
        : 'requires-deployment-configuration',
      financeAndBanking: 'not-connected',
      automatedSuspiciousBidAlerts: 'not-connected',
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenderId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });

  const { tenderId } = await params;
  const tender = await getTenderById(tenderId);
  if (!tender) return Response.json({ error: 'Contract not found.' }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== 'string') {
    return Response.json({ error: 'Choose a valid workspace action.' }, { status: 400 });
  }

  const government = isGovernment(user);
  if (government && !ownsTender(user, tender)) {
    return Response.json({ error: 'You do not manage this contract.' }, { status: 403 });
  }
  const userApplications = (government ? await getApplications() : await getApplicationsForUser(user.id)) as ApplicationRecord[];
  const tenderApplications = userApplications.filter((application) => application.tenderId === tenderId);
  if (!government && (user.role !== 'contractor' || tenderApplications.length === 0)) {
    return Response.json({ error: 'You do not have access to this contract workspace.' }, { status: 403 });
  }

  const applicationForId = (applicationId: unknown) =>
    typeof applicationId === 'string'
      ? tenderApplications.find((application) => application.id === applicationId)
      : undefined;

  try {
    const result = await updateProcurementWorkspace(tenderId, (workspace: {
      milestones: Array<Record<string, unknown>>;
      invoices: Array<Record<string, unknown>>;
      declarations: Array<Record<string, unknown>>;
      evaluations: Array<Record<string, unknown>>;
      auditEntries: Array<Record<string, unknown>>;
    }) => {
      if (body.action === 'evaluate') {
        if (!government) throw new WorkspaceActionError('Only an authorized government officer can evaluate bids.', 403);
        const application = applicationForId(body.applicationId);
        if (!application) throw new WorkspaceActionError('Select an application for this contract.');
        const officerDeclarations = workspace.declarations.filter((declaration) =>
          declaration.declaredBy === user.id &&
          declaration.declarationType === 'Officer' &&
          declaration.applicationId === application.id,
        );
        if (officerDeclarations.some((declaration) => declaration.noConflict === false)) {
          throw new WorkspaceActionError('A potential conflict was disclosed. Another officer must evaluate this bid.', 403);
        }
        if (!officerDeclarations.some((declaration) => declaration.noConflict === true)) {
          throw new WorkspaceActionError('Record a no-conflict officer declaration before evaluating this bid.', 409);
        }
        const scoreNames = ['technical', 'experience', 'compliance', 'price'];
        const scores: Record<string, number> = {};
        for (const name of scoreNames) {
          const score = body.scores?.[name];
          if (!Number.isInteger(score) || score < 0 || score > 5) {
            throw new WorkspaceActionError(`Enter a ${name} score from 0 to 5.`);
          }
          scores[name] = score;
        }
        if (!decisions.includes(body.decision)) throw new WorkspaceActionError('Choose a valid evaluation decision.');
        if (typeof body.comments !== 'string' || body.comments.trim().length > 1000) {
          throw new WorkspaceActionError('Evaluation comments must be 1,000 characters or fewer.');
        }
        if (
          body.decision === 'Awarded' &&
          workspace.evaluations.some((item) => item.applicationId !== application.id && item.decision === 'Awarded')
        ) {
          throw new WorkspaceActionError('A contract can have only one awarded bid.', 409);
        }
        const evaluation = {
          id: crypto.randomUUID(),
          applicationId: application.id,
          scores,
          totalScore: Object.values(scores).reduce((sum, score) => sum + score, 0),
          decision: body.decision,
          comments: body.comments.trim(),
          evaluatedAt: new Date().toISOString(),
          evaluatedBy: user.id,
        };
        const index = workspace.evaluations.findIndex((item) => item.applicationId === application.id);
        if (index >= 0) workspace.evaluations[index] = evaluation;
        else workspace.evaluations.unshift(evaluation);
        addAudit(workspace, user, 'bid-evaluated', { applicationId: application.id, decision: evaluation.decision });
        return evaluation;
      }

      if (body.action === 'add-milestone') {
        if (!government) throw new WorkspaceActionError('Only the contract owner can create a milestone.', 403);
        if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) {
          throw new WorkspaceActionError('Enter a milestone title of 1 to 120 characters.');
        }
        const parsedDueDate = typeof body.dueDate === 'string'
          ? new Date(`${body.dueDate}T00:00:00.000Z`)
          : null;
        if (
          typeof body.dueDate !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ||
          !parsedDueDate ||
          !Number.isFinite(parsedDueDate.getTime()) ||
          parsedDueDate.toISOString().slice(0, 10) !== body.dueDate
        ) {
          throw new WorkspaceActionError('Enter a valid milestone due date.');
        }
        const milestone = {
          id: crypto.randomUUID(),
          title: body.title.trim(),
          dueDate: body.dueDate,
          status: 'Planned',
          evidence: '',
          updatedAt: new Date().toISOString(),
          updatedBy: user.id,
        };
        workspace.milestones.unshift(milestone);
        addAudit(workspace, user, 'milestone-created', { milestoneId: milestone.id });
        return milestone;
      }

      if (body.action === 'update-milestone') {
        const milestone = workspace.milestones.find((item) => item.id === body.milestoneId);
        if (!milestone) throw new WorkspaceActionError('Milestone not found.', 404);
        const awardedApplication = tenderApplications.some((application) =>
          workspace.evaluations.some((evaluation) =>
            evaluation.applicationId === application.id && evaluation.decision === 'Awarded',
          ),
        );
        if (!government && (!awardedApplication || user.role !== 'contractor')) {
          throw new WorkspaceActionError('Only the contract owner or awarded contractor can update progress.', 403);
        }
        if (!milestoneStatuses.includes(body.status)) throw new WorkspaceActionError('Choose a valid milestone status.');
        if (typeof body.evidence !== 'string' || body.evidence.trim().length > 1000) {
          throw new WorkspaceActionError('Progress evidence must be 1,000 characters or fewer.');
        }
        milestone.status = body.status;
        milestone.evidence = body.evidence.trim();
        milestone.updatedAt = new Date().toISOString();
        milestone.updatedBy = user.id;
        addAudit(workspace, user, 'milestone-updated', { milestoneId: String(milestone.id) });
        return milestone;
      }

      if (body.action === 'submit-invoice') {
        const application = applicationForId(body.applicationId);
        if (government || !application || user.role !== 'contractor') {
          throw new WorkspaceActionError('Only the contractor on an awarded application can submit an invoice.', 403);
        }
        const awarded = workspace.evaluations.some((evaluation) =>
          evaluation.applicationId === application.id && evaluation.decision === 'Awarded',
        );
        if (!awarded) throw new WorkspaceActionError('An invoice can be submitted only after the bid is awarded.', 409);
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
          throw new WorkspaceActionError('Enter a valid invoice amount in PGK.');
        }
        if (typeof body.invoiceNumber !== 'string' || !body.invoiceNumber.trim() || body.invoiceNumber.trim().length > 80) {
          throw new WorkspaceActionError('Enter an invoice reference of 1 to 80 characters.');
        }
        if (typeof body.description !== 'string' || !body.description.trim() || body.description.trim().length > 500) {
          throw new WorkspaceActionError('Enter an invoice description of 1 to 500 characters.');
        }
        if (workspace.invoices.some((invoice) => invoice.invoiceNumber === body.invoiceNumber.trim())) {
          throw new WorkspaceActionError('That invoice reference has already been submitted for this contract.', 409);
        }
        const invoice = {
          id: crypto.randomUUID(),
          applicationId: application.id,
          invoiceNumber: body.invoiceNumber.trim(),
          amount: Math.round(amount * 100) / 100,
          description: body.description.trim(),
          status: 'Submitted',
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedBy: user.id,
        };
        workspace.invoices.unshift(invoice);
        addAudit(workspace, user, 'invoice-submitted', { applicationId: application.id, invoiceId: invoice.id });
        return invoice;
      }

      if (body.action === 'update-invoice') {
        if (!government) throw new WorkspaceActionError('Only the contract owner can update invoice status.', 403);
        const invoice = workspace.invoices.find((item) => item.id === body.invoiceId);
        if (!invoice) throw new WorkspaceActionError('Invoice not found.', 404);
        if (!invoiceStatuses.includes(body.status)) throw new WorkspaceActionError('Choose Approved, Rejected, or Paid.');
        const allowedTransitions: Record<string, string[]> = {
          Submitted: ['Approved', 'Rejected'],
          Approved: ['Paid'],
        };
        if (!allowedTransitions[String(invoice.status)]?.includes(body.status)) {
          throw new WorkspaceActionError('This invoice status transition is not allowed.', 409);
        }
        invoice.status = body.status;
        invoice.updatedAt = new Date().toISOString();
        invoice.updatedBy = user.id;
        addAudit(workspace, user, 'invoice-status-updated', {
          applicationId: String(invoice.applicationId),
          invoiceId: String(invoice.id),
          status: String(invoice.status),
        });
        return invoice;
      }

      if (body.action === 'declare-conflict') {
        const application = body.applicationId ? applicationForId(body.applicationId) : undefined;
        if (body.applicationId && !application) throw new WorkspaceActionError('Select an application in this contract.');
        if (!government && (!application || user.role !== 'contractor')) {
          throw new WorkspaceActionError('Contractors must select their own application to make a declaration.', 403);
        }
        if (typeof body.noConflict !== 'boolean') throw new WorkspaceActionError('Choose whether a conflict of interest exists.');
        if (typeof body.statement !== 'string' || body.statement.trim().length < 10 || body.statement.trim().length > 1000) {
          throw new WorkspaceActionError('Enter a declaration statement of 10 to 1,000 characters.');
        }
        const declaration = {
          id: crypto.randomUUID(),
          applicationId: application?.id || null,
          declarationType: government ? 'Officer' : 'Contractor',
          noConflict: body.noConflict,
          statement: body.statement.trim(),
          declaredAt: new Date().toISOString(),
          declaredBy: user.id,
          declarerName: user.fullName,
        };
        workspace.declarations.unshift(declaration);
        addAudit(workspace, user, 'conflict-declaration-recorded', {
          ...(application ? { applicationId: application.id } : {}),
          declarationId: declaration.id,
        });
        return declaration;
      }

      throw new WorkspaceActionError('Unknown workspace action.');
    });

    return Response.json({ success: true, result });
  } catch (error) {
    if (error instanceof WorkspaceActionError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
