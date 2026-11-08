alter table public.word
 add column can_be_noun boolean, add column can_be_verb boolean,
 add column can_be_i_adjective boolean, add column can_be_na_adjective boolean,
 add column can_be_adverb boolean, add column can_be_conjunction boolean,
 add column can_be_prefix boolean, add column can_be_suffix boolean,
 add column can_be_expression boolean,
 add column verb_class text check (verb_class in ('godan','ichidan','suru','kuru','special')),
 add column verb_stem text, add column verb_stem_kana text,
 add column adjective_stem text, add column adjective_stem_kana text,
 add column sentence_surface text, add column sentence_reading text,
 add column grammar_status text not null default 'unreviewed' check (grammar_status in ('unreviewed','draft','approved','needs_review')),
 add column grammar_batch text;

create table public.word_form_override (
 id uuid primary key default gen_random_uuid(),
 word_id uuid not null references public.word(id) on delete restrict,
 form_key text not null check(length(btrim(form_key))>0),
 surface text not null check(length(btrim(surface))>0),
 reading text not null check(length(btrim(reading))>0),
 review_status text not null default 'draft' check(review_status in ('draft','approved','needs_review')),
 note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(word_id,form_key)
);
alter table public.word_form_override enable row level security;
revoke all on public.word_form_override from anon,authenticated;
grant select on public.word_form_override to authenticated;
grant all on public.word_form_override to service_role;
create policy override_read on public.word_form_override for select to authenticated using(review_status='approved');

-- Content is immutable per release. Sockets store UTF-16 offsets and reviewed choices.
create table public.reading_sentence (
 id text primary key, content jsonb not null check(jsonb_typeof(content)='object'),
 batch text not null, active boolean not null default false,
 created_at timestamptz not null default now()
);
alter table public.reading_sentence enable row level security;
revoke all on public.reading_sentence from anon,authenticated;
grant select on public.reading_sentence to authenticated;
grant all on public.reading_sentence to service_role;
create policy sentence_read on public.reading_sentence for select to authenticated using(active);

-- Only the previously sampled 100 terms are touched. Positive classifications are a draft,
-- not an assertion that every other use is impossible. Existing lexical fields are preserved.
with sample(term) as (select unnest(string_to_array('化石|発車|例えば|想像|お気に入り|刈る|重複|洗う|喜ぶ|～歳|軽快な|一瞬|見積もる|アクセサリー|趣旨|訪れる|辟易|作り方|途端に|ほうき|特売|競う|ふんだんな|即刻|ひしひし|缶詰|料金|冗談|温かい|独特|全て|構想|シリーズ|摘む|廃れる|与える|反省|完璧な|飲酒|着替え|極めて|誇張|思い切る|神経|あくまで|カロリー|～製|デモンストレーション|設計|虹|出費|口論|かび|言葉づかい|いる|しんなり|差|ラジカセ|親類|緩和|入学|仮に|主人公|ブローチ|お見合い|樹立|男の人|ベッド|単調な|滞在|癒やし|実際|何杯|目下|貧困|簡素な|咳|視聴者|体裁|コンテンツ|亡くす|調達|公益|難点|ブランク|12日|好況|卒業式|寄せる|日付|成長|慎む|第一印象|転ぶ|旅館|通る|不規則な|選挙|平等な|怒り','|')))
update public.word w set grammar_batch='sentence-pilot-100-v1',grammar_status='draft'
from sample s where w.term=s.term and w.deleted_at is null and w.entry_type='word';

update public.word set can_be_verb=true,verb_class=case when term=any(array['訪れる','廃れる','与える','いる','寄せる']) then 'ichidan' else 'godan' end,
 verb_stem=left(term,length(term)-1),verb_stem_kana=left(kana,length(kana)-1)
where grammar_batch='sentence-pilot-100-v1' and term=any(array['刈る','洗う','喜ぶ','見積もる','訪れる','競う','摘む','廃れる','与える','思い切る','いる','亡くす','寄せる','慎む','転ぶ','通る']);
update public.word set can_be_noun=true,can_be_verb=true,verb_class='suru',verb_stem=term,verb_stem_kana=kana
where grammar_batch='sentence-pilot-100-v1' and term=any(array['発車','想像','重複','辟易','特売','構想','反省','飲酒','誇張','デモンストレーション','設計','出費','口論','緩和','入学','お見合い','樹立','滞在','調達','成長','選挙']);
update public.word set can_be_na_adjective=true,adjective_stem=left(term,length(term)-1),adjective_stem_kana=left(kana,length(kana)-1)
where grammar_batch='sentence-pilot-100-v1' and term=any(array['軽快な','ふんだんな','完璧な','単調な','簡素な','不規則な','平等な']);
update public.word set can_be_i_adjective=true,adjective_stem='温か',adjective_stem_kana='あたたか' where grammar_batch='sentence-pilot-100-v1' and term='温かい';
update public.word set can_be_adverb=true where grammar_batch='sentence-pilot-100-v1' and term=any(array['例えば','一瞬','途端に','即刻','ひしひし','全て','極めて','あくまで','しんなり','仮に','実際','目下']);
update public.word set can_be_suffix=true,sentence_surface=replace(term,'～',''),sentence_reading=replace(kana,'～','') where grammar_batch='sentence-pilot-100-v1' and term in ('～歳','～製');
update public.word set can_be_noun=true where grammar_batch='sentence-pilot-100-v1' and can_be_verb is null and can_be_na_adjective is null and can_be_i_adjective is null and can_be_adverb is null and can_be_suffix is null;

insert into public.reading_sentence(id,content,batch,active) select j->>'id',j,'sentence-pilot-100-v1',true from jsonb_array_elements($seed$[{"id":"reading-pilot-1","text":"電車は午前九時に発車します。","translation":"전철은 오전 9시에 출발합니다.","sockets":[{"original":"発車","start":8,"options":[{"text":"発車","accepted":true},{"text":"飲酒","accepted":false},{"text":"入学","accepted":false},{"text":"口論","accepted":false}]},{"original":"午前九時","start":3,"options":[{"text":"午前九時","accepted":true},{"text":"缶詰","accepted":false},{"text":"ほうき","accepted":false},{"text":"神経","accepted":false}]}]},{"id":"reading-pilot-2","text":"作業を始める前に、手を洗いました。","translation":"작업을 시작하기 전에 손을 씻었습니다.","sockets":[{"original":"洗いました","start":11,"options":[{"text":"洗いました","accepted":true},{"text":"見積もりました","accepted":false},{"text":"競いました","accepted":false},{"text":"刈りました","accepted":false}]}]},{"id":"reading-pilot-3","text":"費用を見積もってから、契約を結びます。","translation":"비용을 견적 낸 뒤 계약을 체결합니다.","sockets":[{"original":"見積もって","start":3,"options":[{"text":"見積もって","accepted":true},{"text":"洗って","accepted":false},{"text":"摘んで","accepted":false},{"text":"喜んで","accepted":false}]}]},{"id":"reading-pilot-4","text":"この説明では、計画の趣旨がよく分かりません。","translation":"이 설명으로는 계획의 취지를 잘 모르겠습니다.","sockets":[{"original":"趣旨","start":10,"options":[{"text":"趣旨","accepted":true},{"text":"虹","accepted":false},{"text":"ほうき","accepted":false},{"text":"缶詰","accepted":false}]}]},{"id":"reading-pilot-5","text":"新しい設備の設計には、三か月かかります。","translation":"새로운 설비의 설계에는 3개월이 걸립니다.","sockets":[{"original":"設計","start":6,"options":[{"text":"設計","accepted":true},{"text":"飲酒","accepted":false},{"text":"入学","accepted":false},{"text":"口論","accepted":false}]}]},{"id":"reading-pilot-6","text":"重い荷物を持つ作業は、足のけがで極めて困難です。","translation":"무거운 짐을 드는 작업은 발 부상 때문에 매우 어렵습니다.","sockets":[{"original":"極めて","start":16,"options":[{"text":"極めて","accepted":true},{"text":"例えば","accepted":false},{"text":"仮に","accepted":false},{"text":"全て","accepted":false}]}]},{"id":"reading-pilot-7","text":"まだ十八歳なので、飲酒はできません。","translation":"아직 18세이므로 음주는 할 수 없습니다.","sockets":[{"original":"飲酒","start":9,"options":[{"text":"飲酒","accepted":true},{"text":"設計","accepted":false},{"text":"想像","accepted":false},{"text":"反省","accepted":false}]}]},{"id":"reading-pilot-8","text":"社員と役員には、平等な発言の機会があります。","translation":"직원과 임원에게는 평등한 발언 기회가 있습니다.","sockets":[{"original":"平等な","start":8,"options":[{"text":"平等な","accepted":true},{"text":"単調な","accepted":false},{"text":"不規則な","accepted":false},{"text":"軽快な","accepted":false}]}]},{"id":"reading-pilot-9","text":"部品を調達してから、製品を組み立てます。","translation":"부품을 조달한 뒤 제품을 조립합니다.","sockets":[{"original":"調達して","start":3,"options":[{"text":"調達して","accepted":true},{"text":"飲酒して","accepted":false},{"text":"反省して","accepted":false},{"text":"入学して","accepted":false}]}]},{"id":"reading-pilot-10","text":"申し込みには、氏名と日付を記入してください。","translation":"신청하려면 이름과 날짜를 기입해 주세요.","sockets":[{"original":"日付","start":10,"options":[{"text":"日付","accepted":true},{"text":"かび","accepted":false},{"text":"虹","accepted":false},{"text":"ほうき","accepted":false}]}]},{"id":"reading-pilot-11","text":"発熱と咳があるので、今日は自宅で休みます。","translation":"열과 기침이 있어서 오늘은 집에서 쉽니다.","sockets":[{"original":"咳","start":3,"options":[{"text":"咳","accepted":true},{"text":"設計","accepted":false},{"text":"樹立","accepted":false},{"text":"口論","accepted":false}]}]},{"id":"reading-pilot-12","text":"水でぬれた床を走ると、滑って転びます。","translation":"물에 젖은 바닥을 달리면 미끄러져 넘어집니다.","sockets":[{"original":"転びます","start":14,"options":[{"text":"転びます","accepted":true},{"text":"見積もります","accepted":false},{"text":"刈ります","accepted":false},{"text":"喜びます","accepted":false}]}]}]$seed$::jsonb) j;
