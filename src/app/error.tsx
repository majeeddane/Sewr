"use client";

import * as React from "react";
import { ButtonLink } from "@/components/ui/primitives";
import { TriangleAlert } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surface the failure to the server log so it is diagnosable in production.
    console.error("[app-error]", error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#FDFBF7",
          color: "#221B29",
          fontFamily: "system-ui, 'Segoe UI', Tahoma, sans-serif",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "34rem", textAlign: "center" }}>
          <span
            aria-hidden
            style={{
              display: "grid",
              placeItems: "center",
              width: "5rem",
              height: "5rem",
              margin: "0 auto",
              borderRadius: "1.25rem",
              background: "#FDF2F2",
              color: "#DC2626",
            }}
          >
            <TriangleAlert size={40} />
          </span>

          <h1 style={{ fontSize: "1.75rem", margin: "1.5rem 0 0.75rem", color: "#4B2A7B" }}>
            حدث خطأ غير متوقع
          </h1>
          <p style={{ fontSize: "1rem", lineHeight: 1.9, color: "#63576F", margin: 0 }}>
            عذرًا، واجهنا مشكلة في عرض هذه الصفحة. يمكنك إعادة المحاولة، أو العودة
            إلى الصفحة الرئيسية. وإذا تكررت المشكلة، تواصل معنا وسنهتم بها.
          </p>

          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#9A90A6", marginTop: "1rem" }}>
              رمز الخطأ: <span dir="ltr">{error.digest}</span>
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              marginTop: "2rem",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                height: "3rem",
                padding: "0 2rem",
                borderRadius: "999px",
                border: "none",
                background: "#4B2A7B",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              إعادة المحاولة
            </button>
            <ButtonLink href="/" variant="outline" size="lg">
              الصفحة الرئيسية
            </ButtonLink>
          </div>
        </main>
      </body>
    </html>
  );
}
