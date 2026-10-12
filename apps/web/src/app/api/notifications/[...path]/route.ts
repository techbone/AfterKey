import { notificationProxy } from "@/lib/notification-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  const { path } = await context.params;
  return notificationProxy(request, "/" + path.join("/"), process.env.AFTERKEY_API_URL, process.env.NODE_ENV === "production");
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
