import { useState } from 'react';

interface MessageAvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClass = { sm: 'size-8 text-xs', md: 'size-11 text-sm', lg: 'size-16 text-xl' };

export default function MessageAvatar({ name, src, size = 'md' }: MessageAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const className = `${sizeClass[size]} shrink-0 rounded-full border border-white bg-gradient-to-br from-amber-100 to-rose-200 object-cover font-bold text-rose-900 shadow-sm`;
  if (src && failedSrc !== src) {
    return <img src={src} alt="" onError={() => setFailedSrc(src)} className={className} />;
  }
  return <span aria-hidden="true" className={`inline-flex items-center justify-center ${className}`}>
    {name.trim().charAt(0).toUpperCase() || '?'}
  </span>;
}
