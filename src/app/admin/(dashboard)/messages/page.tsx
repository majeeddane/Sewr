import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/session";
import { can } from "@/lib/rbac";
import { blindIndex, decrypt, formatPhone, maskPhone } from "@/lib/crypto";
import { AdminPageHeader } from "@/components/admin/shell";
import {
  MessageList,
  type MessageCounts,
  type MessageFilter,
  type MessageListItem,
} from "./message-list";
import { MessageDetail, type MessageDetailData } from "./message-detail";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "الرسائل",
  description: "صندوق وارد رسائل نموذج التواصل في الموقع.",
};

const PER_PAGE = 20;

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function readPage(value: string | string[] | undefined): number {
  const n = Number.parseInt(one(value), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function readFilter(value: string | string[] | undefined): MessageFilter {
  // Validated inline: a Server Component must not read plain values out of a
  // "use client" module — they arrive as client-reference proxies.
  const raw = one(value);
  return raw === "unread" || raw === "replied" || raw === "archived" ? raw : "all";
}

function readMessageId(value: string | string[] | undefined): string | null {
  const raw = one(value).trim();
  return raw ? raw : null;
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthContext();
  const user = context.user;
  if (!user) redirect("/admin/login");

  // The inbox holds sensitive data: no capability, no screen.
  if (!can(user.role, "messages.view")) redirect("/admin");

  const params = await searchParams;
  const filter = readFilter(params.filter);
  const q = one(params.q).trim().slice(0, 120);
  const requestedPage = readPage(params.page);
  const selectedId = readMessageId(params.id);

  const where: Prisma.ContactMessageWhereInput = { isArchived: filter === "archived" };
  if (filter === "unread") where.isRead = false;
  if (filter === "replied") where.repliedAt = { not: null };

  if (q) {
    // Phone numbers and e-mails are encrypted, so they are searched through
    // their deterministic blind index instead of `contains`.
    const hash = blindIndex(q);
    where.OR = [
      { name: { contains: q } },
      { subject: { contains: q } },
      { topic: { contains: q } },
      ...(hash ? [{ phoneHash: hash }, { emailHash: hash }] : []),
    ];
  }

  // Count first so an out-of-range `?page=` cannot ask for rows past the end.
  const [total, allCount, unreadCount, repliedCount, archivedCount] = await Promise.all([
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.count({ where: { isArchived: false } }),
    prisma.contactMessage.count({ where: { isArchived: false, isRead: false } }),
    prisma.contactMessage.count({ where: { repliedAt: { not: null } } }),
    prisma.contactMessage.count({ where: { isArchived: true } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(requestedPage, pageCount);

  const rows = await prisma.contactMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
    // Only the columns the list and the detail need — decryption happens here,
    // on the server, and nothing encrypted is ever serialised to the client.
    select: {
      id: true,
      name: true,
      subject: true,
      topic: true,
      phoneEnc: true,
      emailEnc: true,
      messageEnc: true,
      isRead: true,
      isArchived: true,
      repliedAt: true,
      consentGivenAt: true,
      createdAt: true,
      ip: true,
      userAgent: true,
    },
  });

  const items: MessageListItem[] = rows.map((row) => {
    const phone = decrypt(row.phoneEnc);
    return {
      id: row.id,
      name: row.name,
      subject: row.subject,
      topic: row.topic,
      phoneMasked: phone ? maskPhone(phone) : "",
      hasEmail: Boolean(decrypt(row.emailEnc)),
      isRead: row.isRead,
      isArchived: row.isArchived,
      repliedAt: row.repliedAt ? row.repliedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  });

  // Selection follows the list: an explicit ?id wins, otherwise open the first
  // row of the current page. A deep link to a filtered-out message still works.
  let selected = rows.find((row) => row.id === selectedId);
  if (!selected && selectedId) {
    selected =
      (await prisma.contactMessage.findUnique({
        where: { id: selectedId },
        select: {
          id: true,
          name: true,
          subject: true,
          topic: true,
          phoneEnc: true,
          emailEnc: true,
          messageEnc: true,
          isRead: true,
          isArchived: true,
          repliedAt: true,
          consentGivenAt: true,
          createdAt: true,
          ip: true,
          userAgent: true,
        },
      })) ?? undefined;
  }
  selected ??= rows[0];

  const detail: MessageDetailData | null = selected
    ? {
        id: selected.id,
        name: selected.name,
        subject: selected.subject,
        topic: selected.topic,
        phone: formatPhone(decrypt(selected.phoneEnc)),
        email: decrypt(selected.emailEnc),
        body: decrypt(selected.messageEnc) ?? "تعذّر فك تشفير نص الرسالة.",
        isRead: selected.isRead,
        isArchived: selected.isArchived,
        repliedAt: selected.repliedAt ? selected.repliedAt.toISOString() : null,
        consentGivenAt: selected.consentGivenAt
          ? selected.consentGivenAt.toISOString()
          : null,
        createdAt: selected.createdAt.toISOString(),
        // Request metadata is for administrators only.
        ip: can(user.role, "users.view") ? selected.ip : null,
        userAgent: can(user.role, "users.view") ? selected.userAgent : null,
      }
    : null;

  const counts: MessageCounts = {
    all: allCount,
    unread: unreadCount,
    replied: repliedCount,
    archived: archivedCount,
  };

  return (
    <>
      <AdminPageHeader
        title="الرسائل"
        description="كل ما يصل عبر نموذج «تواصل معنا». اقرأ الرسالة، ردّ عليها، ثم أرشفها."
        breadcrumb={[{ href: "/admin", label: "لوحة التحكم" }]}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <MessageList
          items={items}
          counts={counts}
          filter={filter}
          q={q}
          page={page}
          pageCount={pageCount}
          total={total}
          activeId={selected?.id ?? null}
        />
        <MessageDetail
          message={detail}
          canReply={can(user.role, "messages.reply")}
          showTechnical={can(user.role, "users.view")}
        />
      </div>
    </>
  );
}