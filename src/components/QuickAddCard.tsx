import { useRef, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { usePosts } from "@/context/PostsContext";
import { toast } from "@/hooks/use-toast";

interface QuickAddCardProps {
  columnId: string | null;
}

/**
 * Inline "spreadsheet-style" quick add: type a title, press Enter,
 * card is created and the input stays focused for the next one.
 */
export const QuickAddCard = ({ columnId }: QuickAddCardProps) => {
  const { addPost } = usePosts();
  const [title, setTitle] = useState("");
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const ok = await addPost({
        title: trimmed,
        imageUrl: "",
        mediaType: "image",
        mediaUrls: [],
        caption: "",
        status: ["entrada"],
        tags: [],
        columnId,
        clientCreated: false,
        deadline: undefined,
      });
      if (ok) {
        setTitle("");
        // Keep focus to add another one immediately
        requestAnimationFrame(() => inputRef.current?.focus());
      } else {
        toast({ title: "Não foi possível criar o card", variant: "destructive" });
      }
    } catch (err: any) {
      toast({
        title: "Erro ao criar card",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => {
          setActive(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        className="mt-ui-2 flex w-full items-center justify-center gap-ui-2 rounded-ui-md border border-dashed border-muted-foreground/30 py-ui-2 text-ui-xs text-muted-foreground transition-colors hover:border-accent hover:text-accent"
      >
        <Plus className="size-icon-sm" /> Adicionar card
      </button>
    );
  }

  return (
    <div className="mt-ui-2 rounded-ui-md border border-accent/40 bg-card/70 p-ui-2 shadow-sm">
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleCreate();
          } else if (e.key === "Escape") {
            setTitle("");
            setActive(false);
          }
        }}
        onBlur={() => {
          if (!title.trim()) setActive(false);
        }}
        placeholder="Título do card e Enter…"
        disabled={saving}
        className="w-full bg-transparent text-ui-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      {saving && (
        <div className="mt-ui-1 flex items-center gap-ui-1 text-ui-xs text-muted-foreground">
          <Loader2 className="size-icon-xs animate-spin" /> Criando…
        </div>
      )}
    </div>
  );
};
