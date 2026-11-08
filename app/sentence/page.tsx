import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SentenceGame from './sentence-game';
import { z } from 'zod';
import { Suspense } from 'react';
const sentenceSchema=z.object({id:z.string(),text:z.string(),translation:z.string(),sockets:z.array(z.object({original:z.string(),start:z.number().int().nonnegative(),options:z.array(z.object({text:z.string(),accepted:z.boolean()})).min(4)})).min(1)});
export default function SentencePage(){return <Suspense fallback={<main className="site-shell">문장 준비 중…</main>}><SentenceData/></Suspense>;}
async function SentenceData(){
 const db=await createClient();
 const {data:{user}}=await db.auth.getUser();
 if(!user)return <main className="site-shell"><h1>문장 읽기 · 文章を読む</h1><p>로그인 후 시작해주세요. ログインしてください。</p><Link href="/?login=1">로그인 · ログイン →</Link></main>;
 const {data,error}=await db.from('sentence').select('id,text_ja,translation_ko,sentence_socket(start_offset,end_offset,original_text,sentence_option(display_text,is_accepted,review_status,reason_ko))').eq('status','published').order('id').limit(100);
 if(error) return <main className="site-shell"><h1>문장을 불러오지 못했습니다</h1><p>잠시 후 다시 시도해주세요.</p><Link href="/sentence">다시 시도</Link> · <Link href="/">홈</Link></main>;
 const sentences=(data??[]).flatMap(row=>{
 const sockets=row.sentence_socket.filter(sk=>row.text_ja.slice(sk.start_offset,sk.end_offset)===sk.original_text).map(sk=>({original:sk.original_text,start:sk.start_offset,options:sk.sentence_option.filter(o=>o.review_status==='approved'&&o.reason_ko?.trim()).map(o=>({text:o.display_text,accepted:o.is_accepted}))})).filter(sk=>sk.options.length>=4&&sk.options.some(o=>o.accepted)&&sk.options.filter(o=>!o.accepted).length>=3);
 const parsed=sentenceSchema.safeParse({id:row.id,text:row.text_ja,translation:row.translation_ko,sockets});return parsed.success?[parsed.data]:[];});
 return <SentenceGame sentences={sentences}/>;
}
