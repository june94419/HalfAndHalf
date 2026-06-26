#!/usr/bin/env node
'use strict';

/**
 * Post-build sanitizer: removes eval() patterns that static security scanners flag.
 *
 * Two sources of eval in the Metro web bundle:
 *  1. fetchThenEvalAsync (Metro bundle-splitting runtime, never called — we don't use code splitting)
 *  2. uuidv4 Node.js crypto fallback (dead branch in browser — crypto is always available)
 *
 * This script is run automatically after `expo export --platform web` via the
 * granite.config.ts build command, before ait packages the .ait artifact.
 */

const fs   = require('fs');
const path = require('path');

const DIST_DIR   = path.join(__dirname, '..', 'dist');
const WEB_DIRS   = [
  DIST_DIR,
  path.join(__dirname, '..', 'web-build'),
  path.join(__dirname, '..', 'dist', 'web'),
].filter(d => { try { return fs.statSync(d).isDirectory(); } catch { return false; } });

function walk(dir, ext) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
}

// ── Phase 0: HTML 파일에서 Kakao SDK 정적 태그 및 integrity/crossorigin 완전 제거 ──
// 동적 주입(App.js)으로 전환하였으므로 HTML에 Kakao <script> 태그 자체가 없어야 함.
// 빌드 툴이 재주입하더라도 이 단계에서 완전히 걷어낸다.
let htmlFixed = 0;
const KAKAO_TAG_RE     = /\s*<!--[^>]*카카오[^>]*-->[\s\S]*?<\/script>/g;
const KAKAO_SCRIPT_RE  = /\s*<script\b[^>]*t1\.kakaocdn\.net\/kakao_js_sdk[^>]*>[\s\S]*?<\/script>/g;
const KAKAO_SCRIPT_RE2 = /\s*<script\b[^>]*t1\.kakaocdn\.net\/kakao_js_sdk[^>]*\/>/g;
const KAKAO_INTEGRITY_RE =
  /(<script\b[^>]*t1\.kakaocdn\.net\/kakao_js_sdk[^>]*?)(\s+integrity="[^"]*")([^>]*>)/g;
const KAKAO_CROSSORIGIN_RE =
  /(<script\b[^>]*t1\.kakaocdn\.net\/kakao_js_sdk[^>]*?)(\s+crossorigin(?:="[^"]*")?)([^>]*>)/g;

for (const dir of WEB_DIRS) {
  for (const file of walk(dir, '.html')) {
    let src = fs.readFileSync(file, 'utf-8');
    // 1단계: Kakao <script> 태그 전체 제거 (동적 주입으로 대체됨)
    let cleaned = src
      .replace(KAKAO_SCRIPT_RE,  '')
      .replace(KAKAO_SCRIPT_RE2, '');
    // 2단계: 혹시 태그가 남아있다면 integrity/crossorigin 속성만 제거
    cleaned = cleaned
      .replace(KAKAO_INTEGRITY_RE,   '$1$3')
      .replace(KAKAO_CROSSORIGIN_RE, '$1$3');
    if (cleaned !== src) {
      fs.writeFileSync(file, cleaned, 'utf-8');
      htmlFixed++;
      console.log(`[sanitize] ✓ Kakao script 태그/속성 제거: ${path.relative(path.dirname(dir), file)}`);
    }
  }
}
if (htmlFixed > 0) {
  console.log(`[sanitize] ✅ ${htmlFixed}개 HTML 파일 Kakao 정리 완료\n`);
} else {
  console.log('[sanitize] ✓ HTML Kakao 검사: 이상 없음\n');
}

const REPLACEMENTS = [
  {
    // Metro fetchThenEvalAsync: eval(body) — used to load split bundles dynamically.
    // We never use code splitting, so this path is dead. Replace with a throw.
    pattern: /\beval\(body\)/g,
    replacement: '(function(){throw new Error("Dynamic bundle loading is disabled");})()',
    label: 'eval(body) [fetchThenEvalAsync]',
  },
  {
    // uuid v4 Node.js fallback: eval('require')('node:crypto').randomUUID()
    // Dead branch in browser — crypto.randomUUID() is always available in modern WebView.
    pattern: /eval\('require'\)\('node:crypto'\)\.randomUUID\(\)/g,
    replacement: 'crypto.randomUUID()',
    label: "eval('require') [uuid Node.js fallback]",
  },
];

let totalFixed = 0;

for (const file of walk(DIST_DIR, '.js')) {
  let src = fs.readFileSync(file, 'utf-8');
  let changed = false;

  for (const { pattern, replacement, label } of REPLACEMENTS) {
    const matches = src.match(pattern);
    if (matches) {
      src = src.replace(pattern, replacement);
      totalFixed += matches.length;
      changed = true;
      const rel = path.relative(DIST_DIR, file);
      console.log(`[sanitize] ✓ ${matches.length}x removed — ${label}`);
      console.log(`           file: ${rel}`);
    }
  }

  if (changed) fs.writeFileSync(file, src, 'utf-8');
}

console.log(`\n[sanitize] Fixed ${totalFixed} eval() occurrence(s).`);

// ── Final verification ──────────────────────────────────────────────
const remaining = [];
for (const file of walk(DIST_DIR, '.js')) {
  const src = fs.readFileSync(file, 'utf-8');
  const found = src.match(/eval\(/g);
  if (found) remaining.push({ file: path.relative(DIST_DIR, file), count: found.length });
}

if (remaining.length > 0) {
  console.error('\n[sanitize] ✗ eval() STILL FOUND:');
  remaining.forEach(({ file, count }) => console.error(`  ${count}x in ${file}`));
  process.exit(1);
} else {
  console.log('[sanitize] ✅ VERIFIED: 0 eval() in all bundle files.\n');
}
