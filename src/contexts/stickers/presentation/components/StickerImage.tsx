import type { ImgHTMLAttributes } from 'react';

import { useEffect, useState } from 'react';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { isIndependentClient } from '../../../../shared/infrastructure/client/isIndependentClient';

export function StickerImage({
  assetCid,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  assetCid: string;
}) {
  const [loaded, setLoaded] = useState({ assetCid: '', url: '' });

  useEffect(() => {
    if (!isIndependentClient()) return;
    const controller = new AbortController();
    let url = '';

    void applicationContainer.stickers
      .loadAsset(assetCid, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(blob);
        setLoaded({ assetCid, url });
      })
      .catch(() => undefined);

    return () => {
      controller.abort();

      if (url) URL.revokeObjectURL(url);
    };
  }, [assetCid]);

  const src = isIndependentClient()
    ? loaded.assetCid === assetCid
      ? loaded.url
      : undefined
    : applicationContainer.stickers.assetUrl(assetCid);

  return <img {...props} src={src || undefined} />;
}
