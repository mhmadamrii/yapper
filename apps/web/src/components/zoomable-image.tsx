import type { ComponentProps, MouseEvent } from 'react';

import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

// Click-to-zoom image. React synthetic events bubble through portals, so the
// zoom modal's clicks would reach a clickable ancestor (e.g. the post card's
// navigate-to-detail handler) — the wrapper stops them here.
export function ZoomableImage({
  zoomSrc,
  ...imgProps
}: ComponentProps<'img'> & {
  // Higher-resolution source shown in the zoomed view.
  zoomSrc?: string;
}) {
  const stopPropagation = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div onClick={stopPropagation} className="contents">
      <Zoom zoomImg={zoomSrc ? { src: zoomSrc } : undefined}>
        <img {...imgProps} />
      </Zoom>
    </div>
  );
}
