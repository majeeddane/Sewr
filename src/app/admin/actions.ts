"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { headers } from "next/headers";
import { clientIpFrom } from "@/lib/session";

export async function logoutAction(): Promise<void> {
  const hdrs = await headers();
  await logActivity({
    action: "LOGOUT",
    entity: "Session",
    summary: "تسجيل خروج من لوحة التحكم",
    ip: clientIpFrom(hdrs),
  });
  await destroySession();
  redirect("/admin/login");
}
