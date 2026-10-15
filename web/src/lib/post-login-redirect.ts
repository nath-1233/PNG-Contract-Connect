export function getSafeInternalRedirectPath(candidate: string | null, fallbackPath: string) {
  if (!candidate?.startsWith('/')) return fallbackPath;

  try {
    const redirect = new URL(candidate, 'https://png-contract-connect.invalid');
    if (redirect.origin !== 'https://png-contract-connect.invalid') return fallbackPath;
    return `${redirect.pathname}${redirect.search}${redirect.hash}`;
  } catch {
    return fallbackPath;
  }
}
