#!/usr/bin/env node
// 双向内容同步编排器。由 .githooks/pre-commit 调用。
//
// 无改动时立即退出，日常提交零开销。
// 任何一步失败都以非零码退出 → commit 被阻断 → 仓库不会留下半同步的状态。
// 每个文件对独立落地（写盘 → git add → 才推进基线），不攒批——
// 照片管线吃过攒批的亏（见 docs/photo-ingest-design.md §6）。
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { listPairs } from './sync/pairs.mjs';
import { hashOf, pairState } from './sync/baseline.mjs';
import { isStale } from './sync/gate.mjs';
import { translate } from './sync/translate.mjs';
import { toUnits, applyUnit, removeUnit } from './sync/cv-entries.mjs';

const BASELINE = 'scripts/.sync-baseline.json';
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
const pairs = listPairs();

// 先扫一遍，没有任何改动就别去读 .env、别打扰任何人
const pending = pairs.filter((p) => {
  const s = pairState(baseline[p.key] ?? null, read(p.en), read(p.zh));
  return s.kind !== 'unchanged';
});
if (pending.length === 0) process.exit(0);

console.log(`[双语同步] ${pending.length} 对有改动`);

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
);
if (!env.TRANSLATE_API_BASE || !env.TRANSLATE_API_KEY) {
  console.error('[双语同步] .env 里缺少 TRANSLATE_API_BASE / TRANSLATE_API_KEY');
  process.exit(1);
}
const api = { fetch, base: env.TRANSLATE_API_BASE, key: env.TRANSLATE_API_KEY };

const saveBaseline = () => writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + '\n');
const stage = (...f) => execFileSync('git', ['add', ...f.filter(Boolean)], { stdio: 'inherit' });
// 取上次提交时的那一版，用作语义判定的「改动前」。
// 取不到是正常的（新文件、刚 rebase），退化为保守重译即可——但**要出声**：
// 路径分隔符写错也会走到这里（`git show` 只认正斜杠，反斜杠会被吃掉），
// 那种情况下每次都在重译却没人知道为什么。静默退化是最难发现的那类毛病。
const headVersion = (path) => {
  try {
    return execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    console.log(`    （取不到 ${path} 的 HEAD 版本，本次按保守重译处理）`);
    return null;
  }
};

let translated = 0, skipped = 0, rebased = 0;

for (const p of pending) {
  const en = read(p.en), zh = read(p.zh);
  const s = pairState(baseline[p.key] ?? null, en, zh);
  console.log(`  · ${p.key} [${s.kind}]`);

  try {
    // 两边都变 = 人工已做完，不调模型，只把基线推到当前
    if (s.kind === 'both') {
      baseline[p.key] = { en: hashOf(en), zh: hashOf(zh) };
      saveBaseline(); stage(BASELINE);
      console.log('    两边都改过，视为人工已完成，只更新基线');
      rebased++;
      continue;
    }

    // 管线没见过这对：一边有就翻给另一边，两边都有就直接记基线
    if (s.kind === 'new') {
      if (en && zh) {
        baseline[p.key] = { en: hashOf(en), zh: hashOf(zh) };
        saveBaseline(); stage(BASELINE);
        console.log('    首次登记，两边都在，记为基线');
        rebased++;
      } else {
        const dir = en ? 'en2zh' : 'zh2en';
        const out = await translate({ dir, text: en ?? zh }, api);
        const dst = en ? p.zh : p.en;
        writeFileSync(dst, out.endsWith('\n') ? out : out + '\n');
        baseline[p.key] = { en: hashOf(read(p.en)), zh: hashOf(read(p.zh)) };
        saveBaseline(); stage(dst, BASELINE);
        console.log(`    新增，已生成 ${dst}`);
        translated++;
      }
      continue;
    }

    // 一边被删 → 同步删掉另一边（Sigao 定：人为删掉就是要它消失）
    if (s.kind === 'deleted') {
      if (p.kind === 'cv') { console.error('    CV 文件整体被删，超出本管线处理范围'); process.exit(1); }
      const dst = s.gone === 'en' ? p.zh : p.en;
      unlinkSync(dst);
      delete baseline[p.key];
      saveBaseline();
      execFileSync('git', ['rm', '--cached', '-q', '--ignore-unmatch', dst], { stdio: 'inherit' });
      stage(BASELINE);
      console.log(`    ${s.gone} 侧已删，同步删掉 ${dst}`);
      continue;
    }
    if (s.kind === 'gone') { delete baseline[p.key]; saveBaseline(); stage(BASELINE); continue; }

    // ——— 只有一边变：先问要不要紧 ———
    const changed = s.changed;                 // 'en' | 'zh'
    const dir = changed === 'zh' ? 'zh2en' : 'en2zh';
    const curr = changed === 'zh' ? zh : en;
    const other = changed === 'zh' ? en : zh;

    if (p.kind === 'cv') {
      const r = await syncCv(p, changed, en, zh, api);
      translated += r.translated; skipped += r.skipped;
      continue;
    }

    // 判定要看「改动前后」，所以必须拿得到基线那一版的原文。哈希不可逆，
    // 故从 git 里取 HEAD 版本作为「改动前」——那正是上次提交时的样子。
    // 取不到（新文件、或刚 rebase）时退化为「有变化就重译」，宁可多译一次。
    const before = headVersion(changed === 'zh' ? p.zh : p.en);
    const verdict = before === null
      ? { stale: true, why: '取不到改动前的版本，保守重译' }
      : await isStale({ dir: changed, before, after: curr, other }, api);

    if (!verdict.stale) {
      // **不推进基线**：否则多次「各自无害」的润色会累积成真实偏移却永不触发
      console.log(`    判定无需重译（${verdict.why}）—— 基线保持不动`);
      skipped++;
      continue;
    }

    // 带上对面现有译文 → 走「修订」而非「重译」，保住人工润色过的用词
    const out = await translate({ dir, text: curr, existing: other }, api);
    const dst = changed === 'zh' ? p.en : p.zh;
    writeFileSync(dst, out.endsWith('\n') ? out : out + '\n');
    baseline[p.key] = { en: hashOf(read(p.en)), zh: hashOf(read(p.zh)) };
    saveBaseline(); stage(dst, BASELINE);
    console.log(`    已重译 → ${dst}（${verdict.why}）`);
    translated++;
  } catch (e) {
    console.error(`    失败：${e.message}`);
    console.error('    本对未改动，修好后重跑即可。');
    process.exit(1);
  }
}

console.log(`[双语同步] 重译 ${translated} / 判定无需 ${skipped} / 仅更新基线 ${rebased}`);

// ——— CV 走条目级 ———
// 返回计数而不是直接改外层变量——函数里 translated++ 改不到模块级的那两个。
async function syncCv(p, changed, enRaw, zhRaw, api) {
  const enCv = JSON.parse(enRaw), zhCv = JSON.parse(zhRaw);
  const src = changed === 'zh' ? zhCv : enCv;
  const dstCv = changed === 'zh' ? enCv : zhCv;
  const dir = changed === 'zh' ? 'zh2en' : 'en2zh';
  const dstPath = changed === 'zh' ? p.en : p.zh;
  const srcPath = changed === 'zh' ? p.zh : p.en;

  // 改动前的那一版（HEAD），用来给每个条目做语义判定
  let baseUnits = null;
  const headRaw = headVersion(srcPath);
  if (headRaw) { try { baseUnits = toUnits(JSON.parse(headRaw)); } catch { /* 解析不了就逐条保守重译 */ } }

  const srcUnits = toUnits(src), dstUnits = toUnits(dstCv);
  let next = dstCv, changedCount = 0;

  // 每译完一条就落盘，不攒到最后。照片管线在这个形态上栽过一次（见
  // docs/photo-ingest-design.md §6），这里是同一个坑的另一个实例：
  // 改 5 条、第 5 条翻译失败的话，前 4 条已经花钱译好的结果会一起丢，
  // 重跑还得从头再译一遍。落盘便宜，重译不便宜。
  const flush = () => {
    writeFileSync(dstPath, JSON.stringify(next, null, 2) + '\n');
    baseline[p.key] = { en: hashOf(read(p.en)), zh: hashOf(read(p.zh)) };
    saveBaseline(); stage(dstPath, BASELINE);
  };

  for (const [key, unit] of Object.entries(srcUnits)) {
    const mirror = dstUnits[key];
    const text = JSON.stringify(unit, null, 1);
    if (!mirror) {                                   // 对面没有 → 直接翻译补上
      next = applyUnit(next, key, JSON.parse(await translate({ dir, text }, api)));
      changedCount++; flush();
      console.log(`    + ${key}`);
      continue;
    }
    const beforeUnit = baseUnits?.[key];
    const v = beforeUnit
      ? await isStale({ dir: changed, before: JSON.stringify(beforeUnit, null, 1), after: text, other: JSON.stringify(mirror, null, 1) }, api)
      : { stale: true, why: '取不到改动前的条目，保守重译' };
    if (!v.stale) continue;
    // 同 md 分支：带上对面现有条目，走修订而非重译
    next = applyUnit(next, key, JSON.parse(await translate({ dir, text, existing: JSON.stringify(mirror, null, 1) }, api)));
    changedCount++; flush();
    console.log(`    ~ ${key}（${v.why}）`);
  }
  for (const key of Object.keys(dstUnits)) {         // 源侧删了 → 对面同步删
    if (!srcUnits[key]) { next = removeUnit(next, key); changedCount++; flush(); console.log(`    - ${key}`); }
  }

  if (changedCount === 0) {
    console.log('    条目级判定：无需改动，基线保持不动');
    return { translated: 0, skipped: 1 };
  }
  return { translated: 1, skipped: 0 };
}
