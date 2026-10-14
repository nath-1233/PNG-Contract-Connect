import { getCurrentUser } from '@/lib/auth';
import { addApplication, getApplicationsForUser } from '@/lib/data-store';

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const applications = await getApplicationsForUser(user.id);
  return Response.json({ applications });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== 'contractor') {
    return Response.json({ error: 'Only contractors can submit an application.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  if (!body.tenderId || !body.tenderTitle) {
    return Response.json({ error: 'Tender information is required.' }, { status: 400 });
  }

  const application = await addApplication({
    userId: user.id,
    tenderId: body.tenderId,
    tenderTitle: body.tenderTitle,
    organization: user.organization,
  });

  return Response.json({ success: true, application }, { status: 201 });
}
