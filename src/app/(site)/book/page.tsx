import type { Metadata } from "next";
import { ShieldCheck, Clock, HeartHandshake, ClipboardCheck } from "lucide-react";
import { PageHero } from "@/components/site/common";
import { BookingForm } from "./booking-form";
import { getPublicSettings } from "@/lib/settings";
import { getContentItems } from "@/lib/queries";
import { whatsappNumber } from "@/lib/crypto";
import { Reveal } from "@/components/ui/reveal";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "احجز استشارة",
    description:
      "احجز استشارة أولى مجانية للتقييم في مركز سوار وعي. نحدّد معك الخطوة الأنسب دون أي التزام.",
    alternates: { canonical: "/book" },
  };
}

const PROMISES = [
  {
    icon: ClipboardCheck,
    title: "استشارة أولى للتقييم",
    text: "لقاء تعارف نحدّد فيه معك وضعك الحالي والخطوة الأنسب.",
  },
  {
    icon: Clock,
    title: "مدة قصيرة وواضحة",
    text: "نلتزم بالوقت المتفق عليه حتى لا تتعطّل جدولك.",
  },
  {
    icon: ShieldCheck,
    title: "خصوصية تامة",
    text: "ما تكتبه يبقى بينك وبين المختص، ولا يُشارك مع أي طرف.",
  },
  {
    icon: HeartHandshake,
    title: "دون أي التزام",
    text: "لن نطلب منك دفع أي مبلغ قبل أن تقرر المتابعة.",
  },
];

export default async function BookPage() {
  const [settings, programs] = await Promise.all([
    getPublicSettings(),
    getContentItems("PROGRAM"),
  ]);
  const waNumber = whatsappNumber(settings.whatsapp || settings.phone);

  return (
    <>
      <PageHero
        eyebrow="الخطوة الأولى"
        title="احجز استشارة"
        description="لا تحتاج أن تعرف من أين تبدأ. أكمل النموذج وسنتواصل معك لتأكيد الموعد، ثم نبدأ معًا بالخطوة الأنسب لك."
        crumbs={[{ label: "احجز استشارة" }]}
        compact
      />

      <section className="py-14 sm:py-20">
        <div className="container-page">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
            <Reveal>
              <div className="rounded-3xl border border-sand-200 bg-white p-6 shadow-soft sm:p-9">
                <BookingForm
                  programs={programs.map((p) => ({ slug: p.slug, title: p.title }))}
                />
              </div>
            </Reveal>

            <aside className="flex flex-col gap-5">
              <Reveal delay={100}>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {PROMISES.map((promise) => (
                    <li
                      key={promise.title}
                      className="flex items-start gap-3 rounded-2xl border border-sand-200 bg-white p-4 shadow-soft"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-50 text-gold-700">
                        <promise.icon className="size-4.5" aria-hidden />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-brand-900">
                          {promise.title}
                        </span>
                        <span className="mt-0.5 block text-[0.8125rem] leading-relaxed text-ink-500">
                          {promise.text}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={150}>
                <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
                  <h2 className="text-sm font-extrabold text-brand-900">
                    تفضّل التواصل الآن؟
                  </h2>
                  <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-600">
                    يمكنك مراسلتنا مباشرة عبر واتساب، وسنرد عليك في أقرب وقت.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {waNumber && (
                      <a
                        href={`https://wa.me/${waNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1eb855]"
                      >
                        <span aria-hidden>💬</span>
                        مراسلة عبر واتساب
                      </a>
                    )}
                    {settings.phone && (
                      <a
                        href={`tel:${settings.phone}`}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-brand-800 ring-1 ring-inset ring-sand-300 transition-colors hover:bg-sand-50"
                      >
                        <span aria-hidden dir="ltr">{settings.phone}</span>
                      </a>
                    )}
                  </div>
                </div>
              </Reveal>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
