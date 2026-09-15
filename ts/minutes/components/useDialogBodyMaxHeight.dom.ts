// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';

const BODY_CHROME_OFFSET_PX = 200;
const MIN_BODY_HEIGHT_PX = 220;
const MAX_BODY_HEIGHT_PX = 560;

export function useDialogBodyMaxHeight(open: boolean): number {
  const [maxHeight, setMaxHeight] = useState(MAX_BODY_HEIGHT_PX);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updateMaxHeight = (): void => {
      setMaxHeight(
        Math.min(
          MAX_BODY_HEIGHT_PX,
          Math.max(MIN_BODY_HEIGHT_PX, window.innerHeight - BODY_CHROME_OFFSET_PX)
        )
      );
    };

    updateMaxHeight();
    window.addEventListener('resize', updateMaxHeight);
    return () => {
      window.removeEventListener('resize', updateMaxHeight);
    };
  }, [open]);

  return maxHeight;
}
