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

## Contract assistant configuration

The text-only assistant uses Google Gemini through the portal's same-origin route handler. For local testing, sign in as a government or administrator user and open **Government dashboard → API settings** to save a Gemini key on the server. The key is stored in `web/.local-secrets/contract-assistant.json`, which is excluded from git. Alternatively, set `GEMINI_API_KEY` in `web/.env.local`; Next.js loads it server-side locally, and it takes priority over the key saved through the settings page. `.env.local` is ignored by git. The API key is never exposed to browser code or prefixed with `NEXT_PUBLIC_`.

The local file is intended only for a single local development server. For deployment, set `GEMINI_API_KEY` in the hosting provider's secret manager; the environment variable takes priority over the key saved through the settings page. Do not commit or share the key. Run the route tests with `npm test`.

The default model is `gemini-3.8-flash`. When that model returns a transient high-demand, capacity, or rate-limit error, the assistant retries once with the stable, low-latency `gemini-3.1-flash-lite` model. Optionally set the server-only `GEMINI_MODEL` environment variable to override the primary model. The portal calls Google's Gemini Interactions API directly at its fixed official endpoint; no provider URL is configurable by the browser.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
