import { authClient } from '@/lib/auth-client';
import { Button } from '@yapper/ui/components/button';
import { ChevronDown, Globe, ImageIcon, ImagePlay, Smile } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@yapper/ui/components/dialog';

const MAX_POST_LENGTH = 300;

export function DialogCreatePost({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const { data: session } = authClient.useSession();

  const remaining = MAX_POST_LENGTH - text.length;
  const canPost = text.trim().length > 0 && remaining >= 0;

  const handlePost = () => {
    // TODO(backend): create post via tRPC once post router exists
    toast.success('Post created');
    setText('');
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setText('');
      }}
    >
      <DialogTrigger render={trigger} />

      <DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            className="text-primary text-base"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-primary text-base">
              Drafts
            </Button>
            <Button
              className="rounded-full px-6"
              disabled={!canPost}
              onClick={handlePost}
            >
              Post
            </Button>
          </div>
        </div>

        <div className="flex gap-3 px-4 pb-4">
          <img
            src={session?.user.image ?? '/prabowo.jpg'}
            alt={session?.user.name ?? 'You'}
            className="size-11 shrink-0 rounded-full object-cover"
          />
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's up?"
            rows={8}
            className="placeholder:text-muted-foreground w-full resize-none bg-transparent pt-2 text-lg outline-none"
          />
        </div>

        <div className="px-4 pb-3">
          <button className="bg-secondary text-secondary-foreground hover:bg-accent flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors">
            <Globe className="size-4" />
            Anyone can interact
            <ChevronDown className="size-4" />
          </button>
        </div>

        <div className="border-border flex items-center justify-between border-t px-4 py-3">
          <div className="text-primary flex items-center gap-1">
            <Button variant="ghost" size="icon-sm">
              <ImageIcon className="size-5" />
            </Button>
            <Button variant="ghost" size="icon-sm">
              <ImagePlay className="size-5" />
            </Button>
            <Button variant="ghost" size="icon-sm">
              <Smile className="size-5" />
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-primary text-sm font-medium">
              English
            </button>
            <span
              className={
                remaining < 0
                  ? 'text-destructive text-sm'
                  : 'text-muted-foreground text-sm'
              }
            >
              {remaining}
            </span>
            <CharProgress used={text.length} max={MAX_POST_LENGTH} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CharProgress({ used, max }: { used: number; max: number }) {
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(used / max, 1);
  const over = used > max;

  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
      <circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        strokeWidth="3"
        className="stroke-border"
      />
      <circle
        cx="14"
        cy="14"
        r={radius}
        fill="none"
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        strokeLinecap="round"
        className={over ? 'stroke-destructive' : 'stroke-primary'}
      />
    </svg>
  );
}
