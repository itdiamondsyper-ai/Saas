import { NextResponse, type NextRequest } from "next/server";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { getWorkspaceContext } from "@/lib/server/context";
import { getInvoiceDetail } from "@/lib/services/invoices";
import { uuid } from "@/lib/validation/common";

export async function GET(_request: NextRequest, { params }: RouteContext<"/api/invoices/[id]/pdf">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const detail = await getInvoiceDetail(ctx, id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const bytes = await renderInvoicePdf(detail);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${detail.invoice.number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[pdf] failed to render invoice", id, error);
    return NextResponse.json({ error: "We couldn't generate this PDF. Please try again." }, { status: 500 });
  }
}
