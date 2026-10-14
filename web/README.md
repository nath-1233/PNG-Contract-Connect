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

The text-only assistant can use Google Gemini or Anthropic Claude through the portal's same-origin route handler. Set `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or both in the portal server environment; API keys must never be exposed to browser code or prefixed with `NEXT_PUBLIC_`. The provider selector remains available when a key is missing and explains which server setting is required. Run the route tests with `npm test`.

The default models are `gemini-3.8-flash` and `claude-sonnet-5-5`. Optionally set the server-only `GEMINI_MODEL` or `ANTHROPIC_MODEL` environment variables to override them. The portal calls Google's Gemini Interactions API and Anthropic's Messages API directly at their fixed official endpoints; no provider URL is configurable by the browser.

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
