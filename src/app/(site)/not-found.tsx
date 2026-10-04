import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <main className="relative grid min-h-[70vh] place-items-center overflow-hidden bg-sand-100 px-5 py-20">
      <div aria-hidden className="absolute inset-0 bg-grid-soft opacity-60" />
      <div
        aria-hidden
        className="absolute -top-32 start-1/3 size-[30rem] rounded-full bg-brand-100/60 blur-3xl"
      />

      <div className="relative w-full max-w-xl text-center">
        <span
          aria-hidden
          className="mx-auto grid size-24 place-items-center rounded-3xl bg-brand-800 text-4xl font-extrabold text-gold-400 shadow-lift"
        >
          ٤٠٤
        </span>

        <h1 className="mt-8 text-3xl text-brand-900 sm:text-4xl">
          الصفحة التي تبحث عنها غير موجودة
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-[1.95] text-ink-600">
          ربما تم نقل الصفحة أو تغيير عنوانها. يمكنك العودة إلى الرئيسية، أو
          التواصل معنا مباشرة وسنساعدك في الوصول إلى ما تبحث عنه.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/" variant="primary" size="lg" icon="Home">
            العودة إلى الرئيسية
          </ButtonLink>
          <ButtonLink href="/contact" variant="outline" size="lg">
            تواصل معنا
          </ButtonLink>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <Link
            href="/services"
            className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:underline"
          >
            خدماتنا
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <Link
            href="/programs"
            className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:underline"
          >
            برامجنا
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 font-bold text-brand-700 hover:underline"
          >
            المدونة
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </main>
  );
}
