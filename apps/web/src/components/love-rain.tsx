import { useEffect, useState } from 'react';
import { For, Show } from '@/components/control-flow';
import { useSession } from '@/hooks/use-session';
import { SPECIAL_USERNAME } from '@/lib/constants';

const GLYPHS = ['💗', '💖', '💕', '❤️', '💞'];
const BURST_COUNT = 12;
const FOUNTAIN_COUNT = 14;

export function isSpecialUsername(username: string | null | undefined) {
  return username?.toLowerCase() === SPECIAL_USERNAME;
}

// One-shot ring of hearts flying out of (x, y) in viewport coordinates.
// Plain DOM rather than React state: it lives ~1s and needs no re-render.
// Fired when a kite is let go (love-kites.tsx). Each node removes itself
// when its animation ends.
export function burstHearts(x: number, y: number) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < BURST_COUNT; i++) {
    const angle = (i / BURST_COUNT) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 50 + Math.random() * 50;
    const node = document.createElement('span');
    node.textContent = GLYPHS[i % GLYPHS.length]!;
    node.setAttribute('aria-hidden', 'true');
    node.className = 'love-burst';
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.fontSize = `${12 + Math.random() * 12}px`;
    node.style.setProperty('--burst-x', `${Math.cos(angle) * distance}px`);
    // Biased upward so the hearts float off rather than fall.
    node.style.setProperty('--burst-y', `${Math.sin(angle) * distance - 30}px`);
    node.addEventListener('animationend', () => node.remove(), { once: true });
    document.body.appendChild(node);
  }
}

type Jet = {
  glyph: string;
  size: number;
  dx: number;
  dy: number;
  duration: number;
  delay: number;
};

function makeJets(): Jet[] {
  return Array.from({ length: FOUNTAIN_COUNT }, (_, i) => {
    // Aim up and to the left, between 15° and 80° above the horizontal, so
    // the stream fans out of the corner into the page.
    const angle = ((15 + Math.random() * 65) * Math.PI) / 180;
    const distance = 140 + Math.random() * 200;
    return {
      glyph: GLYPHS[i % GLYPHS.length]!,
      size: 14 + Math.random() * 14,
      dx: -Math.cos(angle) * distance,
      dy: -Math.sin(angle) * distance,
      duration: 2.5 + Math.random() * 2,
      // Negative delay so the stream is already flowing on first paint.
      delay: -Math.random() * 4.5,
    };
  });
}

// A steady stream of hearts gushing out of the viewport's bottom-right
// corner, for one special account. xl+ only, where that corner is the right
// sidebar rather than posts. Purely decorative: click-through, hidden from
// screen readers and for reduced motion.
export function HeartFountain() {
  const { data: session } = useSession();
  // Random trajectories are generated after mount so the server and client
  // render the same (empty) markup on hydration.
  const [jets, setJets] = useState<Jet[]>([]);
  const isSpecial = isSpecialUsername(session?.user.username);

  useEffect(() => {
    setJets(isSpecial ? makeJets() : []);
  }, [isSpecial]);

  return (
    <Show when={jets.length > 0}>
      <div
        aria-hidden
        className="pointer-events-none fixed right-0 bottom-0 z-40 hidden motion-reduce:hidden xl:block"
      >
        <For each={jets}>
          {(jet, i) => (
            <span
              key={i}
              className="love-gush absolute right-0 bottom-0"
              style={{
                fontSize: jet.size,
                animationDuration: `${jet.duration}s`,
                animationDelay: `${jet.delay}s`,
                ['--gush-x' as string]: `${jet.dx}px`,
                ['--gush-y' as string]: `${jet.dy}px`,
              }}
            >
              {jet.glyph}
            </span>
          )}
        </For>
      </div>
    </Show>
  );
}
