# myShop

A full-stack online store built to practice and showcase real-world e-commerce engineering.

> **Status: work in progress.** This project is not finished or production-ready.

## Tech stack
- **Client:** Next.js (App Router), React
- **Server:** Node.js, Express, TypeScript
- **Database:** PostgreSQL (Supabase) with Drizzle ORM
- **Storage:** Supabase Storage (product images)
- **Email:** Brevo transactional API

## Features
- Registration and login (httpOnly cookie, bcrypt-hashed passwords)
- Email verification with a 6-digit code (expiry, attempt limit, resend cooldown)
- Roles: customer / staff / admin, enforced on the server
- Product catalog with category filter and stock status
- Persistent shopping cart for logged-in users
- Checkout with a 15-minute stock reservation (transactional, no overselling)
- Payment layer behind a provider interface (mock provider for development)
- Admin panel: add / edit / delete products, upload images, view orders
- Manual WhatsApp message links for staff

## Known limitations
- Payments use a **mock provider**. A Hyp (Max) provider is written but untested against a real terminal.
- Email sender uses a free address; a verified domain is needed for reliable delivery.
- No automated tests yet.
- Role management UI is not built yet (roles are set in the database).

## Running locally
Requires Node 20+ and a PostgreSQL database (e.g. a free Supabase project).

1. Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env.local`, then fill in the values.
2. Server:
```bash
   cd server
   npm install
   npx drizzle-kit push
   npm run seed
   npm run dev
```
3. Client (new terminal):
```bash
   cd client
   npm install
   npm run dev
```
4. Open http://localhost:3000

## Security notes
- Card data never touches this server; the payment page is hosted by the payment provider.
- Order totals are calculated on the server from database prices.
- Secrets live only in `.env` files, which are not committed.