/**
 * bundle-menu-images.mjs
 * ينزّل كل صور المنيو (من Supabase Storage والروابط الخارجية) ويحطها ثابتة
 * في public/menu-images/ ، وبعدين يحوّل public/menu.html يشاور على المسارات المحلية.
 * النتيجة: صفحة منيو ثابتة 100% مستقلة عن Supabase.
 *
 * التشغيل (بعد ما يترفع القفل يوم 13 يوليو أو بعد الترقية):
 *   node scripts/bundle-menu-images.mjs
 * وبعدها: git add -A && git commit -m "chore: bundle static menu images" && git push
 *
 * يتطلب Node 18+ (فيه fetch مدمج).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const HTML = 'public/menu.html';
const OUT_DIR = 'public/menu-images';
const PUBLIC_PREFIX = '/menu-images/';

const src = await readFile(HTML, 'utf8');

// اقرأ قيمة الثابت S (رابط Supabase Storage)
const sMatch = src.match(/const S = '([^']+)'/);
const S = sMatch ? sMatch[1] : '';
if (!S) console.warn('⚠️  لم يتم العثور على الثابت S في الملف.');

// اجمع كل الصور: نمط img:S+'file'  و  نمط img:'https://...'
const jobs = new Map(); // token -> { url, local }
const used = new Set();

function localName(rawName) {
  let base = decodeURIComponent(rawName.split('?')[0].split('/').pop() || 'img');
  base = base.replace(/[^\w.\-]+/g, '_');
  if (!/\.(jpg|jpeg|png|webp|gif|avif)$/i.test(base)) base += '.jpg';
  let name = base, i = 1;
  while (used.has(name)) { name = base.replace(/(\.[^.]+)$/, `_${i++}$1`); }
  used.add(name);
  return name;
}

for (const m of src.matchAll(/img:\s*S\s*\+\s*'([^']+)'/g)) {
  const token = m[0];
  if (jobs.has(token)) continue;
  jobs.set(token, { url: S + m[1], local: localName(m[1]) });
}
for (const m of src.matchAll(/img:\s*'(https?:\/\/[^']+)'/g)) {
  const token = m[0];
  if (jobs.has(token)) continue;
  jobs.set(token, { url: m[1], local: localName(m[1]) });
}

console.log(`📦 عدد الصور: ${jobs.size}`);
await mkdir(OUT_DIR, { recursive: true });

let ok = 0, fail = 0;
let out = src;
for (const [token, job] of jobs) {
  try {
    const res = await fetch(job.url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(OUT_DIR, job.local), buf);
    out = out.split(token).join(`img:'${PUBLIC_PREFIX}${job.local}'`);
    ok++;
    console.log(`✅ ${job.local}`);
  } catch (e) {
    fail++;
    console.log(`❌ فشل: ${job.url}  (${e.message})`);
  }
}

// شيل الثابت S لأنه مابقاش مستخدم (اختياري — نسيبه لو لسه في صور فشلت)
if (fail === 0) {
  out = out.replace(/const S = '[^']+';\s*\n/, '');
}

await writeFile(HTML, out, 'utf8');
console.log(`\nتم: ${ok} صورة اتنزّلت، ${fail} فشلت.`);
if (fail > 0) console.log('الصور اللي فشلت لسه بتشاور على مصدرها القديم — شغّل السكربت تاني بعد ما تبقى متاحة.');
