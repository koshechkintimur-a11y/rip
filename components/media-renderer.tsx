'use client';

import { useState } from 'react';
import { useLightbox } from '@/components/lightbox';

/** Единый рендерер медиа: image/gif/video. Использовать везде (feed, branch, DM, profile, saved). */
export function MediaRenderer({ url, type, className = '' }: { url: string; type?: string | null; className?: string }) {
  const { open: openImage } = useLightbox();

  if (!url) return null;

  if (type === 'video' || /\.(mp4|webm)(\?|$)/i.test(url)) {
    return (
      <video
        controls
        playsInline
        preload="metadata"
        className={`mt-1.5 max-h-60 rounded-md border border-rip-line w-full ${className}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
      >
        <source src={url} />
      </video>
    );
  }

  // gif / image
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`mt-1.5 max-h-48 rounded-md border border-rip-line cursor-zoom-in ${className}`}
      loading="lazy"
      onClick={(e) => { e.stopPropagation(); openImage(url); }}
    />
  );
}