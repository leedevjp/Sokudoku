export function WordReading({
  kana,
  pronunciation_ko,
}: {
  kana: string;
  pronunciation_ko?: string | null;
}) {
  const pronunciation = pronunciation_ko?.trim();
  return (
    <>
      <span lang="ja">{kana}</span>
      {pronunciation && <> <span lang="ko">[{pronunciation}]</span></>}
    </>
  );
}
