import { getCurrentUser } from '@/lib/auth';
import { createTender, getTenders } from '@/lib/data-store';

export async function GET() {
  const tenders = await getTenders();
  return Response.json({ tenders });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || !['government', 'admin'].includes(user.role)) {
    return Response.json({ error: 'Only government users can publish tenders.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const requiredFields = ['title', 'department', 'location', 'category', 'value', 'deadline', 'closing', 'summary'];

  if (!body || requiredFields.some((field) => typeof body[field] !== 'string' || !body[field].trim())) {
    return Response.json({ error: 'Complete all required tender details before publishing.' }, { status: 400 });
  }

  if (
    (body.requirements !== undefined && (!Array.isArray(body.requirements) || body.requirements.some((item: unknown) => typeof item !== 'string'))) ||
    (body.documents !== undefined && (!Array.isArray(body.documents) || body.documents.some((item: unknown) => typeof item !== 'string')))
  ) {
    return Response.json({ error: 'Tender requirements and documents must be lists of text.' }, { status: 400 });
  }

  const tender = await createTender({
    ...body,
    publisherId: user.id,
    publisherOrganization: user.organization,
    status: 'Open',
  });

  return Response.json({ success: true, tender }, { status: 201 });
}
