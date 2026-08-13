"use client";

import { useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { renderWhatsApp } from "@/components/dashboard/messageFormat";
import { formatBytes } from "@/lib/format";
import type { Attachment } from "@/lib/types";

const MAX_CHARS = 4096;

export default function MessageEditor({
  value,
  onChange,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  uploading,
}: {
  value: string;
  onChange: (v: string) => void;
  attachments: Attachment[];
  onAddFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  uploading: boolean;
}) {
  const [view, setView] = useState<"edit" | "preview">("edit");
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(marker: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const sel = value.slice(start, end) || "text";
    const next = value.slice(0, start) + marker + sel + marker + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + marker.length, start + marker.length + sel.length);
    });
  }

  const tools = [
    { label: "Bold", marker: "*", icon: "B" as const, cls: "font-bold" },
    { label: "Italic", marker: "_", icon: "I" as const, cls: "italic" },
    { label: "Strikethrough", marker: "~", icon: "S" as const, cls: "line-through" },
    { label: "Monospace", marker: "```", icon: "</>" as const, cls: "font-mono text-xs" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
        <div className="flex items-center gap-1">
          {tools.map((t) => (
            <button
              key={t.label}
              type="button"
              title={t.label}
              onClick={() => wrap(t.marker)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm text-stone-600 transition-colors hover:bg-stone-100 ${t.cls}`}
            >
              {t.icon}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg bg-stone-100 p-0.5">
          {(["edit", "preview"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                view === v ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"
              }`}
            >
              {v === "edit" ? "Editor" : "Preview"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#e5ddd5] p-4" style={{ backgroundImage: "none" }}>
        {view === "edit" ? (
          <textarea
            ref={ref}
            value={value}
            maxLength={MAX_CHARS}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              "Type your message…\n\nUse *bold*, _italic_, ~strikethrough~ or ```monospace``` formatting."
            }
            rows={5}
            className="w-full resize-y rounded-xl bg-white p-3 text-sm leading-relaxed text-stone-900 shadow-inner outline-none placeholder:text-stone-400"
          />
        ) : (
          <div className="flex justify-end">
            <div className="wa-chat-bubble max-w-[90%] bg-[#dcf8c6] px-3.5 py-2.5 text-sm leading-relaxed text-stone-800">
              {attachments.map((a) =>
                a.kind === "image" ? (
                  <div key={a.id} className="mb-2 overflow-hidden rounded-lg bg-stone-100">
                    <div className="flex h-36 w-full items-center justify-center bg-stone-200 text-stone-400">
                      <Icon name="image" className="h-8 w-8" />
                    </div>
                    <div className="px-3 py-2 text-[11px] text-stone-500">{a.name}</div>
                  </div>
                ) : (
                  <div key={a.id} className="mb-2 flex items-center gap-2 rounded-lg bg-white/70 p-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded bg-accent/10 text-accent">
                      <Icon name={a.kind === "video" ? "video" : a.kind === "contact" ? "contact" : "doc"} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-stone-700">{a.name}</p>
                      <p className="text-[10px] text-stone-400">{formatBytes(a.size)}</p>
                    </div>
                  </div>
                ),
              )}
              {value ? (
                <span className="whitespace-pre-wrap break-words">{renderWhatsApp(value)}</span>
              ) : (
                <span className="text-stone-400">Message preview will appear here</span>
              )}
              <span className="mt-0.5 flex items-center justify-end gap-1 text-[9px] text-stone-400">
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-sky-500">
                  <path d="m22 7-10 9L7 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 7h5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-3 py-2">
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100">
          <Icon name="image" className="h-4 w-4" />
          Attachment
          <input
            type="file"
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.vcf"
            multiple
            onChange={(e) => {
              if (e.target.files) onAddFiles(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
        </label>
        <div className="flex items-center gap-2 text-[11px] text-stone-400">
          {uploading && <span className="animate-pulse-soft">Uploading…</span>}
          <span className={value.length > MAX_CHARS * 0.9 ? "font-semibold text-amber-600" : ""}>
            {value.length}/{MAX_CHARS}
          </span>
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-stone-100 px-3 py-2">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 py-1 pl-2.5 pr-1 text-[11px] font-medium text-stone-600"
            >
              <Icon
                name={a.kind === "image" ? "image" : a.kind === "video" ? "video" : a.kind === "contact" ? "contact" : "doc"}
                className="h-3.5 w-3.5 text-accent"
              />
              <span className="max-w-40 truncate">{a.name}</span>
              <span className="text-stone-400">· {formatBytes(a.size)}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(a.id)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-red-500"
                aria-label={`Remove ${a.name}`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
