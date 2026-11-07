// Resume un reporte JSON de Playwright: total, pasaron, fallaron, fallas esperadas (hallazgos), omitidas, inestables.
// Uso: node scripts/summarize.mjs ruta/al/reporte.json [--list]
import { readFileSync } from 'node:fs';
const [, , file, flag] = process.argv;
const j = JSON.parse(readFileSync(file, 'utf8'));
const c = { total: 0, passed: 0, failed: 0, expectedFail: 0, skipped: 0, flaky: 0 };
const hallazgos = new Map();
const fallos = [];
const visit = (suite, path = []) => {
  for (const s of suite.suites ?? []) visit(s, [...path, s.title]);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      c.total++;
      const titulo = [...path, spec.title].filter(Boolean).join(' › ');
      const proj = t.projectName;
      const ann = (t.annotations ?? []).find((a) => a.type === 'finding');
      if (t.status === 'skipped') c.skipped++;
      else if (t.status === 'flaky') c.flaky++;
      else if (t.status === 'unexpected') { c.failed++; fallos.push(`[${proj}] ${titulo}`); }
      else if (t.expectedStatus === 'failed') {
        c.expectedFail++;
        const id = ann?.description?.match(/F-\d+/)?.[0] ?? '?';
        hallazgos.set(id, (hallazgos.get(id) ?? 0) + 1);
        if (flag === '--list') console.log(`  fallo esperado ${id} [${proj}] ${titulo}`);
      } else c.passed++;
    }
  }
};
for (const s of j.suites ?? []) visit(s, [s.title]);
console.log(JSON.stringify({ ...c, hallazgos: Object.fromEntries([...hallazgos].sort()) }));
if (fallos.length) console.log('FALLAN:\n' + fallos.join('\n'));
