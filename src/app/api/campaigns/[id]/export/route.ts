import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { getCampaign, getRecipients } from "@/lib/campaigns";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const { id } = await ctx.params;

  const campaign = getCampaign(userId, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const recipients = getRecipients(id, undefined, 100_000);
  const rows = recipients.map((r, i) => ({
    "#": i + 1,
    "Phone Number": r.number,
    Status: r.status === "success" ? "Successful" : r.status === "failed" ? "Failed" : "Unsent",
    Error: r.error ?? "",
    "Sent At": r.sent_at ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 12 }, { wch: 40 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const safeName = campaign.name.replace(/[^\w\d\- ]/g, "").replace(/\s+/g, "-").slice(0, 40) || "campaign";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeName}-results.xlsx"`,
    },
  });
}
