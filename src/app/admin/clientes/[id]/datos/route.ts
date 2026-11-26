import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { exportCustomerData } from "@/lib/privacy-requests";

/** Derecho de acceso y portabilidad: descarga los datos del cliente en JSON para enviárselos */
export async function GET(_request: NextRequest, { params }: RouteContext<"/admin/clientes/[id]/datos">) {
  const staff = await requireStaff(["admin"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Cliente no válido" }, { status: 400 });
  try {
    const data = await exportCustomerData(id, staff.email);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="datos-kaffa-love-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
