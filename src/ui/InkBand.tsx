'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Dithering = dynamic(() => import('@paper-design/shaders-react').then((m) => m.Dithering), { ssr: false });

/** Franja de trama de imprenta que encabeza las páginas internas. */
export function InkBand({ shape = 'wave' }: { shape?: 'wave' | 'ripple' | 'swirl' | 'simplex' }) {
  const [still, setStill] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lee una preferencia del navegador al montar
    setStill(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  return (
    <div className="relative h-24 overflow-hidden rounded-[22px] border border-ink sm:h-32" aria-hidden>
      <Dithering
        colorBack="#f3eee4"
        colorFront="#1c1a17"
        shape={shape}
        type="4x4"
        size={2}
        scale={1.2}
        speed={still ? 0 : 0.25}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
