'use client';

import { useEffect } from 'react';
import { useResumeStore } from '@/store/resumeStore';

/**
 * Mounts the resume store from localStorage exactly once on the client.
 *
 * Why a separate component? The store is created at module-import time with
 * an empty resume. We can't read localStorage at import time because that
 * breaks Next.js server rendering. Instead, we hydrate from a client
 * component during the first effect, after the page has mounted.
 *
 * Render this once near the top of the root layout (inside <body>). It
 * renders nothing.
 */
export function StoreHydrator() {
  const hydrate = useResumeStore((s) => s.hydrate);
  const isHydrated = useResumeStore((s) => s.isHydrated);

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [hydrate, isHydrated]);

  return null;
}
