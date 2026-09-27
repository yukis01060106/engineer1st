// 写真の一括加工（ブランドのトーンを揃える）
// 参考: 明るく・影を持ち上げ・彩度を少し抑えた、抜けのいいハイキー調
//   1. 長辺を揃えてトリミング（被写体中心の attention クロップ）
//   2. 黒を持ち上げて（linear）コントラストを弱め、ふんわりさせる
//   3. 明るさ +5%、彩度 -8%
//   4. ほんの少しだけ暖色に寄せる（recomb）
//   5. WebP で書き出し
// 写真はすべて Unsplash License（商用利用可・クレジット不要）。出典は credits.json に残す
//
// 使い方: node scripts/process-photos.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const PHOTOS = [
  { out: "hero", id: "1522202176988-66273c2fd55f", w: 1600, h: 1200 },
  { out: "community", id: "1529156069898-49953e39b3ac", w: 1600, h: 1000 },
  { out: "club-running", id: "1502904550040-7534597429ae", w: 1200, h: 900 },
  { out: "club-futsal", id: "1579952363873-27f3bade9f55", w: 1200, h: 900 },
  { out: "club-bouldering", id: "1564769662533-4f00a87b4056", w: 1200, h: 900 },
  { out: "club-stretch", id: "1571019613454-1cb2f99b2d8b", w: 1200, h: 900 },
  { out: "study", id: "1556761175-5973dc0f32e7", w: 1400, h: 1000 },
  { out: "money", id: "1517694712202-14dd9538aa97", w: 1400, h: 1000 },
  { out: "club-pickleball", id: "1737476997205-b3336182f215", w: 1200, h: 900, page: "FVhXFRkLcpA" },
  { out: "club-training", id: "1540497077202-7c8a3999166f", w: 1200, h: 900 },
];

const credits = [];
for (const p of PHOTOS) {
  const url = `https://images.unsplash.com/photo-${p.id}?w=${p.w * 1.5}&q=90&fm=jpg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${p.out}: ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());

  await sharp(input)
    .resize(p.w, p.h, { fit: "cover", position: sharp.strategy.attention })
    .linear(0.9, 20)
    .modulate({ brightness: 1.05, saturation: 0.92 })
    .recomb([
      [1.02, 0, 0],
      [0, 1.0, 0],
      [0, 0, 0.97],
    ])
    .webp({ quality: 78 })
    .toFile(`public/photos/${p.out}.webp`);

  credits.push({ file: `${p.out}.webp`, source: `https://unsplash.com/photos/${p.page ?? p.id}`, license: "Unsplash License" });
  console.log("✓", p.out);
}
await writeFile("public/photos/credits.json", JSON.stringify(credits, null, 2) + "\n");
