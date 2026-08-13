# Security check before publishing

No browser-only website can be made completely immune to hackers. This project is hardened, but the final protection of academy data depends on the hosting server and Supabase configuration.

## Checks completed in this version

- Public search results now pass external URLs through an HTTPS/mailto allowlist.
- Verification-log links use the same URL allowlist.
- Admin logout is a real button, not a `javascript:` URL.
- Uploaded/cloud photos are accepted as raster base64 images only before becoming `<img>` sources.
- Visitor form text is length-limited, sanitized and rendered escaped.
- Honeypot fields protect the public application/question forms.
- Password attempts are throttled in the coach panel.
- Coach sessions automatically expire after inactivity.
- The password hash is stripped from the public Supabase `app_state` document.
- Secret codes are checked by the server-side Edge Function, not in browser code.
- Supabase is loaded with a pinned version and SRI hash.
- CSP, `nosniff`, frame blocking, referrer and permissions headers are included. Deploy `_headers` on a host that supports it.

## Required before going live

1. Change the coach password in **Supabase Auth** and in the Coach Panel.
2. Never publish a Supabase `service_role` key. Only the public anon key may be in `js/supabase-config.js`.
3. Confirm Row Level Security is enabled on every Supabase table.
4. Confirm `join_requests` and `questions` allow anonymous INSERT only, and coach-authenticated SELECT/UPDATE/DELETE.
5. Confirm `verified_solves` has public SELECT but no public INSERT or UPDATE policy.
6. Deploy the `cf-verify` Edge Function with the service key stored only as a server secret.
7. Keep database backups private; exported JSON contains private academy data.
8. Add a privacy notice and obtain appropriate consent before collecting information from students, especially minors.
9. Use HTTPS hosting and deploy `_headers` if supported by the host.
10. Review public student names/photos and obtain permission before publishing them.

The frontend cannot protect a leaked Supabase service key or an incorrectly configured RLS policy. Those must be checked in the Supabase dashboard.
