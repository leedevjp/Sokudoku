-- Nullable for existing history and old offline clients. Never infer old modes.
alter table public.answer_log add column mode text
  check (mode in ('exploration', 'review'));
grant insert (mode) on public.answer_log to authenticated;
comment on column public.answer_log.mode is 'Actual question selection mode; NULL for legacy answers.';
