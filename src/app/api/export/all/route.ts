import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const userId = await getCurrentUserId();
  requireUserId(userId);

  const rows = db
    .prepare(
      `SELECT c.name AS campaign, c.created_at AS created, c.status,
              r.number, r.status AS result, r.error, r.sent_at
       FROM recipients r
       JOIN campaigns c ON c.id = r.campaign_id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC, r.rowid ASC`,
    )
    .all(userId) as Record<string, string>[];

  const ws = XLSX.utils.json_to_sheet(
    rows.map((r, i) => ({
      "#": i + 1,
      Campaign: r.campaign,
      "Created": r.created ?? "",
      "Status": r.status ?? "",
      "Phone Number": r.number,
      Result: r.result === "success" ? "Successful" : r.result === "failed" ? "Failed" : "Unsent",
      Error: r.error ?? "",
      "Sent At": r.sent_at ?? "",
    })),
  );
  ws["!cols"] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 20 },
    { wch: 10 },
    { wch: 18 },
    { wch: 12 },
    { wch: 40 },
    { wch: 22 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "All results");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="wa-sender-all-campaigns.xlsx"',
    },
  });
}
