import { useState } from 'react';
import { Button } from '@yapper/ui/components/button';
import { Textarea } from '@yapper/ui/components/textarea';
import { SendHorizontal } from 'lucide-react';
import { useSendMessage } from '@/lib/use-send-message';

export function MessageComposer({
  conversationId,
}: {
  conversationId: string;
}) {
  const [text, setText] = useState('');
  const { sendMessage } = useSendMessage(conversationId);

  // Not gated on an in-flight send: every message gets its own optimistic
  // bubble, so rapid-fire sends queue up visibly instead of being dropped.
  const handleSend = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    sendMessage(body);
  };

  return (
    <div className="border-border flex items-end gap-2 border-t p-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Start a new message"
        rows={1}
        className="max-h-40 min-h-9 flex-1 resize-none rounded-full py-2"
      />
      <Button
        size="icon-sm"
        className="shrink-0 rounded-full"
        disabled={!text.trim()}
        onClick={handleSend}
      >
        <SendHorizontal className="size-4" />
      </Button>
    </div>
  );
}
