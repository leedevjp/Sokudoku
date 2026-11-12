-- Preserve existing personal word meanings that use four legitimate math labels.
-- Keep all other content validation protections. No personal data changes.
ALTER TABLE public.personal_word
  DROP CONSTRAINT IF EXISTS personal_word_safe_content;
ALTER TABLE public.personal_word
  ADD CONSTRAINT personal_word_safe_content CHECK (((char_length(term) >= 1) AND (char_length(term) <= 100) AND (char_length(btrim(term)) > 0) AND ((char_length(kana) >= 1) AND (char_length(kana) <= 200)) AND (char_length(btrim(kana)) > 0) AND ((char_length(meaning_ko) >= 1) AND (char_length(meaning_ko) <= 1000)) AND (char_length(btrim(meaning_ko)) > 0) AND ((hanja_reading IS NULL) OR (char_length(hanja_reading) <= 100)) AND ((note IS NULL) OR (char_length(note) <= 4000)) AND (term !~ '[[:cntrl:]<>`\\]'::text) AND (kana !~ '[[:cntrl:]<>`\\]'::text) AND ((meaning_ko !~ '[[:cntrl:]<>`\\]'::text) OR (meaning_ko = ANY (ARRAY['보다 큼 (>)'::text, '크거나 같음 (>=)'::text, '보다 작음 (<)'::text, '작거나 같음 (<=)'::text]))) AND (COALESCE(hanja_reading, ''::text) !~ '[[:cntrl:]<>`\\]'::text) AND (regexp_replace(COALESCE(note, ''::text), '[
	]'::text, ''::text, 'g'::text) !~ '[[:cntrl:]<>`\\]'::text) AND (((((term || kana) || meaning_ko) || COALESCE(hanja_reading, ''::text)) || COALESCE(note, ''::text)) !~ '[​-‏‪-‮⁠-⁯﻿]'::text))) NOT VALID;
