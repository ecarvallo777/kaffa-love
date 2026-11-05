import { NextResponse } from "next/server";
import { getStaff } from "@/lib/auth";
import { buildTemplate } from "@/lib/purchases";

export async function GET() {
  const staff = await getStaff();
  if (staff?.role !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const file = await buildTemplate();
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-compras-kaffa-love.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
