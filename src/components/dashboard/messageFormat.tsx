import { Fragment, type ReactNode } from "react";

type Token =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "strike"; value: string }
  | { type: "mono"; value: string };

const MARKERS = [
  { marker: "*", type: "bold" as const },
  { marker: "_", type: "italic" as const },
  { marker: "~", type: "strike" as const },
  { marker: "```", type: "mono" as const },
];

export function parseWhatsApp(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    let found = false;

    for (const { marker, type } of MARKERS) {
      if (text.startsWith(marker, i)) {
        const end = text.indexOf(marker, i + marker.length);
        if (end > i) {
          tokens.push({ type, value: text.slice(i + marker.length, end) });
          i = end + marker.length;
          found = true;
          break;
        }
      }
    }
    if (found) continue;

    // Find the earliest marker start in the remainder to cut text runs.
    let next = -1;
    for (const { marker } of MARKERS) {
      const p = text.indexOf(marker, i);
      if (p !== -1 && (next === -1 || p < next)) next = p;
    }
    const end = next === -1 ? text.length : next;
    tokens.push({ type: "text", value: text.slice(i, end) });
    i = end;
  }

  return tokens;
}

export function renderWhatsApp(text: string): ReactNode {
  return parseWhatsApp(text).map((t, idx) => {
    const key = `${t.type}-${idx}`;
    switch (t.type) {
      case "bold":
        return (
          <strong key={key} className="font-bold">
            {t.value}
          </strong>
        );
      case "italic":
        return (
          <em key={key} className="italic">
            {t.value}
          </em>
        );
      case "strike":
        return (
          <del key={key} className="line-through">
            {t.value}
          </del>
        );
      case "mono":
        return (
          <code
            key={key}
            className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.9em] text-stone-700"
          >
            {t.value}
          </code>
        );
      default:
        return <Fragment key={key}>{t.value}</Fragment>;
    }
  });
}
