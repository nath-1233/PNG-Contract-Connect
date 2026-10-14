'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Application = {
  tenderId: string;
};

type UploadedDocument = {
  key: string;
  name: string;
  contentType: string;
  size: number;
  signature: string;
};

type UploadResponse = {
  uploadUrl: string;
  fields: Record<string, string>;
  key: string;
  name: string;
  contentType: string;
};

function getFileSignature(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export default function ApplyForm({ tenderId }: { tenderId: string }) {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [proposal, setProposal] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadApplicationStatus() {
      try {
        const sessionResponse = await fetch('/api/auth/session');
        if (!sessionResponse.ok) return;
        const sessionData = await sessionResponse.json();
        if (!active) return;
        setRole(sessionData.user?.role || null);

        if (sessionData.user?.role === 'contractor') {
          const response = await fetch('/api/applications');
          if (!response.ok) throw new Error('Unable to check your applications.');
          const data = await response.json();
          if (active) setHasApplied((data.applications as Application[]).some((application) => application.tenderId === tenderId));
        }
      } catch (statusError) {
        if (active) setError(statusError instanceof Error ? statusError.message : 'Unable to check your applications.');
      }
    }

    void loadApplicationStatus();
    return () => {
      active = false;
    };
  }, [tenderId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const documents = [...uploadedDocuments];
      const pendingFiles = selectedFiles.filter((file) =>
        !documents.some((document) => document.signature === getFileSignature(file)),
      );
      if (documents.length + pendingFiles.length > 5) {
        throw new Error('Attach no more than 5 bid documents.');
      }
      for (const file of selectedFiles) {
        const signature = getFileSignature(file);
        if (documents.some((document) => document.signature === signature)) continue;

        const uploadResponse = await fetch('/api/bid-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenderId,
            name: file.name,
            contentType: file.type,
            size: file.size,
          }),
        });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadData.error || 'Unable to prepare secure document upload.');

        const upload = uploadData as UploadResponse;
        const formData = new FormData();
        Object.entries(upload.fields).forEach(([key, value]) => formData.append(key, value));
        formData.append('file', file);
        const storageResponse = await fetch(upload.uploadUrl, { method: 'POST', body: formData });
        if (!storageResponse.ok) throw new Error('A document could not be uploaded. Check the file and try again.');

        documents.push({
          key: upload.key,
          name: upload.name,
          contentType: upload.contentType,
          size: file.size,
          signature,
        });
        setUploadedDocuments([...documents]);
      }
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenderId,
          proposal,
          documents: documents.map(({ key, name, contentType, size }) => ({ key, name, contentType, size })),
        }),
      });
      const data = await response.json();

      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Unable to submit your application.');
      setSubmitted(true);
      setHasApplied(true);
      setSelectedFiles([]);
      setUploadedDocuments([]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your application.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6">
      {error ? <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {submitted || hasApplied ? (
        <p role="status" className="rounded-2xl bg-emerald-100 p-4 text-sm font-semibold text-emerald-800">
          {submitted ? 'Your application has been submitted to the organization.' : 'You have already applied for this contract.'}
        </p>
      ) : role === 'contractor' ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="proposal" className="block text-sm font-medium text-sky-100">Your bid summary</label>
          <textarea
            id="proposal"
            required
            minLength={20}
            rows={4}
            value={proposal}
            onChange={(event) => setProposal(event.target.value)}
            placeholder="Describe your proposed approach and relevant experience (at least 20 characters)."
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none placeholder:text-sky-200 focus:border-white"
          />
          <label htmlFor="bid-documents" className="block text-sm font-medium text-sky-100">
            Supporting documents <span className="font-normal text-sky-200">(PDF, DOCX, XLSX, JPG or PNG; max 10 MB each, up to 5)</span>
          </label>
          <input
            id="bid-documents"
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png"
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              setSelectedFiles(files);
              setError(files.length > 5 ? 'Attach no more than 5 bid documents.' : '');
            }}
            className="w-full text-sm text-sky-100 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold file:text-[#0d3b66]"
          />
          {uploadedDocuments.length ? (
            <div className="space-y-1 text-xs text-sky-100" role="status">
              <p>{uploadedDocuments.length} document{uploadedDocuments.length === 1 ? '' : 's'} uploaded to encrypted storage; malware scanning is required before submission.</p>
              {uploadedDocuments.map((document) => (
                <div key={document.signature} className="flex items-center justify-between gap-2">
                  <span className="truncate">{document.name}</span>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setUploadedDocuments((current) => current.filter((item) => item.signature !== document.signature));
                      setSelectedFiles((current) => current.filter((file) => getFileSignature(file) !== document.signature));
                    }}
                    className="shrink-0 font-semibold underline disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <button disabled={submitting} type="submit" className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0d3b66] hover:bg-slate-100 disabled:opacity-60">
            {submitting ? 'Submitting...' : 'Submit application'}
          </button>
        </form>
      ) : role ? (
        <p className="rounded-2xl bg-white/10 p-4 text-sm text-sky-100">Sign in with a contractor account to apply.</p>
      ) : (
        <Link href="/login" className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0d3b66] hover:bg-slate-100">
          Sign in to apply
        </Link>
      )}
    </div>
  );
}
