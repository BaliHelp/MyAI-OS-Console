import { NextRequest, NextResponse } from "next/server";
import { getSignedUrl } from "@/lib/data-center";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { filePath } = await req.json().catch(() => ({}));
    if (!filePath) {
      return NextResponse.json({ error: "filePath is required" }, { status: 400 });
    }

    const signedUrl = await getSignedUrl(filePath);
    return NextResponse.json({ signedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to generate signed URL" }, { status: 500 });
  }
}
