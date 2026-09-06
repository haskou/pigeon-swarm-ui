import type { ImgHTMLAttributes } from 'react';

import { useEffect, useRef, useState } from 'react';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { isIndependentClient } from '../../../../shared/infrastructure/client/isIndependentClient';

export function StickerImage({
  assetCid,
  loading,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  assetCid: string;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState({ assetCid: '', url: '' });

  useEffect(() => {
    if (!isIndependentClient()) return;
    const controller = new AbortController();
    let url = '';
    let started = false;

    const load = () => {
      if (started || controller.signal.aborted) return;
      started = true;
      void applicationContainer.stickers
        .loadAsset(assetCid, controller.signal)
        .then((blob) => {
          if (controller.signal.aborted) return;
          url = URL.createObjectURL(blob);
          setLoaded({ assetCid, url });
        })
        .catch(() => undefined);
    };
    let observer: IntersectionObserver | undefined;

    if (
      loading === 'lazy' &&
      typeof IntersectionObserver !== 'undefined' &&
      imageRef.current
    ) {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          load();
        },
        { rootMargin: '300px' },
      );
      observer.observe(imageRef.current);
    } else {
      load();
    }

    return () => {
      observer?.disconnect();
      controller.abort();

      if (url) URL.revokeObjectURL(url);
    };
  }, [assetCid, loading]);

  const src = isIndependentClient()
    ? loaded.assetCid === assetCid
      ? loaded.url
      : undefined
    : applicationContainer.stickers.assetUrl(assetCid);

  return (
    <img {...props} ref={imageRef} loading={loading} src={src || undefined} />
  );
}
