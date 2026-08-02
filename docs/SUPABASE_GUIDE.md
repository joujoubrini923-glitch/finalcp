# Taking Abdelmajid CP Online with Supabase

This guide moves your site from *"data lives in your browser"* to *"one shared
online database every visitor sees"*. You keep the same app, the same admin
panel — edits just publish instantly for everyone.

> ⏱ ~15 minutes · free tier is more than enough · no server code, no build step.

---

## How it works (30 seconds)

- All app data is stored as **one JSON document** in a Supabase (Postgres) table.
- **Everyone can read it.** Your students just open the site.
- **Only you can write it.** Logging into the admin panel now signs you into a
  real Supabase account. Row Level Security on the database blocks everyone else,
  even if they know your keys.
- The **anon key** you'll paste in the config is *safe to publish* — it is a
  public, read-only key by design (security comes from the database rules, not
  from hiding the key).
- Local Storage stays as an offline cache, so the site still opens instantly and
  works even if Supabase is unreachable.

---

## Step 1 — Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → **Start your project** → sign up
   (GitHub login works great).
2. Click **New project**:
   - **Name:** `abdelmajid-cp` (anything)
   - **Database password:** click *Generate* and **save it somewhere** (you
     rarely need it again, but keep it)
   - **Region:** pick the closest to you (e.g. `Frankfurt` / `eu-central`)
3. Wait ~1 minute while the project is created.

## Step 2 — Create the table + security rules

1. In the left sidebar, click **SQL Editor** → **New query**.
2. Paste **all** of this and press **Run**:

```sql
-- one table that holds the entire app state as a single JSON document
create table public.app_state (
  id integer primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- the single row the whole site reads & writes
insert into public.app_state (id, data) values (1, '{}'::jsonb);

-- security: everyone may READ, only the signed-in coach may WRITE
alter table public.app_state enable row level security;

create policy "public read access"
  on public.app_state for select
  using (true);

create policy "coach insert access"
  on public.app_state for insert
  with check (auth.role() = 'authenticated');

create policy "coach update access"
  on public.app_state for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
```

3. You should see `Success. No rows returned`. ✅

## Step 3 — Create the coach account

1. Sidebar → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Fill in:
   - **Email:** your email, e.g. `coach@example.com`
   - **Password:** ⚠️ use the **same password as your site's admin panel**
     (default is `admin123` — you can change both later in one click from
     Admin → Settings; the site keeps them in sync)
3. Turn **Auto Confirm User** **ON** (so you don't need to confirm by email).
4. **Create user**. ✅

## Step 4 — Get your API values

Sidebar → **Project Settings** (gear icon) → **API**. Copy:

- **Project URL** → looks like `https://abcdefghijklm.supabase.co`
- Under **Project API keys** → the **`anon` `public`** key → starts with `eyJ...`
  (⚠️ *never* copy the `service_role` key anywhere — anon only!)

## Step 5 — Fill the config & publish

1. In your website folder (locally, or directly on GitHub via the pencil icon),
   open **`js/supabase-config.js`** and fill the 3 values:

```js
window.SUPABASE_CONFIG = {
  url: 'https://abcdefghijklm.supabase.co',
  anonKey: 'eyJhbGciOi...your-long-anon-key...',
  coachEmail: 'coach@example.com',
};
```

2. Commit & push. GitHub Pages updates in about a minute.

## Step 6 — First login = automatic migration 🎉

1. Open your live site.
2. Go to the **Admin panel** (lock icon) and log in with the password from Step 3.
3. On your very first login you'll see a toast:
   **"Your data was uploaded to the cloud — everything is online now!"**
   — that's your existing browser data (students, scores, coach profile…)
   being published.
4. Done. Every edit you make from now on syncs to the cloud ~1 second after you
   stop typing, from any device.

### Verify it works

- Open the site **in an incognito window or on your phone** → same data. ✅
- Supabase → **Table Editor** → `app_state` → you'll see row `1` with your data
  and a fresh `updated_at` timestamp after every edit.

You can check sync status anytime in **Admin → Backup & Data** — it shows
either `☁ signed in — edits go live instantly` or `☁ read-only`.

---

## Things worth knowing

- **Visitors see updates on their next page load/refresh** (there's no live
  push to already-open pages — refreshing shows the latest).
- **Keep exporting backups** (Admin → Backup & Data → Export JSON). It takes
  10 seconds and protects you from accidents. The file works on any copy of the
  site, online or offline.
- **Changing the admin password** (Admin → Settings) now also updates your
  Supabase login automatically.
- **Multiple devices:** just log in with the same email+password. There's one
  shared document, so whoever edits last wins — avoid editing from two places
  at the exact same moment.
- **Free-tier pause:** Supabase pauses projects after ~1 week of *database*
  inactivity. If the site shows "Cloud sync failed" toasts, open your Supabase
  dashboard and click **Restore project** — data is never lost on the free
  tier's pause.
- **Turning it off:** empty the 3 values in `js/supabase-config.js` and the app
  instantly goes back to fully-offline Local Storage mode.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Login says *"Invalid login credentials"* | The user doesn't exist yet (Step 3), the password differs, or the email in `supabase-config.js` doesn't match the Auth user's email. |
| Toasts say *"Cloud sync failed"* | Supabase project paused (open dashboard → Restore), no internet, or the write policies in Step 2 weren't applied (re-run that SQL). |
| Public site shows demo data, not yours | The migration only runs when the coach is logged in. Log into the admin panel once. |
| Nothing about the cloud works at all | Check the 3 values in `js/supabase-config.js` are filled and pushed, and that the page was hard-refreshed (`Ctrl+Shift+R`). |
| "Row level security" errors in the browser console | Re-run the full SQL from Step 2 — the three policies are required. |
