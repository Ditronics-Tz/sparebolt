import { useState } from 'react';
import { cn } from '../lib/utils';

/** Reliable fallback when remote image 404s or fails to load */
export const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80';

type SafeImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrc?: string;
};

/**
 * Image that swaps to a known-good fallback if the primary URL fails
 * (broken Unsplash IDs, deleted CDN assets, offline, etc.).
 */
export function SafeImage({
  src,
  fallbackSrc = PLACEHOLDER_IMAGE,
  className,
  alt = '',
  onError,
  ...props
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  // Relative /uploads paths work via Vite proxy in dev
  const primary = src || undefined;
  const resolved =
    !primary || failed || primary === fallbackSrc ? fallbackSrc : primary;

  return (
    <img
      {...props}
      src={resolved}
      alt={alt}
      className={cn(className)}
      onError={(e) => {
        if (!failed && resolved !== fallbackSrc) {
          setFailed(true);
        }
        onError?.(e);
      }}
    />
  );
}
