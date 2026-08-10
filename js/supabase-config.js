/* ============================================================
   Abdelmajid CP — supabase-config.js (optional cloud sync)

   Fill in the 3 values from your Supabase project, then push to
   GitHub. Step-by-step: docs/SUPABASE_GUIDE.md

   The anon key is SAFE to publish here — by design it can only
   READ the site's data. Writing requires the coach login, which
   is enforced by Row Level Security rules on Supabase (not by
   hiding keys). Leave these empty to run fully offline
   (Local Storage only) — nothing breaks.
   ============================================================ */
window.SUPABASE_CONFIG = {
  url: '',        // e.g. 'https://abcdefghijklm.supabase.co'   (Dashboard → Settings → API → Project URL)
  anonKey: '',    // 'eyJhbGciOi...'                            (Settings → API → "anon" "public" key)
  coachEmail: '', // email of the coach user you create in Authentication → Users
};
