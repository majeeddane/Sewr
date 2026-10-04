# دليل النشر — سوار وعي

خطوات النشر خطوة بخطوة، مع شرح **لماذا** اخترنا كل خيار.

---

## ١. اختيار الحزمة التقنية

| الطبقة | الاختيار | السبب |
|---|---|---|
| الإطار | **Next.js 16 (App Router) + TypeScript** | خادم ومُصنِّع في مشروع واحد، جلب بيانات على الخادم (يقلّل تسريب البيانات)، وتوليد ثابت للصفحات العامة. |
| التنسيق | **Tailwind CSS v4** | نظام تصميم كامل في ملف واحد مع ألوان المركز.lines ورموز مخصّصة. |
| قاعدة البيانات | **Prisma ORM** | مخططان من ملف مصدر واحد: `schema.prisma` للإنتاج (PostgreSQL) و`schema.dev.prisma` للتطوير (SQLite). لا تبديل يدوي ولا خطر نسيان. |
| المصادقة | **جلسات على الخادم (Opaque sessions)** | لا JWT في المتصفح، فإبطال الجلسة فوري. الكوكي `httpOnly` وموقّع، وقاعدة البيانات تخزّن تجزئة SHA‑256 فقط. |
| التخزين | **محلي أو Supabase Storage** | عبر محوّل واحد `STORAGE_DRIVER`. |
| البريد | **SMTP (nodemailer)** | يعمل مع أي مزوّد: Amazon SES، Mailgun، SMTP2GO، أو بريد المؤسسة. |
| النشر | **Vercel** أو أي خادم يدعم Node 20+ | |

**لماذا لا نستخدم Supabase Auth؟** لأن المصادقة هنا مرتبطة بصلاحيات دقيقة (مدير عام / محرر / موظف استقبال) يجب تطبيقها على **كل** Server Action. طبقتُ هذا صراحةً عبر `src/lib/rbac.ts`، وهو أوضح وأسهل تدقيقًا من تهيئة سياسات Auth خارجية. مع ذلك أرفقتُ **سياسات Row‑Level Security كاملة** في `supabase/schema.sql` كطبقة حماية ثانية.

---

## ٢. المتطلبات

- Node.js **20.11 أو أحدث** (Vercel توفّره تلقائيًا)
- حساب GitHub أو GitLab
- مشروع Supabase (اختياري — يمكن استخدام أي PostgreSQL)

---

## ٣. التشغيل محليًا

```bash
# ١) تثبيت الحزم
npm install

# ٢) إعداد المتغيرات
copy .env.example .env          # على ويندوز
# cp .env.example .env          # على لينكس/ماك

# ٣) توليد الأسرار — مهم جدًا
node -e "console.log('SESSION_SECRET     =', require('crypto').randomBytes(32).toString('hex')); console.log('DATA_ENCRYPTION_KEY=', require('crypto').randomBytes(32).toString('hex'))"
# انسخ القيمتين إلى .env

# ٤) إنشاء قاعدة البيانات + حساب المدير + المحتوى
npm run db:setup

# ٥) تشغيل الموقع
npm run dev
```

الموقع: `http://localhost:3000` · لوحة التحكم: `http://localhost:3000/admin`

> `npm run dev` يعمل على **SQLite** عبر `prisma/schema.dev.prisma` بلا أي خادم
> قواعد بيانات. لا تغيّر `prisma/schema.prisma` — ذلك للإنتاج فقط.

**بيانات الدخول الافتراضية** (من `.env`):

```
البريد:  admin@sewrwaie.sa
كلمة المرور:  SewrWaie@2026
```

> ⚠️ **غيّر كلمة المرور فورًا** من: لوحة التحكم ← المستخدمون ← تعديل ← كلمة المرور.

> ⚠️ بيانات الدخول الافتراضية تحمل الرقم السري نفسه الذي وُضع في ملف `.env` على جهازك. **غيّر كليهما.**

---

## ٤. الانتقال إلى PostgreSQL / Supabase

> **لا تحتاج تعديل أي ملف.** مخطط الإنتاج `prisma/schema.prisma` يستهدف
> `postgresql` بشكل افتراضي، وVercel يشغّل `prisma generate` عليه تلقائيًا.
>
> أمّا `prisma/schema.dev.prisma` فهو نسخة SQLite **للتطوير المحلي فقط**، ويستخدمه
> أمر `npm run dev`. كلا المخططين يوصَفان نفس النماذج والحقول بالضبط، و
> `npm run verify:schema` يتحقق من ذلك.

### ٤.١ إنشاء قاعدة البيانات

**مع Supabase:**

1. افتح مشروعك ← **SQL Editor**.
2. الصق محتوى `supabase/schema.sql` بالكامل وشغّله.
   هذا ينشئ كل الجداول والقيود والفهارس وسياسات RLS وحاوية التخزين.
   *لا يحتاج المخطط أي إضافة خارجية — يعمل كما هو على Supabase وعلى أي
   خادم PostgreSQL عادي.*
3. الصق محتوى `supabase/seed.sql` وشغّله بعدها.
   هذا يُدخل حساب المدير وكل المحتوى والإعدادات.
4. من **Project Settings → Database → Connection string**، انسخ رابط الاتصال
   (استخدم **Session pooler** إن كنت خلف IPv4).

> الملفان آمنان للتشغيل المتكرر: كل عمليات الإدخال تتجاهل التعارضات، فيمكن
> إعادة تشغيل ملف البيانات دون كسر أي شيء.

> **ما الذي لا تحتاج فعله مع Supabase:** لا تثبّت `@supabase/supabase-js` ولا
> تنشئ `utils/supabase/`. التطبيق يتصل بقاعدة البيانات عبر Prisma، والتخزين عبر
> `fetch` مباشرة. حزمة Supabase المبنية أعلاه تخصّ مشاريع Supabase Auth، ولست
> جزءًا من هذا المشروع.

### ٤.٢ ضبط رابط الاتصال

في **Vercel ← Settings ← Environment Variables** (وليس في `.env` المحلي):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?schema=public&connection_limit=10"
```

> **مهم:** استبدل `USER` و`PASSWORD` بتلك **المُرمَّزة (URL‑encoded)**. إن كانت كلمة المرور تحتوي على `#` أو `@` يجب ترميزها.

> اترك `.env` المحلي على `file:./dev.db` حتى يستمر `npm run dev` بلا خادم.

### ٤.٣ التحقق قبل النشر

المخطط والبيانات مُتحقَّق منهما فعليًا على محرك PostgreSQL حقيقي:

```bash
npm run verify:schema    # ٦٨ فحصًا: DDL + RLS + المفاتيح الأجنبية + البيانات
```

هذا يشغّل ملفي المخطط والبيانات على محرك قواعد بيانات حقيقي، ويؤكد أن ما
لصقته في Supabase سيعمل. إن فشل هنا فلن تنشر.

### ٤.٤ التخزين

لاستخدام Supabase Storage بدل التخزين المحلي:

```env
STORAGE_DRIVER="supabase"
SUPABASE_URL="https://PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci…"
SUPABASE_STORAGE_BUCKET="media"
```

`SUPABASE_SERVICE_ROLE_KEY` سرّي **ولا يدخل المتصفح أبدًا** — لا تعرّضه كـ `NEXT_PUBLIC_`.

---

## ٥. النشر على Vercel

### ٥.١ رفع المستودع

```bash
git init
git add .
git commit -m "إطلاق موقع سوار وعي"
git branch -M main
git remote add origin https://github.com/<user>/sewr-waie.git
git push -u origin main
```

### ٥.٢ إعداد المشروع في Vercel

| الحقل | القيمة |
|---|---|
| Framework Preset | Next.js |
| Build Command | `npm run build` |
| Install Command | `npm install` |
| Output Directory | `.next` |

> لا حاجة لأي أمر ترحيل هنا: المخطط يُطبَّق مرة واحدة من **SQL Editor** في
> Supabase (الخطوة ٤.١). أمر البناء يشغّل `prisma generate` عبر `postinstall`
> تلقائيًا، وهذا كل ما يلزم.

### ٥.٣ متغيرات البيئة (Production → Environment Variables)

```
NODE_ENV                 = production          (تلقائي)
NEXT_PUBLIC_SITE_URL     = https://sewrwaie.sa
DATABASE_URL             = postgresql://…
SESSION_SECRET            = <hex 64>
DATA_ENCRYPTION_KEY      = <hex 64>
ADMIN_EMAIL              = your@email.com
ADMIN_PASSWORD           = <كلمة مرور قوية>
SMTP_HOST                = smtp.your-provider.com
SMTP_PORT                = 587
SMTP_SECURE              = false
SMTP_USER                = apikey
SMTP_PASS                = <سر>
SMTP_FROM                = سوار وعي <no-reply@sewrwaie.sa>
NOTIFICATION_EMAIL       = your@email.com
STORAGE_DRIVER           = supabase            (أو local)
CRON_SECRET              = <سر عشوائي>
```

### ٥.٤ بعد النشر

```bash
# محليًا (أو من أي مكان): أنشئ المحتوى وحساب المدير
DATABASE_URL="postgresql://…" npm run db:seed
```

ثم:

1. سجّل الدخول إلى `https://sewrwaie.sa/admin`.
2. **غيّر كلمة المرور** فورًا.
3. احذف الصفوف التجريبية من «المستفيدون» و«الرسائل».
4. استبدل الأرقام في «المحتوى ← الإحصائيات» بأرقامك الحقيقية (الافتراضية +500 / +90% / +50 مجرد أمثلة من التصميم).
5. ارفع الشعار والصور الحقيقية.
6. فعّل النطاق=https في Vercel (النزول مجاني تلقائيًا مع Let's Encrypt).

---

## ٦. النشر على خادم خاص (VPS)

```bash
# ١) بناء محليًا
npm ci
npm run build

# ٢) نسخ إلى الخادم
rsync -av --exclude node_modules --exclude .next ./ user@server:/var/www/sewr-waie

# ٣) على الخادم
cd /var/www/sewr-waie
npm ci --omit=dev

# إن كانت قاعدة البيانات جديدة: طبّق المخطط مرّة واحدة
psql "$DATABASE_URL" -f supabase/schema.sql
psql "$DATABASE_URL" -f supabase/seed.sql

npm run db:seed

# ٤) خدمة systemd
sudo nano /etc/systemd/system/sewr-waie.service
```

```ini
[Unit]
Description=Sewr Waie
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/sewr-waie
EnvironmentFile=/var/www/sewr-waie/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now sewr-waie
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d sewrwaie.sa -d www.sewrwaie.sa
```

nginx (منفذ 80 يُعاد توجيهه إلى HTTPS، و443 يُمرَّر إلى 3000):

```nginx
server {
  server_name sewrwaie.sa www.sewrwaie.sa;
  client_max_body_size 10M;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        "upgrade";
  }
}
```

> ترويسات `X-Forwarded-For` ضرورية: بدونها لا يعمل حدّ محاولات تسجيل الدخول ولا يُسجَّل عنوان IP في السجلات.

---

## ٧. النسخ الاحتياطي

### ٧.١ النسخ اليومي (تلقائي)

**Supabase:** فعّل **Point-in-Time Recovery** من الإعدادات (7 أيام افتراضيًا، ويمكن زيادتها إلى 30).

**VPS:** أضف مهمة يومية:

```bash
crontab -e
```

```cron
# نسخة يومية 3:00 فجرًا — expelled content hashed for integrity
15 3 * * * pg_dump "$DATABASE_URL" | gzip > /var/backups/sewrwaie-$(date +\%F).sql.gz
30 4 * * * find /var/backups -name 'sewrwaie-*.sql.gz' -mtime +30 -delete
```

> **النسخ الاحتياطي الذي لا تُختبر استعادته ليس نسخة احتياطية.** كل شهر:
> ```bash
> gunzip -c /var/backups/sewrwaie-2026-10-01.sql.gz | psql "postgresql://…" -c "select count(*) from clients;"
> ```

### ٧.٢ ملفات الوسائط

مع `STORAGE_DRIVER=local`، انسخ `public/uploads/` يوميًا إلى تخزين منفصل أو S3.

### ٧.٣ تشفير النسخة

```bash
pg_dump "$DATABASE_URL" | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -pass file:/root/.backup-pass -out /var/backups/sewrwaie-$(date +\%F).sql.enc
```

احتفظ بمفتاح التشفير **خارج الخادم** — إن ضاع، لا تُستعاد النسخة.

---

## ٨. النشر المجدول

لمنشورات المدونة المجدولة، أضف `vercel.json` (موجود في المشروع):

```json
{ "crons": [{ "path": "/api/cron/publish", "schedule": "0 3 * * *" }] }
```

- التوقيت بصيغة UTC.
- التوقيت بصيغة UTC، والموضع الحالي **3:00 UTC يوميًا**، أي 6:00 صباحًا بتوقيت السعودية. اشتراك Hobby المجاني يسمح بمهمة واحدة يوميًا كحد أقصى، لذلك لا يمكن زيادة عدد المرات. وإن اشتركت في اشتراك Pro فعدّل `vercel.json` إلى `"*/15 * * * *"` دون أي تعديل آخر في الكود.
- على VPS أضف cron يستدعي `curl -H "Authorization: Bearer $CRON_SECRET" https://sewrwaie.sa/api/cron/publish`.

> طمئن: حتى لو فشلت المهمة المجدولة، تنشر صفحات المدونة ولوحة التحكم أي مقال تجاوز موعده عند أول زيارة. الروابط معطّلة احتياطًا فقط.

---

## ٩. بعد النشر — قائمة تحقّق

- [ ] `SESSION_SECRET` و`DATA_ENCRYPTION_KEY` قيم عشوائية حقيقية (لا `CHANGE_ME`)
- [ ] كلمة مرور المدير الافتراضية غُيّرت
- [ ] `DATABASE_URL` يشير إلى PostgreSQL وليس SQLite
- [ ] `NEXT_PUBLIC_SITE_URL` يطابق النطاق الحقيقي (وإلاCanonical وSitemap وOG خاطئة)
- [ ] HTTPS يعمل و`Strict-Transport-Security` مُفعّل
- [ ] البريد الوارد يعمل: أرسل رسالة من «تواصل معًا» وتحقق من وصول الإشعار
- [ ] أرقام الإحصائيات استُبدلت بأرقام حقيقية
- [ ] الصور النائبة في `public/placeholders/` استُبدلت بصور حقيقية
- [ ] الصفوف التجريبية حُذفت من «المستفيدون» و«المواعيد» و«الرسائل»
- [ ] حسابات الموظفين أُنشئت بصلاحياتها الصحيحة
- [ ] النسخ الاحتياطي اليومي مُفعّل ومُختبَر استرجاعه
- [ ] `/admin` و`/api` غير مفهرسين في محركات البحث (تحقق من `robots.txt`)
- [ ] البيانات منتهية الصلاحية تُنظَّف دوريًا (المهمة المجدولة تتولى ذلك)

---

## ١٠. استكشاف الأخطاء

| العرض | السبب | الحل |
|---|---|---|
| `DATABASE_URL is not set` | ملف `.env` مفقود | انسخ `.env.example` إلى `.env` |
| `SQLITE_BUSY` | قاعدة بيانات محلية مقفولة | أغلق Programs، أو انتقل إلى PostgreSQL |
| `Can't reach database server` | بيانات الاتصال خاطئة | أعد فحص الرابط وبيانات الدخول |
| `DATA_ENCRYPTION_KEY is not set` | السر مفقود | ولّده بالأمر في القسم ٣ |
| الأرقام القديمة لا تظهر بعد التعديل | الإصدار القديم مخزّن مؤقتًا | `revalidatePath` يستدعيه كل حفظ؛ إن استمر، أعد النشر |
| الصور لا تظهر بعد الرفع | الرفع إلى مسار غير صحيح | تحقق من `STORAGE_DRIVER` وصلاحية `public/uploads` |
| البريد لا يصل | SMTP غير مضبوط | في التطوير تُطبع الرسائل في سجل الخادم — راقب `npm run dev` |
| `500` بعد تسجيل الدخول | الجلسة لم تُحفظ | تحقق من أن `SESSION_SECRET` لم يتغيّر بين تشغيلين |

---

## ١١. النسخ الاحتياطي للـ Git

`AGENTS.md` في الجذر ملف يُنشئه Next.js أثناء التطوير — **أبقِه في المستودع**. وثائق `node_modules/next/dist/docs/` هي مرجع Next.js 16 الخاص بهذا الإصدار.
