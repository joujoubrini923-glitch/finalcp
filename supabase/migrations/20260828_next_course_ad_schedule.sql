-- Abdelmajid CP — identify next-course advertisement availability
-- Required when more than one next-course advertisement can use the same
-- course level. Existing rows remain valid and are matched by course_level
-- until a newer advertisement-specific preference is saved.

alter table public.next_course_requests
  add column if not exists course_ad_id text;

create index if not exists next_course_requests_ad_idx
  on public.next_course_requests (course_ad_id, created_at desc);

create index if not exists next_course_requests_student_ad_idx
  on public.next_course_requests (student_id, course_ad_id, created_at desc);
