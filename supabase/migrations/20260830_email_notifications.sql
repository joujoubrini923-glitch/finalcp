-- Private coach email notification log and next-course advertisement identity.
create table if not exists public.notification_deliveries (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  source_table text not null,
  source_id text not null,
  to_email text,
  status text not null default 'processing' check (status in ('processing', 'sent', 'failed')),
  attempts integer not null default 1 check (attempts >= 1),
  provider_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.notification_deliveries add column if not exists to_email text;
alter table public.notification_deliveries add column if not exists error_message text;
alter table public.notification_deliveries add column if not exists updated_at timestamptz not null default now();
alter table public.notification_deliveries add column if not exists sent_at timestamptz;
alter table public.notification_deliveries drop constraint if exists notification_deliveries_source_table_check;
alter table public.notification_deliveries add constraint notification_deliveries_source_table_check check (source_table in ('join_requests', 'next_course_requests', 'clinic_cases', 'questions'));
alter table public.notification_deliveries enable row level security;
revoke all on table public.notification_deliveries from anon, authenticated;
create index if not exists notification_deliveries_source_idx on public.notification_deliveries (source_table, source_id);
create index if not exists notification_deliveries_status_idx on public.notification_deliveries (status, updated_at);
alter table public.next_course_requests add column if not exists course_ad_id text;
create index if not exists next_course_requests_ad_idx on public.next_course_requests (course_ad_id, created_at desc);
alter table public.next_course_requests replica identity full;
