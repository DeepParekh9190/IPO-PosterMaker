import { NextResponse } from "next/server";
import { fetchIpos } from "@/lib/ipos";

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.has("fresh");
  try {
    const ipos = await fetchIpos(fresh);
    return NextResponse.json(
      { ipos, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "cache-control": fresh ? "no-store" : "public, s-maxage=300, stale-while-revalidate=3600",
        },
      },
    );
  } catch {
    // shortcut: no persistent stale copy; add a file/KV snapshot if uptime matters.
    return NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}
