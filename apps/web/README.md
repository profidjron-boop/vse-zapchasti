# Web app

Frontend for the "Все запчасти" project.

## Stack

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- Vitest
- Playwright

## Main areas

- Public storefront
- Parts catalog
- Product page
- Cart and favorites
- Account orders
- Admin panel

## Important directories

- `src/app` — routes and pages
- `public` — static assets

## Environment

Use example files as the source of truth:

- `.env.example`
- `.env.prod.example`

Do not commit working `.env` files.

## Scripts

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run start
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:e2e
