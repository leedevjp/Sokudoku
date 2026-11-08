'use client';
import Link from 'next/link';
import { useEffect,useRef,useState } from 'react';
import { useSettings } from '@/components/settings/settings-provider';
import { SettingsBar } from '@/components/settings/settings-bar';
import type { ReadingSentence,SentenceSocket } from '@/lib/sentence/content';
import styles from './sentence.module.css';
type Question={sentence:ReadingSentence;socket:SentenceSocket};
function shuffle<T>(items:T[]):T[]{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function deck(sentences:ReadingSentence[]):Question[]{return shuffle(sentences).map(sentence=>{const socket=sentence.sockets[Math.floor(Math.random()*sentence.sockets.length)];const accepted=shuffle(socket.options.filter(o=>o.accepted));const rejected=shuffle(socket.options.filter(o=>!o.accepted));const required=[accepted[0],rejected[0]];const remainder=shuffle([...accepted.slice(1),...rejected.slice(1)]).slice(0,2);return {sentence,socket:{...socket,options:shuffle([...required,...remainder])}};});}
export default function SentenceGame({sentences}:{sentences:ReadingSentence[]}){
 const {prefs}=useSettings();const t=(jp:string,kr:string)=>prefs.lang==='jp'?jp:kr;
 const [questions,setQuestions]=useState<Question[]|null>(null);const [index,setIndex]=useState(0);const [selected,setSelected]=useState<number|null>(null);const [correct,setCorrect]=useState(0);const [paused,setPaused]=useState(false);const guard=useRef(false);
 useEffect(()=>{const timer=setTimeout(()=>setQuestions(deck(sentences)),0);return()=>clearTimeout(timer);},[sentences]);
 useEffect(()=>{if(selected===null||paused)return;const timer=setTimeout(()=>{guard.current=false;setIndex(i=>i+1);setSelected(null);},3500);return()=>clearTimeout(timer);},[selected,paused]);
 useEffect(()=>{const hidden=()=>{if(document.hidden)setPaused(true);};document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);},[]);
 const q=questions?.[index];
 function choose(i:number){if(!q||guard.current||paused)return;guard.current=true;setSelected(i);if(q.socket.options[i].accepted)setCorrect(n=>n+1);}
 const done=questions!==null&&index>=questions.length;
 const readingRef=useRef<HTMLDivElement>(null);
 const sentenceRef=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{
  const area=readingRef.current;const text=sentenceRef.current;if(!area||!text)return;
  const fit=()=>{let size=Math.min(30,Math.max(20,area.clientWidth/18));text.style.fontSize=`${size}px`;while(text.scrollHeight>area.clientHeight&&size>12){size-=.5;text.style.fontSize=`${size}px`;}};
  const observer=new ResizeObserver(fit);observer.observe(area);fit();
  void document.fonts.ready.then(()=>{if(text.isConnected)fit();});
  return()=>observer.disconnect();
 },[q,selected]);
 return <main className={styles.shell}>
 <header className={styles.header}><Link href="/">速 Sokudoku.</Link><SettingsBar/></header>
 <div className={styles.topline}><span>{t('文章を読む','문장 읽기')}</span><span>{questions?Math.min(index+1,questions.length):0} / {questions?.length??'…'}</span></div>
 <progress className={styles.progress} max={questions?.length||1} value={index} aria-label={t('進み具合','진행 상황')}/>
 {!questions?<p role="status">{t('準備中…','준비 중…')}</p>:done?<section className={styles.card}><p className={styles.eyebrow}>READING COMPLETE</p><h1>{questions.length?t('おつかれさま！','수고했어요!'):t('文章がありません','준비된 문장이 없어요')}</h1><p>{t('読んだ文章','읽은 문장')} {index} · {t('正答','정답')} {correct}</p><button className={styles.action} onClick={()=>{guard.current=false;setQuestions(deck(sentences));setIndex(0);setSelected(null);setCorrect(0);setPaused(false);}}>{t('もう一度','다시 읽기')}</button><Link href="/">{t('ホームへ','홈으로')}</Link></section>:q?<>
 <section className={styles.card} aria-label={t('問題','문제')}><p className={styles.eyebrow}>{t('文を読んで、ひとつ選ぼう','문장을 읽고 하나를 골라주세요')}</p>
 <div className={styles.reading} ref={readingRef}><p ref={sentenceRef} lang="ja" className={styles.sentence}>{q.sentence.text.slice(0,q.socket.start)}<mark className={styles.blank}>{selected===null?'（　）':q.socket.options[selected].accepted?q.socket.options[selected].text:q.socket.original}</mark>{q.sentence.text.slice(q.socket.start+q.socket.original.length)}</p></div>
 <div className={styles.feedback} aria-live="polite">{selected!==null?<><strong>{q.socket.options[selected].accepted?t('✓ 正解','✓ 정답'):t('正解を確認しよう','정답을 확인해요')}</strong><p lang="ko">{q.sentence.translation}</p><small>{paused?t('自動進行を停止中','자동 진행 일시정지'):t('まもなく次の文章へ','잠시 후 다음 문장으로 넘어가요')}</small></>:<p>{t('選んだあとに韓国語訳を表示','선택하면 한국어 번역이 나타나요')}</p>}</div></section>
 <div className={styles.choices}>{q.socket.options.map((o,i)=><button key={i} disabled={selected!==null||paused} data-result={selected===null?'':o.accepted?'correct':selected===i?'incorrect':''} onClick={()=>choose(i)}><span>{i+1}</span><span lang="ja">{o.text}</span>{selected!==null&&o.accepted?<span>✓</span>:null}</button>)}</div>
 <div className={styles.footer}><Link href="/">{t('終了してホームへ','끝내고 홈으로')}</Link><button onClick={()=>setPaused(p=>!p)}>{paused?t('▶ 再開','▶ 계속하기'):t('Ⅱ 一時停止','Ⅱ 일시정지')}</button></div>
 </>:null}</main>;
}
