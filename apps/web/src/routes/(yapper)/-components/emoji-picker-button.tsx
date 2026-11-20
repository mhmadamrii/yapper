import { Button } from '@yapper/ui/components/button';
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from '@yapper/ui/components/emoji-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@yapper/ui/components/popover';
import { Smile } from 'lucide-react';
import { useState, type RefObject } from 'react';

/**
 * Emoji picker for the composers. The pick is spliced in at the textarea's
 * caret (replacing any selected text), then focus and the caret go back to
 * the textarea just after the inserted emoji.
 */
export function EmojiPickerButton({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const insert = (emoji: string) => {
    const el = textareaRef.current;
    // No caret yet (textarea never focused) → append.
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + emoji + value.slice(end));
    setOpen(false);
    // After the controlled value re-renders and the popover hands focus
    // back to the textarea (`finalFocus`), put the caret after the emoji.
    const caret = start + emoji.length;
    requestAnimationFrame(() => el?.setSelectionRange(caret, caret));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="Add an emoji">
            <Smile className="size-5" />
          </Button>
        }
      />
      <PopoverContent
        side="top"
        align="start"
        finalFocus={textareaRef}
        className="overflow-hidden p-0"
        style={{ height: 'min(360px, var(--available-height))' }}
      >
        <EmojiPicker onEmojiSelect={({ emoji }) => insert(emoji)}>
          <EmojiPickerSearch />
          <EmojiPickerContent />
          <EmojiPickerFooter />
        </EmojiPicker>
      </PopoverContent>
    </Popover>
  );
}
