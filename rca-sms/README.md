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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Royal Crown Academy portal: security model

- **Login** uses Supabase Auth (`/api/auth/login`). The session is an HTTP-only cookie, and `src/proxy.ts` checks it on every request.
- **Roles** come from `staff.role` (linked through `staff.auth_user_id`) or from a student record (`students.portal_user_id`, which gives the `STUDENT_PARENT` role). `proxy.ts` blocks pages the role can't access, and each API route checks the role again with `requireRole()`.
- **Row Level Security**: `supabase/migrations/20261023000000_secure_auth_rls.sql` replaces the old `USING (true)` policies. The anon key on its own can't read or write any table.
- **Service-role key** is server-only (`getSupabaseAdminClient`). Never give it a `NEXT_PUBLIC_` prefix.

### Upgrading an existing Supabase project

1. Run `supabase/migrations/20261023000000_secure_auth_rls.sql` in the Supabase SQL editor. On a new project, run `supabase/schema.sql` and then `supabase/seed.sql`.
2. Create logins with `node scripts/create-login.mjs` (see `TESTERS_CREDENTIALS_AND_DEPLOYMENT_GUIDE.md`).

### Local development with the Supabase CLI

```bash
npx supabase start          # applies supabase/migrations + seed.sql
cp .env.example .env.local  # fill in the URL / keys printed by `supabase start`
npm run dev
```
