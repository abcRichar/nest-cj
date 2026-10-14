/**
 * 构建共享包 @elp/shared 的双产物：
 *   dist/cjs  -> NestJS（server / ai-service）以 require 方式消费
 *   dist/esm  -> Vite 前端以 import 方式消费
 *
 * 为什么不只用一套：CJS 产物在 Vite 里无法按名导入（Rollup 会报
 * "xxx is not exported"），而 NestJS 默认又是 CJS。故两个格式各出一份。
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.join(root, 'packages', 'shared');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

// 清掉产物与增量缓存：tsbuildinfo 与 dist 不同步时 tsc 会静默跳过 emit
rmSync(path.join(pkgDir, 'dist'), { recursive: true, force: true });
rmSync(path.join(pkgDir, 'tsconfig.tsbuildinfo'), { force: true });

for (const cfg of ['tsconfig.cjs.json', 'tsconfig.esm.json']) {
  console.log(`[shared] tsc -p ${cfg}`);
  execFileSync(process.execPath, [tsc, '-p', path.join(pkgDir, cfg)], { stdio: 'inherit' });
}
console.log('[shared] 构建完成：dist/cjs + dist/esm');
