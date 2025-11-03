#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readJSON(p) {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
}

function buildBlock(metrics) {
  const now = new Date().toISOString();
  const agg = metrics.metricas_globales?.servicios_completados_solo || {};
  const tests = metrics.tests_totales || {};
  const servicios = metrics.servicios || {};

  const serviciosList = Object.entries(servicios)
    .map(([name, s]) => `- ${name}: statements ${s.statements}% | branches ${s.branches}% | funcs ${s.functions}% | lines ${s.lines}% | tests ${s.tests_pasando}/${s.tests}`)
    .join('\n');

  return [
    '<!-- AUTO:METRICS:BEGIN -->',
    `Actualizado: ${now}`,
    '',
    `Servicios completados: ${metrics.servicios_completados}/${metrics.servicios_totales} (${metrics.porcentaje_servicios}%)`,
    `Cobertura (servicios completados): statements ${agg.statements}% | branches ${agg.branches}% | funcs ${agg.functions}% | lines ${agg.lines}%`,
    `Tests: ${tests.pasando || 0}/${tests.ejecutados || 0} pasando (success ${tests.success_rate || 0}%)`,
    '',
    'Detalle por servicio:',
    serviciosList,
    '<!-- AUTO:METRICS:END -->'
  ].join('\n');
}

async function upsertBlock(filePath, block) {
  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch (e) {
    // If file does not exist, create with block only
    await fs.writeFile(filePath, block + '\n');
    return;
  }

  const begin = '<!-- AUTO:METRICS:BEGIN -->';
  const end = '<!-- AUTO:METRICS:END -->';
  if (content.includes(begin) && content.includes(end)) {
    const updated = content.replace(new RegExp(`${begin}[\s\S]*?${end}`), block);
    await fs.writeFile(filePath, updated);
  } else {
    const updated = `${block}\n\n${content}`;
    await fs.writeFile(filePath, updated);
  }
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const metricsPath = path.join(root, '.testing-metrics.json');
  const metrics = await readJSON(metricsPath);
  const block = buildBlock(metrics);

  const testingProgress = path.join(root, 'TESTING_PROGRESS.md');
  const progresoTracker = path.resolve(root, '..', '..', 'PROGRESO_TRACKER.md');

  await upsertBlock(testingProgress, block);
  await upsertBlock(progresoTracker, block);
  console.log('Docs sincronizadas con métricas reales.');
}

main().catch((e) => {
  console.error('Error sincronizando documentación:', e);
  process.exit(1);
});
