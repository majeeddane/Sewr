const res = await fetch("https://sewr.vercel.app/");
const html = await res.text();
const checks = [
  ["صورة absolute تملأ القسم", /absolute inset-0[^>]*object-cover|object-cover[^>]*absolute/.test(html) || (html.includes("object-cover") && html.includes("sizes=\"100vw\""))],
  ["التدرّج الأفقي (الجهة اليمنى)", html.includes("bg-gradient-to-l")],
  ["التدرّج العمودي", html.includes("from-brand-950/70")],
  ["Trust card متداخلة", /-mt-1[24]/.test(html)],
  ["نص أبيض", html.includes("text-white")],
  ["زر فاتح على الخلفية", html.includes("outlineLight") || html.includes("border-white/45")],
  ["لا شبكة قديمة", !html.includes("aspect-[4/3]")],
];
console.log("");
for (const [label, ok] of checks) console.log("  " + (ok ? "OK" : "--") + "  " + label);
console.log("");
