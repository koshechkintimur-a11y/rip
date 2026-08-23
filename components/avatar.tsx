'use client';

/** Кружок-аватар: картинка или первая буква ника. */
export function Avatar({ url, username, size = 32 }: { url?: string | null; username?: string | null; size?: number }) {
  const letter = (username || '?')[0]?.toUpperCase();
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={username || ''}
        className="rounded-full border border-rip-line object-cover shrink-0"
        style={style}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="rounded-full border border-rip-line bg-rip-panel flex items-center justify-center text-rip-dim font-semibold shrink-0"
      style={style}
    >
      {letter}
    </div>
  );
}