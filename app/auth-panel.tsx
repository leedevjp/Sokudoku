"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

function message(code?: string) {
 switch(code) {
 case 'invalid_credentials': return 'メールアドレスまたはパスワードが正しくありません。';
 case 'email_not_confirmed': return '確認メールのリンクを開いて、認証を完了してください。';
 case 'user_already_exists': case 'email_exists': return 'このメールアドレスは登録済みです。ログインしてください。';
 case 'weak_password': return 'より安全なパスワードを入力してください。';
 case 'over_email_send_rate_limit': case 'over_request_rate_limit': return 'リクエストが多すぎます。しばらく待ってから再度お試しください。';
 case 'signup_disabled': return '現在、新規登録を受け付けていません。';
 default: return '認証に失敗しました。入力内容と接続を確認してください。';
 }
}
export default function AuthPanel() {
 const [user,setUser]=useState<User|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const lock=useRef(false);
 const [mode,setMode]=useState<'login'|'signup'>('login');
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  let active=true;
  const client=createClient();
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{
   if(active){setUser(session?.user??null);setLoading(false);}
  });
  void client.auth.getUser().then(({data,error})=>{
   if(active){setUser(data.user);setLoading(false);if(error&&error.name!=='AuthSessionMissingError')setNotice('セッションを確認できませんでした。再度ログインしてください。');}
  }).catch(()=>{if(active){setLoading(false);setNotice('認証サーバーに接続できません。');}});
  return ()=>{active=false;subscription.unsubscribe();};
 },[]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current)return;
  if(password.length<8){setNotice('パスワードは8文字以上で入力してください。');return;}
  lock.current=true;setBusy(true);setNotice('');
  try {
   const client=createClient();
   if(mode==='signup'){
    const redirect=new URL('/auth/callback',window.location.origin);
    const {data,error}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirect.toString()}});
    if(error)setNotice(message(error.code));
    else if(data.session){setUser(data.user);setPassword('');}
    else {setNotice('確認メールを送信しました。このブラウザーでリンクを開き、メール認証を完了してください。');setPassword('');}
   }else{
    const {data,error}=await client.auth.signInWithPassword({email:email.trim(),password});
    if(error)setNotice(message(error.code));else{setUser(data.user);setPassword('');}
   }
  }catch{setNotice('認証サーバーに接続できません。しばらく待ってから再度お試しください。');}
  finally{lock.current=false;setBusy(false);}
 }
 async function signOut(){
  if(lock.current)return;lock.current=true;setBusy(true);setNotice('');
  try{const {error}=await createClient().auth.signOut();if(error)setNotice('ログアウトに失敗しました。再度お試しください。');else{setUser(null);setPassword('');setNotice('ログアウトしました。');}}
  catch{setNotice('接続を確認して、再度ログアウトしてください。');}
  finally{lock.current=false;setBusy(false);}
 }
 return <main className="auth-shell"><section className="auth-card">
  <a className="brand" href="/">速読 <span>SOKUDOKU</span></a>
  {loading?<p role="status">ログイン状態を確認中…</p>:user?<>
   <p className="eyebrow">読む準備ができました</p><h1>おかえりなさい。</h1>
   <p className="description account-email">{user.email}</p><div className="notice" role="status">ログインしました。単語トレーニングは準備中です。</div>
   <button className="primary" disabled={busy} onClick={signOut}>{busy?'処理中…':'ログアウト'}</button>
  </>:<>
   <p className="eyebrow">知っている単語を、止まらずに。</p><h1>{mode==='login'?'読む力を、積み重ねよう。':'トレーニングを始めよう。'}</h1>
   <p className="description">日本語の意味と読みを、もっと速く。<br/>メールアドレスでSokudokuを始めましょう。</p>
   <div className="auth-tabs">{(['login','signup'] as const).map(m=><button key={m} type="button" aria-pressed={mode===m} disabled={busy} onClick={()=>{setMode(m);setNotice('');setPassword('');}}>{m==='login'?'ログイン':'新規登録'}</button>)}</div>
   <form onSubmit={submit}>
    <label htmlFor="email">メールアドレス</label><input id="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" disabled={busy}/>
    <label htmlFor="password">パスワード</label><input id="password" type="password" required minLength={8} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="8文字以上" disabled={busy}/>
    <button className="primary" disabled={busy}>{busy?'処理中…':mode==='signup'?'登録して確認メールを受け取る':'ログイン'}</button>
   </form><p className="footnote">新規登録後はメール認証が必要です。</p>
  </>}
  {notice&&<p className="notice" role="status" aria-live="polite">{notice}</p>}
 </section><p className="outside-note">小さな反復が、すぐに読む力になる。</p></main>;
}
