import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { getCurrentUser } from '@/lib/auth';
import { getApplications, getApplicationsForUser, getTenderById } from '@/lib/data-store';
import {
  BidDocumentError,
  createBidDocumentClient,
  getBidDocumentConfig,
  getBidDocumentScanStatus,
  type BidDocumentReference,
} from '@/lib/bid-document-storage';

type ApplicationWithDocuments = {
  id: string;
  tenderId: string;
  userId: string;
  documents?: BidDocumentReference[];
};

function canAccessTender(user: { id: string; role: string; organization: string }, tender: {
  publisherId?: string;
  department?: string;
}) {
  return user.role === 'admin' || (
    user.role === 'government' &&
    (tender.publisherId === user.id ||
      (!tender.publisherId && tender.department?.toLowerCase() === user.organization.toLowerCase()))
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string; index: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Authentication required.' }, { status: 401 });

  const { applicationId, index: indexParam } = await params;
  if (!/^(0|[1-9]\d*)$/.test(indexParam)) {
    return Response.json({ error: 'Document not found.' }, { status: 404 });
  }
  const index = Number(indexParam);
  const applications = (user.role === 'contractor'
    ? await getApplicationsForUser(user.id)
    : ['government', 'admin'].includes(user.role)
      ? await getApplications()
      : []) as ApplicationWithDocuments[];
  const application = applications.find((item) => item.id === applicationId);
  if (!application) return Response.json({ error: 'Document not found.' }, { status: 404 });
  if (user.role === 'contractor' && application.userId !== user.id) {
    return Response.json({ error: 'You do not have permission to access this document.' }, { status: 403 });
  }

  const tender = await getTenderById(application.tenderId);
  if (!tender) return Response.json({ error: 'Contract not found.' }, { status: 404 });
  if (user.role !== 'contractor' && !canAccessTender(user, tender)) {
    return Response.json({ error: 'You do not have permission to access this document.' }, { status: 403 });
  }

  const document = application.documents?.[index];
  if (!document) return Response.json({ error: 'Document not found.' }, { status: 404 });

  try {
    const { bucket } = getBidDocumentConfig();
    const client: S3Client = createBidDocumentClient();
    const scanStatus = await getBidDocumentScanStatus(client, bucket, document.key);
    if (scanStatus !== 'NO_THREATS_FOUND') {
      throw new BidDocumentError('This document is not available until its security scan has passed.', 409);
    }

    const safeName = encodeURIComponent(document.name);
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: document.key,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${safeName}`,
        ResponseContentType: document.contentType,
      }),
      { expiresIn: 60 },
    );
    return Response.redirect(url, 303);
  } catch (error) {
    if (error instanceof BidDocumentError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('Unable to retrieve a secure bid document:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: 'Secure bid document storage is temporarily unavailable.' }, { status: 503 });
  }
}
