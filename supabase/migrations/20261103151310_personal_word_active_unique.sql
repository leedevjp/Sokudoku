-- Deleted entries retain their IDs/history; adding the same word creates a fresh entry.
alter table public.personal_word drop constraint personal_word_user_id_term_kana_key;
create unique index personal_word_active_term_kana_idx on public.personal_word(user_id,term,kana) where deleted_at is null;
