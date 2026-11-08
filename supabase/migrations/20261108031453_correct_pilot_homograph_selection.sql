update public.word set grammar_status='unreviewed',grammar_batch=null,can_be_adverb=null
where term='目下' and kana='めした' and grammar_batch='sentence-pilot-100-v1';
