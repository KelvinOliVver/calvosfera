import { useState, type ReactNode } from "react";
import { nameOf, type Profile } from "./ProfileDialogs";

const TOKEN =
  /(```[\s\S]+?```|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|~~[^~\n]+~~|\|\|[^|\n]+\|\||@[a-zA-Z0-9_.]+|https?:\/\/[^\s<]+)/g;

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      onClick={() => setShown(true)}
      className={`cursor-pointer rounded px-0.5 transition ${shown ? "bg-accent" : "bg-muted-foreground text-transparent select-none"}`}
    >
      {children}
    </span>
  );
}

/** Markdown estilo Discord: **negrito**, *itálico*, __sublinhado__, ~~riscado~~, `código`, ||spoiler||, @menção, links. */
export function MessageText({
  text,
  byName,
  onMention,
}: {
  text: string;
  byName: Record<string, Profile>;
  onMention: (p: Profile) => void;
}) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((t, i) => {
        if (!t) return null;
        if (i % 2 === 0) return <span key={i}>{t}</span>;
        if (t.startsWith("```"))
          return (
            <pre key={i} className="my-1 overflow-x-auto rounded-md border bg-rail p-2 font-mono text-sm">
              {t.slice(3, -3).replace(/^\n/, "")}
            </pre>
          );
        if (t.startsWith("`")) return <code key={i} className="rounded bg-rail px-1 py-0.5 font-mono text-[0.85em]">{t.slice(1, -1)}</code>;
        if (t.startsWith("**")) return <strong key={i}>{t.slice(2, -2)}</strong>;
        if (t.startsWith("__")) return <u key={i}>{t.slice(2, -2)}</u>;
        if (t.startsWith("~~")) return <s key={i}>{t.slice(2, -2)}</s>;
        if (t.startsWith("||")) return <Spoiler key={i}>{t.slice(2, -2)}</Spoiler>;
        if (t.startsWith("*")) return <em key={i}>{t.slice(1, -1)}</em>;
        if (t.startsWith("@")) {
          const key = t.slice(1).toLowerCase();
          const p = byName[key];
          if (key === "everyone" || key === "here")
            return <span key={i} className="rounded bg-primary/20 px-0.5 font-medium text-primary">{t}</span>;
          if (!p) return <span key={i}>{t}</span>;
          return (
            <button key={i} onClick={() => onMention(p)} className="rounded bg-primary/20 px-0.5 font-medium text-primary transition hover:bg-primary hover:text-primary-foreground">
              @{nameOf(p)}
            </button>
          );
        }
        return (
          <a key={i} href={t} target="_blank" rel="noreferrer" className="text-secondary hover:underline">
            {t}
          </a>
        );
      })}
    </>
  );
}
