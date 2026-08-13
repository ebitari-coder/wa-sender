"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import { normalizeNumber } from "@/lib/numbers";
import { useToast } from "@/components/ui/Toast";

export default function NumberInput({
  numbers,
  onChange,
}: {
  numbers: string[];
  onChange: (numbers: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  function addFromDraft() {
    const parsed = draft
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const valid = parsed.map(normalizeNumber).filter(Boolean) as string[];
    const invalid = parsed.filter((p) => !normalizeNumber(p));
    if (invalid.length) {
      toast(`${invalid.length} invalid number(s) skipped.`, "error");
    }
    if (valid.length) {
      onChange([...numbers, ...valid.filter((n) => !numbers.includes(n))]);
      setDraft("");
      toast(`Added ${valid.length} number(s).`, "success");
    }
  }

  function downloadTemplate() {
    const rows = [
      "+2348076458086",
      "+2347017562825",
      "+2349151947366",
      "+2349034543454",
      "+2347031714830",
      "+2348039296787",
      "+2348116262853",
      "+234816816994",
      "+2348166653762",
      "+2348081949949",
      "+2349067750114",
      "+2348136494517",
      "+2348034131447",
      "+2348106992888",
      "+2347060455539",
      "+2347033552359",
      "+2349067185075",
      "+2348129764748",
      "+2348103500531",
      "+2347060472153",
      "+2348148252340",
      "+2349034562610",
      "+2348138138905",
      "+2348060147413",
      "+2347026403051",
    ];
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Phone Number", "Name (optional)"],
      ...rows.map((n) => [n, ""]),
    ]);
    sheet["!cols"] = [{ wch: 18 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Recipients");
    XLSX.writeFile(wb, "wa-sender-recipients-template.xlsx");
  }

  function remove(n: string) {
    onChange(numbers.filter((x) => x !== n));
  }

  function clearAll() {
    onChange([]);
  }

  async function importFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      if (ext === "csv" || ext === "txt") {
        const text = await file.text();
        const parsed = text
          .split(/[\r\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map(normalizeNumber)
          .filter(Boolean) as string[];
        const unique = Array.from(new Set(parsed));
        onChange([...numbers, ...unique.filter((n) => !numbers.includes(n))]);
        toast(`Imported ${unique.length} number(s).`, "success");
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
        const found: string[] = [];
        for (const row of rows) {
          for (const cell of row) {
            if (cell == null) continue;
            const raw = String(cell).replace(/[^\d+\s-]/g, "").trim();
            const n = normalizeNumber(raw);
            if (n) found.push(n);
          }
        }
        const unique = Array.from(new Set(found));
        onChange([...numbers, ...unique.filter((n) => !numbers.includes(n))]);
        toast(`Imported ${unique.length} number(s) from ${file.name}.`, "success");
      }
    } catch {
      toast("Could not read that file.", "error");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-stone-500">
          {numbers.length > 0 ? (
            <b className="font-semibold text-accent">{numbers.length}</b>
          ) : (
            "No"
          )}{" "}
          number{numbers.length === 1 ? "" : "s"} added
        </span>
        {numbers.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-red-500 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addFromDraft();
        }}
        placeholder={"Paste phone numbers here — one per line or comma separated.\n\n08012345678\n+2347012345678\n07012223344"}
        rows={4}
        className="w-full resize-none rounded-xl border border-stone-300 bg-white px-3.5 py-3 font-mono text-sm text-stone-900 placeholder:font-sans placeholder:text-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={addFromDraft} disabled={!draft.trim()}>
          <Icon name="plus" className="h-3.5 w-3.5" />
          Add numbers
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={downloadTemplate}>
          <Icon name="download" className="h-3.5 w-3.5" />
          Download template
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" className="h-3.5 w-3.5" />
          Import Excel / CSV
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = "";
          }}
        />
        <span className="text-[11px] text-stone-400">Auto-detects the phone column.</span>
      </div>

      {numbers.length > 0 && (
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50 p-2">
          {numbers.map((n) => (
            <span
              key={n}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-700 ring-1 ring-stone-200"
            >
              {n}
              <button
                type="button"
                onClick={() => remove(n)}
                className="text-stone-400 hover:text-red-500"
                aria-label={`Remove ${n}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
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
