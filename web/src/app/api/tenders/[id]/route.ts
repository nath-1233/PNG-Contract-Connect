import { getTenderById } from '@/lib/data-store';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tender = await getTenderById(id);

  if (!tender) {
    return Response.json({ error: 'Tender not found.' }, { status: 404 });
  }

  return Response.json({ tender });
}
