import Link from 'next/link';
export default function AuthError(){return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">SOKUDOKU</p><h1>認証を完了できませんでした。</h1><p className="description">リンクの有効期限が切れているか、すでに使用されている可能性があります。登録したブラウザーで確認メールを開き直してください。</p><Link className="primary link-button" href="/">ログインに戻る</Link></section></main>}
