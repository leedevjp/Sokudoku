-- Preserve legacy NULL modes and existing logs; exam only changes selection.
alter table public.answer_log drop constraint answer_log_mode_check;
alter table public.answer_log add constraint answer_log_mode_check
  check (mode in ('exploration', 'review', 'exam'));
