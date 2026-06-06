import { lazy, Suspense } from 'react';

import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';
import type { LightboxImage } from './imageLightbox';

type LazyImageLightboxProps = {
  images: LightboxImage[];
  initialIndex: number;
  loadImage?: (attachment: MessageAttachment) => Promise<string>;
  onClose: () => void;
};

const ImageLightbox = lazy(() =>
  import('./imageLightbox').then((module) => ({
    default: module.ImageLightbox,
  })),
);

export function LazyImageLightbox(props: LazyImageLightboxProps) {
  return (
    <Suspense fallback={null}>
      <ImageLightbox {...props} />
    </Suspense>
  );
}
