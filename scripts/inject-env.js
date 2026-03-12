/**
 * Lee .env y genera js/config.js desde js/config.template.js.
 * Uso: node scripts/inject-env.js  (o npm run config)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const templatePath = path.join(root, 'js', 'config.template.js');
const outputPath = path.join(root, 'js', 'config.js');

function parseEnv(content) {
  const env = {};
  content.split('\n').forEach(function (line) {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const i = line.indexOf('=');
    if (i === -1) return;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  });
  return env;
}

let env = {};
if (fs.existsSync(envPath)) {
  env = parseEnv(fs.readFileSync(envPath, 'utf8'));
}
// En Railway/entornos cloud las variables vienen por process.env
if (process.env.GOOGLE_MAPS_API_KEY) env.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!env.GOOGLE_MAPS_API_KEY && !process.env.GOOGLE_MAPS_API_KEY) {
  console.warn('No existe .env o GOOGLE_MAPS_API_KEY. Copiá .env.example a .env o configurá la variable.');
}

let template = fs.readFileSync(templatePath, 'utf8');
const key = env.GOOGLE_MAPS_API_KEY || '';
template = template.replace(/__GOOGLE_MAPS_API_KEY__/g, key.replace(/\\/g, '\\\\').replace(/'/g, "\\'"));

fs.writeFileSync(outputPath, template, 'utf8');
console.log('js/config.js generado correctamente.');
