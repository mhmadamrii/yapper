import { useEffect, useState } from 'react';
import { Button } from '@yapper/ui/components/button';
import { ArrowUp } from 'lucide-react';

import { Show } from '@/components/control-flow';

const SHOW_AFTER_PX = 600;

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Show when={visible}>
      <Button
        variant="secondary"
        size="icon"
        aria-label="Scroll to top"
        className="border-border size-12 rounded-full border shadow-lg"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <ArrowUp className="text-primary size-5" />
      </Button>
    </Show>
  );
}
