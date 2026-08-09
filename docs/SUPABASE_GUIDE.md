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

## Step 7 — Join requests & Questions inboxes (two small tables)

The **Join the Academy** page has two public forms: *Apply now* and
*Just have a question?*. To receive both in **Admin → Join Requests** from any
device, create two small tables. Supabase → **SQL Editor** → **New query**,
paste this, **Run**:

```sql
create table public.join_requests (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null, age integer, email text not null,
  level text, description text, status text not null default 'new'
);
alter table public.join_requests enable row level security;
create policy "anyone can apply" on public.join_requests for insert with check (true);
create policy "coach reads" on public.join_requests for select using (auth.role() = 'authenticated');
create policy "coach updates" on public.join_requests for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "coach deletes" on public.join_requests for delete using (auth.role() = 'authenticated');
```

…then **Run** this second block too (the questions inbox):

```sql
create table public.questions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null, age integer, email text not null,
  level text, question text not null, status text not null default 'new'
);
alter table public.questions enable row level security;
create policy "anyone can ask" on public.questions for insert with check (true);
create policy "coach reads questions" on public.questions for select using (auth.role() = 'authenticated');
create policy "coach updates questions" on public.questions for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "coach deletes questions" on public.questions for delete using (auth.role() = 'authenticated');
```

> **Already created `join_requests` earlier?** Skip the first block, run only
> the second one (re-running the first just shows an "already exists" error —
> harmless, but it stops the rest of that query).

What these rules mean: **anyone on the internet can SEND an application or a
question** (insert), but **only you — logged in — can read, mark-as-read, or
delete them**. Visitors can never see other people's messages.

> **Forgot this step?** No problem — the app notices and the
> **Admin → Join Requests** tab shows you exactly the SQL of whichever table
> is missing, with a copy button. Messages sent before a table exists are kept
> safely in the browser that sent them (nothing crashes).

---

## Security checklist (5 minutes, do these once)

1. **Change your password via the app's Settings** (Admin → Settings → Change Admin Password). One change updates BOTH the offline panel and the online Supabase login. Never change it from the Supabase dashboard alone — if you do, the app will refuse the old local fallback while online (recover via dashboard → Authentication → Users).
2. **Pick a strong, unique password** (8+ chars, letters + numbers, never reused anywhere else). Anyone on the internet can see your coach email and try to guess — the password is the only real lock, and Supabase rate-limits guesses server-side.
3. In Supabase → **Authentication → Sign In / Up → Password Protections**, enable **"Leaked password protection"** (HaveIBeenPwned check) — free, one toggle.
4. **Do NOT put secrets in `js/supabase-config.js`** beyond the 3 values — the anon key there is safe to be public (it can only read public data + receive form submissions).
5. If you ever posted a **JSON backup** anywhere public, treat the password inside it as burned and change it (backups contain the local password hash).

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
| Join Requests tab shows a gold setup card | The `join_requests` and/or `questions` table (or their policies) are missing — run the Step 7 SQL once (the tab shows exactly the missing one with a copy button). Until then, messages arrive in the sender's own browser only. |
