import { getCurrentUser } from '@/lib/auth';
import {
  addApplication,
  getApplications,
  getApplicationsForUser,
  getTenderById,
  getTenders,
  getUsers,
} from '@/lib/data-store';
import { getProcurementWorkspace } from '@/lib/procurement-workspace';
import {
  BidDocumentError,
  createBidDocumentClient,
  getBidDocumentConfig,
  type BidDocumentReference,
  validateBidDocument,
  verifyUploadedBidDocument,
} from '@/lib/bid-document-storage';

type TenderRecord = {
  id: string;
  publisherId?: string;
  department?: string;
  status: string;
};

type ApplicationRecord = {
  id: string;
  userId: string;
  tenderId: string;
  tenderTitle: string;
  status: string;
  submittedAt: string;
  organization: string;
  proposal?: string;
  documents?: BidDocumentReference[];
};

type ApplicantRecord = {
  id: string;
  fullName: string;
};

async function withEvaluationStatus<T extends ApplicationRecord>(applications: T[]) {
  return Promise.all(applications.map(async (application) => {
    const workspace = await getProcurementWorkspace(application.tenderId);
    const evaluation = workspace.evaluations.find((item: { applicationId: string }) =>
      item.applicationId === application.id,
    );
    return evaluation ? { ...application, status: evaluation.decision } : application;
  }));
}

function withDocumentLabels<T extends ApplicationRecord>(application: T) {
  const { documents, ...safeApplication } = application;
  return {
    ...safeApplication,
    ...(documents?.length
      ? { documents: documents.map((document, index) => ({ name: document.name, index })) }
      : {}),
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 });
  }

  if (user.role === 'contractor') {
    const applications = await withEvaluationStatus(await getApplicationsForUser(user.id) as ApplicationRecord[]);
    return Response.json({ applications: applications.map(withDocumentLabels) });
  }

  if (!['government', 'admin'].includes(user.role)) {
    return Response.json({ error: 'You do not have permission to view applications.' }, { status: 403 });
  }

  const [allApplications, tenders, users] = (await Promise.all([getApplications(), getTenders(), getUsers()])) as [
    ApplicationRecord[],
    TenderRecord[],
    ApplicantRecord[],
  ];
  const ownedTenderIds = new Set(
    tenders
      .filter((tender) =>
        user.role === 'admin'
          ? true
          : tender.publisherId === user.id ||
            (!tender.publisherId && tender.department?.toLowerCase() === user.organization.toLowerCase()),
      )
      .map((tender) => tender.id),
  );
  const applicantsById = new Map(users.map((applicant) => [applicant.id, applicant]));
  const applications = allApplications
    .filter((application) => ownedTenderIds.has(application.tenderId))
    .map((application) => ({
      ...application,
      applicantName: applicantsById.get(application.userId)?.fullName || 'Contractor',
    }));

  return Response.json({
    applications: (await withEvaluationStatus(applications)).map(withDocumentLabels),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== 'contractor') {
    return Response.json({ error: 'Only contractors can submit an application.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body.tenderId !== 'string' || !body.tenderId.trim()) {
    return Response.json({ error: 'Select a valid tender before applying.' }, { status: 400 });
  }

  if (typeof body.proposal !== 'string' || body.proposal.trim().length < 20) {
    return Response.json({ error: 'Provide a bid summary of at least 20 characters.' }, { status: 400 });
  }

  const inputDocuments = body.documents === undefined ? [] : body.documents;
  if (!Array.isArray(inputDocuments) || inputDocuments.length > 5) {
    return Response.json({ error: 'Attach no more than 5 bid documents.' }, { status: 400 });
  }

  const tender = await getTenderById(body.tenderId);
  if (!tender) {
    return Response.json({ error: 'This tender is no longer available.' }, { status: 404 });
  }

  if (!['Open', 'Closing Soon'].includes(tender.status)) {
    return Response.json({ error: 'Applications for this tender are closed.' }, { status: 409 });
  }

  const existingApplications = (await getApplicationsForUser(user.id)) as ApplicationRecord[];
  if (existingApplications.some((application) => application.tenderId === tender.id)) {
    return Response.json({ error: 'You have already applied for this tender.' }, { status: 409 });
  }

  try {
    const documents: BidDocumentReference[] = inputDocuments.map((item: unknown) => {
      if (!item || typeof item !== 'object') throw new BidDocumentError('An uploaded document reference is invalid.');
      const document = item as Record<string, unknown>;
      const validated = validateBidDocument(document.name, document.contentType, document.size);
      if (typeof document.key !== 'string') throw new BidDocumentError('An uploaded document reference is invalid.');
      return { key: document.key, ...validated };
    });

    if (documents.length) {
      const { bucket } = getBidDocumentConfig();
      const client = createBidDocumentClient();
      for (const document of documents) {
        await verifyUploadedBidDocument(client, bucket, tender.id, user.id, document);
      }
    }

    const application = await addApplication({
      userId: user.id,
      tenderId: tender.id,
      tenderTitle: tender.title,
      organization: user.organization,
      proposal: body.proposal.trim(),
      documents,
    });

    return Response.json({ success: true, application: withDocumentLabels(application) }, { status: 201 });
  } catch (error) {
    if (error instanceof BidDocumentError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('Unable to verify bid documents:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Bid documents could not be verified. Please try again.' }, { status: 503 });
  }
}
