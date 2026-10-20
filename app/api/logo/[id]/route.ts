import { fetchIpos, logoUrl } from "@/lib/ipos";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ipo = (await fetchIpos().catch(() => [])).find((i) => i.id === Number(id));
  if (!ipo) return new Response("Not found", { status: 404 });

  // Same-origin proxy so the canvas can draw the logo without tainting.
  const res = await fetch(logoUrl(ipo.id), { next: { revalidate: 86400 } });
  if (!res.ok) return new Response("No logo", { status: 404 });

  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") || "image/png",
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
