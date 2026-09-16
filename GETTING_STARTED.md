# Getting Started (self-hosted)

A step-by-step walkthrough for running this app yourself. It assumes you already
have a [Supabase](https://supabase.com) account and an [ElevenLabs](https://elevenlabs.io)
account. Total time: about 15 minutes.

The app has three parts:

| Part | What it does | Where it runs |
|---|---|---|
| **This Next.js app** | Dashboard, broadcaster page, viewer page | Your machine (`pnpm dev`) or Vercel |
| **Supabase** | Auth, the `events` / `captions` tables, and Realtime (pushes captions to viewers) | Supabase cloud (or local Docker) |
| **ElevenLabs Scribe** | Speech-to-text. The server mints a short-lived token; the browser streams mic audio straight to ElevenLabs | ElevenLabs cloud |

GitHub OAuth is **optional** — the sign-in and sign-up pages support plain
email + password, so you can skip it entirely. See the end of this doc if you want it.

---

## Step 1 — Install

You need **Node.js 18+** (22 is what this was verified with) and **pnpm**.

```bash
git clone https://github.com/Trivency/captions.events
cd captions.events
pnpm install
```

`pnpm install` prints a warning that it *ignored build scripts for sharp*. That's fine —
`next.config.mjs` sets `images.unoptimized: true`, so `sharp` is never used.

## Step 2 — Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**. Any region, any name.
   Save the database password somewhere (you only need it for the CLI path below).
2. Wait for the project to finish provisioning (about a minute).

### 2a. Create the tables

There are three SQL migration files in `supabase/migrations/`. Run them **in filename order**.

**Easiest: SQL Editor**

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the contents of `supabase/migrations/20251031162352_events.sql` → **Run**.
3. Repeat for `20251031162420_captions.sql`, then `20251103000000_add_language_code.sql`.

**Alternative: Supabase CLI** (already installed as a dev dependency)

```bash
pnpm supabase login
pnpm supabase link --project-ref <your-project-ref>   # ref is in the dashboard URL
pnpm supabase db push
```

Either way, confirm it worked: **Table Editor** should show `events` and `captions`.

### 2b. Turn off email confirmation (for development)

By default a cloud Supabase project requires new users to click a confirmation email
before they can sign in. For getting started, turn that off:

**Authentication → Providers → Email** → toggle **Confirm email** off → **Save**.

(You can turn it back on later; if you do, add your app URL under
**Authentication → URL Configuration → Redirect URLs** so the confirmation link works.)

### 2c. Copy the API credentials

**Project Settings → API**. You need two values:

- **Project URL** (looks like `https://abcdefgh.supabase.co`)
- **anon / public** key (the long `eyJ...` string — *not* the `service_role` key)

## Step 3 — Get an ElevenLabs API key

<https://elevenlabs.io> → click your profile (bottom-left) → **API Keys** → **Create API Key**.
Copy it now; it's only shown once.

The app uses the `scribe_realtime_v2` model via a single-use token. If you create a
*restricted* key, it needs access to **Speech to Text**.

## Step 4 — Write `.env.local`

In the project root, create a file called `.env.local` (it's git-ignored):

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ELEVENLABS_API_KEY=sk_...
```

That's all four. (`example.env.local` also lists `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`;
it's only used as an override for the email-confirmation redirect and you can leave it out.)

## Step 5 — Run it

```bash
pnpm dev
```

Open <http://localhost:3000> **in Chrome** (see "Browser requirements" below).

## Step 6 — Do a full test run

1. **Sign up**: click *Get Started* / go to `/auth/signup`, enter an email + password,
   accept the terms. Because you disabled confirmation in Step 2b you can sign in right away.
2. **Sign in** at `/auth/signin` → you land on `/dashboard`.
3. **Create an event**: *Create Event* → give it a title → it redirects you to `/broadcast/<uid>`.
4. **Broadcast**: click **Start Recording**, allow microphone access, and talk. Partial
   text appears as you speak; finished sentences are saved to the `captions` table.
5. **View**: the broadcast page shows a shareable viewer link (`/view/<uid>`). Open it in a
   second tab, another browser, or your phone. Captions should appear within a second of
   you speaking. No login is needed on the viewer page.
6. **Translate** (optional): on the viewer page, pick a language from the dropdown.
   Chrome downloads a small translation model the first time, then translates on-device.

If all six steps work, you're done.

---

## Browser requirements

- **Broadcaster page**: use **Chrome**. It needs microphone access and uses Chrome's
  built-in Language Detector API to tag each caption with a language. Other browsers can
  still record (language detection is skipped), but Chrome is the tested path.
- **Viewer page**: works in any modern browser. The on-device **translation** dropdown
  only works in **Chrome 138+** (it uses the built-in Translator API); other browsers just
  show captions in the original language.
- **Microphone only works on `localhost` or HTTPS.** If you open the broadcaster from
  another device using your LAN IP (`http://192.168.x.x:3000`), Chrome will refuse mic
  access. Use `localhost` on the machine that's recording, or deploy to Vercel.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Sign-up says "check your email" and you can't sign in | Email confirmation is still on. Step 2b, or click the link in the email. |
| `Server configuration error` when you click Start Recording | `ELEVENLABS_API_KEY` is missing from `.env.local`. Restart `pnpm dev` after editing env vars. |
| `Failed to generate token` | The ElevenLabs key is invalid or lacks Speech-to-Text permission. Check the terminal running `pnpm dev` for the exact API error. |
| `Unauthorized` when starting recording | You're signed out, or you're not the creator of this event. |
| Broadcaster shows captions but the viewer page doesn't update | Realtime isn't enabled for `captions`. The second migration should have done this; check **Database → Publications → supabase_realtime** includes `captions`. |
| `Error saving caption` in the browser console | RLS policy blocked the insert — the signed-in user isn't the event's `creator_id`. Make sure the migrations ran fully. |
| No microphone in the device dropdown | Page isn't on `localhost`/HTTPS, or mic permission was denied. Check the padlock icon in the address bar. |
| Translation dropdown says unsupported | Not Chrome 138+. |

## Deploying to Vercel (optional)

1. Push your fork to GitHub and import it at <https://vercel.com/new>. Vercel detects Next.js automatically.
2. Add the same four environment variables, but set
   `NEXT_PUBLIC_SITE_URL=https://<your-app>.vercel.app` (it's used to build the viewer link shown on the broadcast page).
3. In Supabase: **Authentication → URL Configuration** → set **Site URL** to your Vercel URL
   and add `https://<your-app>.vercel.app/**` to **Redirect URLs**.
4. Deploy. HTTPS is automatic, so the microphone works from any device.

## GitHub OAuth (optional)

Only if you want the "Continue with GitHub" button to work. Full walkthrough in
[GITHUB_AUTH_SETUP.md](./GITHUB_AUTH_SETUP.md); the short version:

1. <https://github.com/settings/developers> → **New OAuth App**. Callback URL must be your
   **Supabase** callback: `https://<project-ref>.supabase.co/auth/v1/callback`
   (find it in Supabase → Authentication → Providers → GitHub).
2. Paste the Client ID + Secret into Supabase → **Authentication → Providers → GitHub** → enable → Save.
3. Add `http://localhost:3000/**` to Supabase → **Authentication → URL Configuration → Redirect URLs**
   so Supabase is allowed to send you back to the app's `/auth/callback` route.

## Running Supabase locally instead (optional, needs Docker)

If you'd rather not use a cloud project during development:

```bash
pnpm supabase start
```

This starts Postgres, Auth, and Realtime in Docker, applies the migrations, and prints an
**API URL** (`http://127.0.0.1:54321`) and **anon key** — use those in `.env.local`. Email
confirmation is already disabled in `supabase/config.toml`. Studio is at <http://127.0.0.1:54323>.
