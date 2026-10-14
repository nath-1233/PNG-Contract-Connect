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

  const body = await request.json().catch(() => ({}));

  const tender = await createTender({
    title: body.title,
    department: body.department,
    location: body.location,
    category: body.category,
    value: body.value,
    deadline: body.deadline,
    closing: body.closing,
    summary: body.summary,
    requirements: body.requirements || [],
    documents: body.documents || [],
    status: 'Open',
  });

  return Response.json({ success: true, tender }, { status: 201 });
}
