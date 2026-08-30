# Coach email notifications

This is the **email-only** notification system for Abdelmajid CP.

It sends an email immediately when:

- a new public join request is submitted;
- a student submits a new next-course request from My Space;
- a student changes their next-course availability;
- a new Code Clinic case is submitted.

It intentionally does **not** send emails for public questions, coach replies,
status changes, or local/offline submissions.

## Email contents

### Public join request

Includes the student's name, age, email, level/experience and message. It does
not include weekly availability.

### Next-course request

Includes the student's name, course level and advertisement identifier. It
does not include a reply link or private student data.

### Code Clinic

Includes the student's name, problem link, issue description and note. The
complete source code is never placed in an email; it remains in the
authenticated Coach Panel.

## Project files

- `functions/notify-coach/index.ts` — secure webhook receiver and Resend sender
- `migrations/20260830_email_notifications.sql` — private delivery log
- `../js/admin.js` — Email Notifications settings screen
- `../js/store.js` — saved coach notification email

## 1. Run the SQL migration

Open **Supabase Dashboard → SQL Editor** and run:

```text
supabase/migrations/20260830_email_notifications.sql
```

It creates a private `notification_deliveries` table used to prevent duplicate
emails and record failures. There are no anon/authenticated policies on this
table.

The migration also adds `course_ad_id` to `next_course_requests` so two ads
with the same level stay separate.

## 2. Add the notification recipient in the website

After deploying the updated frontend:

1. Open **Admin → Email Notifications**.
2. Enter your coach email address.
3. Click **Save notification email**.

The setting is stored in the synced academy settings document. Because this
is an email address, not a secret, it may be visible in the public settings
document. The Resend API key and webhook secret are never stored there.

For the first notification, also set `NOTIFY_TO_EMAIL` as the server-side
fallback below.

## 3. Resend setup

Create a Resend account and create an API key. Do not put that key in the
website JavaScript.

You answered that you do not currently control DNS for the academy domain. For
initial testing, use Resend's permitted test sender:

```text
Abdelmajid CP <onboarding@resend.dev>
```

It can send test notifications to the verified Resend account email. Later,
when you can edit DNS, verify `abdelmajidbrini.tn` and change the sender to,
for example:

```text
Abdelmajid CP <notifications@abdelmajidbrini.tn>
```

## 4. Store Supabase secrets

From the project directory:

```bash
export NOTIFY_WEBHOOK_SECRET="$(openssl rand -hex 32)"

supabase secrets set \
  RESEND_API_KEY="re_replace_me" \
  NOTIFY_TO_EMAIL="your-coach-email@example.com" \
  NOTIFY_FROM_EMAIL="Abdelmajid CP <onboarding@resend.dev>" \
  NOTIFY_WEBHOOK_SECRET="$NOTIFY_WEBHOOK_SECRET"
```

Keep the value of `NOTIFY_WEBHOOK_SECRET`; it is needed for the webhook
headers. Never commit it or put it in the frontend.

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge
Functions automatically. The service-role key is used only inside the server
function.

## 5. Deploy the email function

```bash
supabase functions deploy notify-coach \
  --project-ref xfrsdzpraimwdxgkzuso \
  --no-verify-jwt
```

`--no-verify-jwt` is intentional: the function authenticates Database
Webhooks with the separate high-entropy `x-notify-secret` header.

Function URL:

```text
https://xfrsdzpraimwdxgkzuso.supabase.co/functions/v1/notify-coach
```

## 6. Create Database Webhooks

In **Supabase Dashboard → Database → Webhooks**, create these webhooks with
method **POST**, the function URL above, and this custom header:

```text
x-notify-secret: YOUR_NOTIFY_WEBHOOK_SECRET
```

Create these events:

| Webhook | Table | Event |
|---|---|---|
| Coach email — join request | `join_requests` | `INSERT` |
| Coach email — next-course request | `next_course_requests` | `INSERT` |
| Coach email — next-course availability update | `next_course_requests` | `UPDATE` |
| Coach email — Code Clinic | `clinic_cases` | `INSERT` |

The function ignores next-course updates when the availability did not change.
It also ignores join-request and clinic updates.

## 7. Test safely

Submit one real test item, then check:

- Resend → Emails
- Supabase → Edge Functions → `notify-coach` → Logs
- SQL Editor:

```sql
select source_table, source_id, to_email, status, attempts, sent_at, error_message
from public.notification_deliveries
order by created_at desc
limit 20;
```

A successful delivery has `status = 'sent'`.

## Security notes

- Email is an alert channel, not a secure place for passwords or source code.
- The Code Clinic email never includes the full submitted code.
- The Resend key, webhook secret and service-role key remain server-side.
- Database Webhooks are accepted only with the high-entropy custom secret.
- Duplicate webhook retries are deduplicated.
- Failed sends are logged and returned as a server error so the webhook can
  retry. Check `notification_deliveries` and Edge Function logs if a message
  does not arrive.
- The system sends nothing when the browser is working only in local/offline
  mode; the row must reach Supabase first.
