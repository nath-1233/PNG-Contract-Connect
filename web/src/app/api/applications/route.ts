import { getCurrentUser } from '@/lib/auth';
import {
  addApplication,
  getApplications,
  getApplicationsForUser,
  getTenderById,
  getTenders,
  getUsers,
} from '@/lib/data-store';

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
};

type ApplicantRecord = {
  id: string;
  fullName: string;
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 });
  }

  if (user.role === 'contractor') {
    const applications = await getApplicationsForUser(user.id);
    return Response.json({ applications });
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

  return Response.json({ applications });
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

  const application = await addApplication({
    userId: user.id,
    tenderId: tender.id,
    tenderTitle: tender.title,
    organization: user.organization,
    proposal: body.proposal.trim(),
  });

  return Response.json({ success: true, application }, { status: 201 });
}
