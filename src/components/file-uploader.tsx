import { useRef, useState, useCallback } from "react";
import {
  ACCEPT_ATTR,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  validateFile,
  formatBytes,
  categoryFor,
  type IngestCategory,
} from "@/lib/file-ingest";

export type IngestedFile = {
  id: string;
  name: string;
  size: number;
  category: IngestCategory;
  status: "queued" | "scanning" | "clean" | "rejected";
  reason?: string;
};

export function FileUploader({
  onChange,
  initial = [],
}: {
  onChange?: (files: IngestedFile[]) => void;
  initial?: IngestedFile[];
}) {
  const [files, setFiles] = useState<IngestedFile[]>(initial);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  const ingest = useCallback(
    (incoming: FileList | File[]) => {
      const next: IngestedFile[] = [...files];
      let running = totalBytes;
      for (const file of Array.from(incoming)) {
        const id = `${file.name}-${file.size}-${file.lastModified}`;
        if (next.some((f) => f.id === id)) continue;
        const v = validateFile(file);
        if (!v.ok) {
          next.push({
            id, name: file.name, size: file.size,
            category: categoryFor(file.name) ?? "Data",
            status: "rejected", reason: v.reason,
          });
          continue;
        }
        if (running + file.size > MAX_TOTAL_BYTES) {
          next.push({
            id, name: file.name, size: file.size,
            category: v.category, status: "rejected",
            reason: `Batch exceeds ${formatBytes(MAX_TOTAL_BYTES)} cap`,
          });
          continue;
        }
        running += file.size;
        next.push({
          id, name: file.name, size: file.size,
          category: v.category, status: "scanning",
        });
        // Simulated virus-scan hook — replace with real AV when backend lands.
        setTimeout(() => {
          setFiles((cur) => {
            const updated = cur.map((f) =>
              f.id === id ? { ...f, status: "clean" as const } : f
            );
            onChange?.(updated);
            return updated;
          });
        }, 600 + Math.random() * 400);
      }
      setFiles(next);
      onChange?.(next);
    },
    [files, totalBytes, onChange]
  );

  const remove = (id: string) => {
    setFiles((cur) => {
      const updated = cur.filter((f) => f.id !== id);
      onChange?.(updated);
      return updated;
    });
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border border-dashed rounded-sm p-6 text-center cursor-pointer transition-colors ${
          drag ? "border-primary bg-primary/5" : "border-border bg-muted/20 hover:bg-muted/40"
        }`}
      >
        <div className="text-xs font-bold uppercase tracking-widest text-foreground">
          Drop files or click to upload
        </div>
        <div className="text-[10px] font-mono text-muted-foreground mt-1">
          Max 25 MB / file · 250 MB / batch · scanned on ingest
        </div>
        <div className="text-[10px] font-mono text-muted-foreground mt-2">
          .pdf .doc .docx .xls .xlsx .csv .ppt .pptx .rtf .txt .jpg .png .tif .msg .eml .zip .xml .json
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => e.target.files && ingest(e.target.files)}
        />
      </div>

      {files.length > 0 ? (
        <div className="border border-border rounded-sm divide-y divide-border bg-surface">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 px-3 py-2 text-xs">
              <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground w-20 shrink-0">
                {f.category}
              </span>
              <span className="flex-1 truncate font-mono">{f.name}</span>
              <span className="text-[10px] font-mono text-muted-foreground w-16 text-right">
                {formatBytes(f.size)}
              </span>
              <StatusDot status={f.status} reason={f.reason} />
              <button
                onClick={() => remove(f.id)}
                className="text-[10px] font-mono text-muted-foreground hover:text-destructive"
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="px-3 py-2 text-[10px] font-mono text-muted-foreground flex justify-between">
            <span>{files.length} file{files.length === 1 ? "" : "s"}</span>
            <span>{formatBytes(totalBytes)} / {formatBytes(MAX_TOTAL_BYTES)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusDot({ status, reason }: { status: IngestedFile["status"]; reason?: string }) {
  const map = {
    queued: "bg-muted text-muted-foreground border-border",
    scanning: "bg-warning/15 text-warning border-warning/30",
    clean: "bg-success/15 text-success border-success/30",
    rejected: "bg-destructive/15 text-destructive border-destructive/30",
  } as const;
  const label = status === "clean" ? "✓ clean" : status === "rejected" ? "✗ rejected" : status === "scanning" ? "scanning…" : "queued";
  return (
    <span
      title={reason ?? ""}
      className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border rounded-sm w-24 text-center ${map[status]}`}
    >
      {label}
    </span>
  );
}
