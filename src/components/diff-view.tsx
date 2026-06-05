import { useState } from "react";
import type { FileDiff } from "@/lib/mock-data";
import { ChevronDown, FilePlus2, FileEdit } from "lucide-react";

function lineColor(type: string) {
  switch (type) {
    case "add": return "bg-success/10 border-l-2 border-success/60";
    case "del": return "bg-critical/10 border-l-2 border-critical/60";
    case "hunk": return "bg-accent/10 text-accent";
    default: return "";
  }
}

function lineSign(type: string) {
  if (type === "add") return "+";
  if (type === "del") return "-";
  return " ";
}

export function DiffView({ diff }: { diff: FileDiff }) {
  const [open, setOpen] = useState(true);
  const adds = diff.lines.filter((l) => l.type === "add").length;
  const dels = diff.lines.filter((l) => l.type === "del").length;
  const Icon = diff.status === "added" ? FilePlus2 : FileEdit;
  const iconColor = diff.status === "added" ? "text-success" : "text-warning";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 border-b border-border bg-surface px-4 py-2.5 text-left hover:bg-muted"
      >
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "" : "-rotate-90"}`} />
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span className="flex-1 truncate font-mono text-sm">{diff.path}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {diff.status}
        </span>
        <span className="font-mono text-xs text-success">+{adds}</span>
        {dels > 0 && <span className="font-mono text-xs text-critical">-{dels}</span>}
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="min-w-full font-mono text-[12px] leading-5">
            <tbody>
              {diff.lines.map((l, idx) => (
                <tr key={idx} className={lineColor(l.type)}>
                  <td className="select-none px-2 py-0.5 text-right text-muted-foreground/60 w-10">{l.oldNo ?? ""}</td>
                  <td className="select-none px-2 py-0.5 text-right text-muted-foreground/60 w-10">{l.newNo ?? ""}</td>
                  <td className="select-none px-2 py-0.5 text-muted-foreground w-5">{lineSign(l.type)}</td>
                  <td className="whitespace-pre px-2 py-0.5">{l.text || " "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
