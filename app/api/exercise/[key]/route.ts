import { findCatalog } from "@/lib/exerciseCatalog";
import { lookupGifUrl } from "@/lib/exerciseDb";

// 검증된 운동의 GIF 주소를 조회해 돌려준다(PRD §8: 요청 시 실행하고 저장하지 않는다).
// Cache Components에서는 `use cache`를 쓰지 않은 GET이 요청 시점에 실행되므로 따로 설정하지 않는다.
// 앱 안의 운동 key만 받고, ExerciseDB ID는 서버의 검증된 목록에서만 꺼낸다(임의 ID 조회 불가).
export async function GET(_req: Request, ctx: RouteContext<"/api/exercise/[key]">) {
  const { key } = await ctx.params;
  const item = findCatalog(key);
  if (!item) return Response.json({ error: "unknown" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const r = await lookupGifUrl(item.exerciseDbId);
  const headers = { "Cache-Control": "no-store" };
  if (r.ok) return Response.json({ gifUrl: r.gifUrl }, { headers });
  const status = r.reason === "no-gif" ? 404 : 502;
  return Response.json({ error: r.reason }, { status, headers });
}
