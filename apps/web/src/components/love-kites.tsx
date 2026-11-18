import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { For, Show } from '@/components/control-flow';
import { useSession } from '@/hooks/use-session';
import { burstHearts, isSpecialUsername } from '@/components/love-rain';

// Canvas the kites fly in, pinned to the viewport's bottom-right corner.
// Every string ends at its bottom-right point (W, H), like one hand holding
// them all.
const W = 380;
const H = 460;

type Kite = {
  src: string;
  // Centre of the diamond and the side of the (unrotated) square frame.
  cx: number;
  cy: number;
  size: number;
  // Per-kite phase and speed so they never bob in sync.
  phase: number;
  speed: number;
};

// Listed back to front: later kites overlap earlier ones.
const KITES: Kite[] = [
  {
    src: '/mine/kite-3.jpg',
    cx: 95,
    cy: 270,
    size: 90,
    phase: 2.1,
    speed: 0.9,
  },
  {
    src: '/mine/kite-1.jpg',
    cx: 125,
    cy: 150,
    size: 110,
    phase: 0,
    speed: 0.7,
  },
  {
    src: '/mine/kite-4.jpg',
    cx: 250,
    cy: 225,
    size: 95,
    phase: 3.4,
    speed: 0.8,
  },
  {
    src: '/mine/kite-2.jpg',
    cx: 225,
    cy: 100,
    size: 120,
    phase: 1.2,
    speed: 0.6,
  },
];

// Where a kite is at time `t` (seconds): a small bob, drift and tilt.
function pose(kite: Kite, t: number) {
  const s = t * kite.speed + kite.phase;
  return {
    dx: Math.cos(s * 0.7) * 5,
    dy: Math.sin(s) * 8,
    tilt: Math.sin(s * 0.8) * 4,
  };
}

const STILL = { dx: 0, dy: 0, tilt: 0 };

// Per-kite drag state. `x`/`y` is the offset from the kite's resting spot;
// while held it follows the pointer, once released it springs back to 0.
type Drag = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  held: boolean;
  pointerX: number;
  pointerY: number;
  startX: number;
  startY: number;
};

const newDrag = (): Drag => ({
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  held: false,
  pointerX: 0,
  pointerY: 0,
  startX: 0,
  startY: 0,
});

// Underdamped spring: overshoots and wobbles a couple of times before it
// settles, which is what makes the snap-back read as elastic.
const SPRING = 140;
const DAMPING = 9;

// The string from the kite's bottom corner down to the anchor: drops first,
// then sweeps right, with a little wind in the middle.
function stringPath(
  kite: Kite,
  t: number,
  p: ReturnType<typeof pose>,
  drag: Drag,
) {
  const half = (kite.size * Math.SQRT2) / 2;
  const rad = (p.tilt * Math.PI) / 180;
  const bx = kite.cx + p.dx + drag.x - Math.sin(rad) * half;
  const by = kite.cy + p.dy + drag.y + Math.cos(rad) * half;
  const wind = Math.sin(t * 1.3 + kite.phase) * 10;
  return `M ${bx} ${by} C ${bx + wind} ${by + (H - by) * 0.6}, ${
    W - 70 + wind
  } ${by + (H - by) * 0.4}, ${W} ${H}`;
}

function frameTransform(p: ReturnType<typeof pose>, drag: Drag) {
  const scale = drag.held ? 1.08 : 1;
  return `translate(${p.dx + drag.x}px, ${p.dy + drag.y}px) rotate(${
    45 + p.tilt
  }deg) scale(${scale})`;
}

// Photo kites floating in the bottom-right corner for one special account.
// xl+ only, where that corner is the right sidebar rather than posts. Each
// kite can be grabbed and dragged (its string stretches along); letting go
// springs it back to its spot with a heart burst. With reduced motion the
// kites hang still and snap back without the spring or burst.
export function LoveKites() {
  const { data: session } = useSession();
  // Mount-gated so server and client hydrate the same (empty) markup, and
  // the photos are only fetched for the special account.
  const [mounted, setMounted] = useState(false);
  const isSpecial = isSpecialUsername(session?.user.username);
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stringRefs = useRef<(SVGPathElement | null)[]>([]);
  const drags = useRef<Drag[]>(KITES.map(newDrag));

  useEffect(() => setMounted(true), []);

  // One rAF loop drives every kite and its string together, writing
  // straight to the DOM so the strings stay attached without re-rendering.
  useEffect(() => {
    if (!mounted || !isSpecial) return;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    let frame = 0;
    const start = performance.now();
    let last = start;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      // Capped so a backgrounded tab doesn't come back with one huge step.
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      KITES.forEach((kite, i) => {
        const drag = drags.current[i]!;
        if (drag.held) {
          drag.x = drag.startX + drag.pointerX;
          drag.y = drag.startY + drag.pointerY;
        } else if (reduced) {
          drag.x = drag.y = drag.vx = drag.vy = 0;
        } else {
          drag.vx += (-SPRING * drag.x - DAMPING * drag.vx) * dt;
          drag.vy += (-SPRING * drag.y - DAMPING * drag.vy) * dt;
          drag.x += drag.vx * dt;
          drag.y += drag.vy * dt;
        }
        const p = reduced ? STILL : pose(kite, t);
        frameRefs.current[i]?.style.setProperty(
          'transform',
          frameTransform(p, drag),
        );
        stringRefs.current[i]?.setAttribute('d', stringPath(kite, t, p, drag));
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mounted, isSpecial]);

  const grab = (i: number) => (e: PointerEvent<HTMLDivElement>) => {
    const drag = drags.current[i]!;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Pointer movement is stored relative to the grab point, and `start`
    // keeps any offset left over from a spring that hadn't settled yet.
    drag.held = true;
    drag.startX = drag.x - e.clientX;
    drag.startY = drag.y - e.clientY;
    drag.pointerX = e.clientX;
    drag.pointerY = e.clientY;
    drag.vx = drag.vy = 0;
    e.currentTarget.style.zIndex = '10';
  };

  const move = (i: number) => (e: PointerEvent<HTMLDivElement>) => {
    const drag = drags.current[i]!;
    if (!drag.held) return;
    drag.pointerX = e.clientX;
    drag.pointerY = e.clientY;
  };

  const release = (i: number) => (e: PointerEvent<HTMLDivElement>) => {
    const drag = drags.current[i]!;
    if (!drag.held) return;
    drag.held = false;
    e.currentTarget.style.zIndex = '';
    const rect = e.currentTarget.getBoundingClientRect();
    burstHearts(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  return (
    <Show when={mounted && isSpecial}>
      <div
        aria-hidden
        className="pointer-events-none fixed right-0 bottom-0 z-40 hidden xl:block"
        style={{ width: W, height: H }}
      >
        {/* overflow-visible: a dragged kite can pull its string outside the
            canvas box. */}
        <svg
          className="text-foreground/60 absolute inset-0 overflow-visible"
          width={W}
          height={H}
          fill="none"
        >
          <For each={KITES}>
            {(kite, i) => (
              <path
                key={kite.src}
                ref={(el) => {
                  stringRefs.current[i] = el;
                }}
                d={stringPath(kite, 0, pose(kite, 0), newDrag())}
                stroke="currentColor"
                strokeWidth={1.25}
              />
            )}
          </For>
        </svg>
        <For each={KITES}>
          {(kite, i) => (
            <div
              key={kite.src}
              ref={(el) => {
                frameRefs.current[i] = el;
              }}
              onPointerDown={grab(i)}
              onPointerMove={move(i)}
              onPointerUp={release(i)}
              onPointerCancel={release(i)}
              className="border-foreground/70 pointer-events-auto absolute cursor-grab touch-none overflow-hidden border shadow-lg select-none active:cursor-grabbing"
              style={{
                left: kite.cx - kite.size / 2,
                top: kite.cy - kite.size / 2,
                width: kite.size,
                height: kite.size,
                transform: frameTransform(pose(kite, 0), newDrag()),
              }}
            >
              {/* The frame is a square turned 45° into a diamond; the photo
                  turns back -45° so it reads upright, and is √2 larger so it
                  still covers the whole diamond with no empty corners. */}
              <img
                src={kite.src}
                alt=""
                className="absolute max-w-none object-cover"
                style={{
                  width: kite.size * Math.SQRT2,
                  height: kite.size * Math.SQRT2,
                  left: (kite.size - kite.size * Math.SQRT2) / 2,
                  top: (kite.size - kite.size * Math.SQRT2) / 2,
                  transform: 'rotate(-45deg)',
                }}
                draggable={false}
              />
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}
