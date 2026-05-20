import { type ReactNode, useEffect, useState } from 'react';

export function FallbackImage({
  alt = '',
  className,
  draggable,
  fallback,
  src,
}: {
  alt?: string;
  className?: string;
  draggable?: boolean;
  fallback: ReactNode;
  src: null | string | undefined;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return <>{fallback}</>;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={draggable}
      onError={() => setFailed(true)}
    />
  );
}
