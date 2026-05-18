import { type ReactNode, useEffect, useState } from 'react';

export function FallbackImage({
  alt = '',
  className,
  fallback,
  src,
}: {
  alt?: string;
  className?: string;
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
      onError={() => setFailed(true)}
    />
  );
}
