# UniGuide Cameroon Admin Panel

This is the admin dashboard for the UniGuide Cameroon project.

## Backend setup

```bash
cd backend
cp .env.example .env     # then fill in MONGO_URI and SESSION_SECRET
npm install
npm run migrate          # apply database migrations (safe to run again)
npm start
```

| Command | What it does |
| --- | --- |
| `npm start` | Start the API on `PORT` (default 5000). Warns if migrations are pending. |
| `npm test` | Run the test suite (see [Tests](#tests)). |
| `npm run migrate` | Apply pending migrations. |
| `npm run migrate:status` | List migrations and whether each one is applied. |
| `npm run migrate:down` | Revert the most recent migration. |

## 🔐 Authentication

All responses are JSON, and errors look like `{ "message": "..." }`. The frontend must send every request with `credentials: 'include'` so the cookies go along.

### How a login is kept

| Cookie | Holds | Lifetime | Sent to |
| --- | --- | --- | --- |
| `uniguide.sid` | Session ID (session stored in MongoDB, `sessions` collection) | `SESSION_IDLE_MINUTES` of inactivity (default 5) | every route |
| `uniguide.rt` | Refresh token (random, stored only as a SHA-256 hash) | `REFRESH_TOKEN_DAYS` (default 7) | `/api/auth/*` only |

Both cookies are `httpOnly` (page scripts can't read them), `SameSite=Lax`, and `Secure` in production.

When the session expires, `POST /api/auth/refresh` swaps the refresh token for a new one and starts a new session. Each refresh token works once. If an already used token comes back more than 10 seconds later, someone kept a copy, so every token in that chain is revoked and the person has to log in again.

Every account has a `tokenVersion`. It goes up on every **login**, **logout** and **password reset**. Sessions and refresh tokens remember the version they were issued under and stop working once it changes. In practice an account has one active login at a time, and logging out ends it everywhere.

Passwords are hashed with **argon2id** (19 MiB memory, 2 passes). Accounts from before the switch still have bcrypt hashes; those are checked with bcrypt and upgraded to argon2id the next time the person logs in.

### Endpoints

| Method | Path | Body | Success | Notes |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | `{ name, email, password }` | `201 { message, admin }` | Doesn't log in. `409` if the email exists. |
| `POST` | `/api/auth/login` | `{ email, password }` | `200 { message, admin }` + both cookies | `400` wrong email or password, `429` locked or rate limited |
| `POST` | `/api/auth/refresh` | none (uses `uniguide.rt`) | `200 { message, admin }` + new cookies | `401` → log in again |
| `GET` | `/api/auth/me` | none | `200 { admin }` | `401` if not logged in |
| `POST` | `/api/auth/logout` | none | `200 { message }` | Works with only the refresh cookie too |
| `POST` | `/api/auth/forgot-password` | `{ email }` | `200 { message }` | Same answer whether or not the email exists |
| `POST` | `/api/auth/reset-password` | `{ token, password }` | `200 { message }` | `400` if the link is invalid, used or expired |
| `DELETE` | `/api/auth/me` | `{ password }` | `200 { message }` | Needs a session. `400` wrong password. |

`admin` is `{ id, name, email, role, tokenVersion }`. Accounts created before names were added have `name: null`; the frontend shows their email instead.

**Input rules:** emails are trimmed and lowercased, and passwords must be 8–128 characters (no composition rules, following NIST SP 800-63B).

### Password reset

1. `POST /api/auth/forgot-password` with `{ email }`. If the account exists, an email goes out with a link to `APP_URL/reset-password?token=...`. Without `SMTP_HOST` (in development), the link is printed in the server console instead.
2. The frontend's `/reset-password` page reads `token` from the URL and sends `POST /api/auth/reset-password` with `{ token, password }`.

A link works once and lasts `PASSWORD_RESET_MINUTES` (default 30). Asking for a new link cancels the old one. A successful reset ends every session and refresh token for the account, lifts any lockout, and the person then logs in with the new password.

### Rate limits and lockout

Each endpoint has its own limiter with its own counters, so using up one doesn't block the others. All of them answer `429 { message }` and send standard `RateLimit-*` headers.

| Endpoint | Limit |
| --- | --- |
| login | 10 **failed** attempts per 15 min per IP (successful logins don't count) |
| register | 5 per hour per IP |
| refresh | 60 per 15 min per IP |
| forgot-password | 5 per 15 min per IP **and** 3 per hour per email address |
| reset-password | 10 per 15 min per IP |

**Account lockout** works separately from the IP limits, so spreading guesses across many IPs doesn't help. After `LOCKOUT_THRESHOLD` wrong passwords (default 5), the account refuses logins for `LOCKOUT_MINUTES` (default 15), even with the right password. The response is `429` with a `Retry-After` header. A successful login or a password reset clears the counter.

Set `TRUST_PROXY=1` when deploying behind a proxy, so the limits see the real client IP and not the proxy's.

## Database migrations

Migrations live in `backend/migrations/` as `NNN-description.js` files exporting `{ description, up(db), down(db) }`. Applied ones are recorded in the `migrations` collection, so each runs exactly once per database.

| Migration | Does |
| --- | --- |
| `001-admin-security-fields` | Trims and lowercases emails (stops if that would merge two accounts), adds the lockout and login fields, and removes the unused `refreshToken` field. Passwords are left alone. |
| `002-auth-token-collections` | Creates `refreshtokens` and `passwordresettokens` with unique and TTL indexes, so MongoDB deletes expired tokens on its own. |

To add one, create the next numbered file and run `npm run migrate`.

## Tests

```bash
cd backend
npm test
```

The tests are Jest + Supertest, in `backend/tests/unit` (services and middleware on their own) and `backend/tests/api` (each endpoint end to end). By default they start a throwaway in-memory MongoDB. The first run downloads it, which takes a while. To use another server instead, set `TEST_MONGO_URI`. Each test file only ever creates and drops its own `uniguide_test_*` database.

## Environment

Copy `backend/.env.example` to `backend/.env`; every setting is described there. `SESSION_SECRET` is required in production, and `CLIENT_URL` lists the frontend addresses allowed to send the cookies.
