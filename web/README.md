This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Secure bid-document storage

Bid attachments use private Amazon S3 storage in `ap-southeast-2` with server-side AWS KMS encryption. Uploads are accepted only when the storage bucket and KMS key are configured; a bid cannot be submitted and a document cannot be downloaded until its S3 object has the GuardDuty tag `GuardDutyMalwareScanStatus=NO_THREATS_FOUND`.

Configure these server-only environment variables in the deployment environment:

```text
BID_DOCUMENTS_BUCKET=<private S3 bucket name>
BID_DOCUMENTS_REGION=ap-southeast-2
BID_DOCUMENTS_KMS_KEY_ID=<customer-managed KMS key ARN or ID>
```

Provide AWS credentials through the deployment's server-side AWS credential provider or an appropriately scoped IAM role. Never put credentials in browser-visible `NEXT_PUBLIC_*` variables or commit them to the repository. Configure the bucket with Block Public Access, bucket-owner-enforced object ownership, TLS-only access, KMS encryption, GuardDuty Malware Protection for S3 scanning the `bids/` prefix and writing scan-status tags, and an S3 CORS policy allowing `POST` only from the exact deployed website origin. The signed upload policy forbids client-supplied object tags so bidders cannot forge GuardDuty scan results. The application enforces the clean-scan tag, but cloud-side bucket, IAM, KMS, GuardDuty, and CORS policies must be configured and verified separately before handling real procurement bids.

Uploads are limited to five PDF, DOCX, XLSX, JPG, or PNG files of at most 10 MB each. AWS setup and credentials are not included in the local application; without them, upload creation returns a configuration error and does not fall back to local storage.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
