import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Seletor de emojis leve e sem dependências externas.
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Sorrisos",
    emojis: ["😀","😁","😂","🤣","😊","😇","🙂","😉","😍","😘","😗","😎","🤩","🥳","😋","😛","😜","🤪","😏","🙃","🤗","🤔","🤨","😐","😴","😷","🤒","🥰","😅","😆"],
  },
  {
    label: "Gestos",
    emojis: ["👍","👎","👌","✌️","🤞","🤝","👏","🙌","🙏","💪","👋","🤙","☝️","✋","🖐️","👊","✊","🤛","🤜","🫶","👀","💯"],
  },
  {
    label: "Emoções",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❣️","💕","💞","💓","💗","🔥","⭐","✨","🎉","🎊","🥲","😢","😭","😩","😤","😡","🥺"],
  },
  {
    label: "Trabalho",
    emojis: ["✅","❌","⚠️","📌","📎","📝","📄","📅","📞","💬","📲","💰","💵","🏦","🛒","📦","🚚","🏠","🎨","🖌️","🪣","🧱"],
  },
];

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0 rounded-full"
          title="Emojis"
        >
          <Smile className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-2 max-h-72 overflow-y-auto">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label} className="mb-2">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground px-1 mb-1">{group.label}</p>
            <div className="grid grid-cols-8 gap-0.5">
              {group.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onSelect(emoji)}
                  className="text-xl leading-none p-1 rounded hover:bg-muted transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
