import { NextResponse } from "next/server";
import { createSupabaseUserServer } from "../../../../lib/supabaseUserServer";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = await createSupabaseUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  return NextResponse.json({ sessionId: id, error: "Not implemented" }, { status: 501 });
}
