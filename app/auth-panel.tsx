"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

function message(code?: string) {
 switch(code) {
 case 'invalid_credentials': return '이메일 또는 비밀번호가 올바르지 않습니다.';
 case 'email_not_confirmed': return '인증 메일의 링크를 먼저 눌러 주세요.';
 case 'user_already_exists': case 'email_exists': return '이미 등록된 이메일입니다. 로그인해 주세요.';
 case 'weak_password': return '더 안전한 비밀번호를 입력해 주세요.';
 case 'over_email_send_rate_limit': case 'over_request_rate_limit': return '요청이 많습니다. 잠시 후 다시 시도해 주세요.';
 case 'signup_disabled': return '현재 회원가입이 비활성화되어 있습니다.';
 default: return '인증에 실패했습니다. 입력 내용과 연결을 확인해 주세요.';
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
   if(active){setUser(data.user);setLoading(false);if(error&&error.name!=='AuthSessionMissingError')setNotice('세션을 확인하지 못했습니다. 다시 로그인해 주세요.');}
  }).catch(()=>{if(active){setLoading(false);setNotice('인증 서버에 연결할 수 없습니다.');}});
  return ()=>{active=false;subscription.unsubscribe();};
 },[]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(lock.current)return;
  if(password.length<8){setNotice('비밀번호를 8자 이상 입력해 주세요.');return;}
  lock.current=true;setBusy(true);setNotice('');
  try {
   const client=createClient();
   if(mode==='signup'){
    const redirect=new URL('/auth/callback',window.location.origin);
    const {data,error}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirect.toString()}});
    if(error)setNotice(message(error.code));
    else if(data.session){setUser(data.user);setPassword('');}
    else {setNotice('확인 메일을 보냈습니다. 이 브라우저에서 링크를 열어 인증한 뒤 로그인해 주세요.');setPassword('');}
   }else{
    const {data,error}=await client.auth.signInWithPassword({email:email.trim(),password});
    if(error)setNotice(message(error.code));else{setUser(data.user);setPassword('');}
   }
  }catch{setNotice('인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function signOut(){
  if(lock.current)return;lock.current=true;setBusy(true);setNotice('');
  try{const {error}=await createClient().auth.signOut();if(error)setNotice('로그아웃에 실패했습니다. 다시 시도해 주세요.');else{setUser(null);setPassword('');setNotice('로그아웃했습니다.');}}
  catch{setNotice('연결을 확인하고 다시 로그아웃해 주세요.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <main className="auth-shell"><section className="auth-card">
  <a className="brand" href="/">速読 <span>SOKUDOKU</span></a>
  {loading?<p role="status">로그인 상태 확인 중…</p>:user?<>
   <p className="eyebrow">READY TO READ</p><h1>다시 만나 반가워요.</h1>
   <p className="description account-email">{user.email}</p><div className="notice" role="status">로그인되었습니다. 단어 훈련은 준비 중입니다.</div>
   <button className="primary" disabled={busy} onClick={signOut}>{busy?'처리 중…':'로그아웃'}</button>
  </>:<>
   <p className="eyebrow">아는 단어를, 멈추지 않고.</p><h1>{mode==='login'?'읽는 힘을 이어가세요.':'훈련을 시작해 보세요.'}</h1>
   <p className="description">일본어의 의미와 읽기를 더 빠르게.<br/>이메일 계정으로 Sokudoku를 시작하세요.</p>
   <div className="auth-tabs">{(['login','signup'] as const).map(m=><button key={m} type="button" aria-pressed={mode===m} disabled={busy} onClick={()=>{setMode(m);setNotice('');setPassword('');}}>{m==='login'?'로그인':'회원가입'}</button>)}</div>
   <form onSubmit={submit}>
    <label htmlFor="email">이메일</label><input id="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" disabled={busy}/>
    <label htmlFor="password">비밀번호</label><input id="password" type="password" required minLength={8} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="8자 이상" disabled={busy}/>
    <button className="primary" disabled={busy}>{busy?'처리 중…':mode==='signup'?'가입하고 인증 메일 받기':'로그인'}</button>
   </form><p className="footnote">회원가입 후 이메일 인증이 필요합니다.</p>
  </>}
  {notice&&<p className="notice" role="status" aria-live="polite">{notice}</p>}
 </section><p className="outside-note">작은 반복이 만드는, 즉시 읽는 힘.</p></main>;
}
