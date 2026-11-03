-- Delete the parent's related answers/FSRS state atomically, without granting
-- clients arbitrary DELETE access to answer_log or word_learning_state.
alter table public.answer_log drop constraint answer_log_personal_word_fkey,
  drop constraint answer_log_selected_personal_word_fkey;
alter table public.answer_log add constraint answer_log_personal_word_fkey
  foreign key (user_id,personal_word_id) references public.personal_word(user_id,id) on delete cascade,
  add constraint answer_log_selected_personal_word_fkey
  foreign key (user_id,selected_personal_word_id) references public.personal_word(user_id,id) on delete cascade;
alter table public.word_learning_state drop constraint word_learning_state_user_id_personal_word_id_fkey;
alter table public.word_learning_state add constraint word_learning_state_user_id_personal_word_id_fkey
  foreign key (user_id,personal_word_id) references public.personal_word(user_id,id) on delete cascade;
grant delete on public.personal_word to authenticated;

-- Defense in depth for direct Data API writes. Legacy imported content is not
-- rewritten. NOT VALID still enforces the constraints on every new/updated row.
alter table public.personal_word add constraint personal_word_safe_content check (
  char_length(term) between 1 and 100 and char_length(btrim(term))>0
  and char_length(kana) between 1 and 200 and char_length(btrim(kana))>0
  and char_length(meaning_ko) between 1 and 1000 and char_length(btrim(meaning_ko))>0
  and (hanja_reading is null or char_length(hanja_reading)<=100)
  and (note is null or char_length(note)<=4000)
  and term !~ '[[:cntrl:]<>`\\]'
  and kana !~ '[[:cntrl:]<>`\\]'
  and meaning_ko !~ '[[:cntrl:]<>`\\]'
  and coalesce(hanja_reading,'') !~ '[[:cntrl:]<>`\\]'
  and regexp_replace(coalesce(note,''),E'[\n\r\t]','','g') !~ '[[:cntrl:]<>`\\]'
  and (term||kana||meaning_ko||coalesce(hanja_reading,'')||coalesce(note,''))
    !~ U&'[\200B-\200F\202A-\202E\2060-\206F\FEFF]'
) not valid;
alter table public.personal_word add constraint personal_word_safe_kana check (
  kana ~ '^[ぁ-ゖァ-ヶー〜～~・ 　]+$' and kana ~ '[ぁ-ゖァ-ヶ]'
) not valid;
alter table public.personal_word add constraint personal_word_safe_term check (
  term ~ '^[[:alnum:] ・ー々〆ヶ〜～~+/#&%._()（）-]+$'
  and term ~ '[[:alnum:]]'
) not valid;
alter table public.personal_word add constraint personal_word_safe_hanja check (
  hanja_reading is null or hanja_reading ~ '^[가-힣 ・·]*$'
) not valid;
