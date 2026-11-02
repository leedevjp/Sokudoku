import Link from 'next/link';
export default function AuthError(){return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">SOKUDOKU</p><h1>인증을 완료하지 못했어요.</h1><p className="description">링크가 만료되었거나 이미 사용되었을 수 있습니다. 회원가입한 브라우저에서 메일을 다시 열어 주세요.</p><Link className="primary link-button" href="/">로그인으로 돌아가기</Link></section></main>}
