import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Cargar .env manualmente (sin dependencia extra)
try {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(path.join(__dir, '.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^=#\s]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
} catch { /* .env no existe, se usan variables del sistema */ }

const DB = {
  host:     process.env.DB_HOST || '127.0.0.1',
  port:     Number(process.env.DB_PORT || 3307),
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'shifter_sync',
  waitForConnections: true,
  connectionLimit: 5,
};

let pool = null;
let dbReady = false;

const getPool = () => {
  if (!pool) pool = mysql.createPool(DB);
  return pool;
};

const ensureDB = async () => {
  if (dbReady) return;
  // Conectar sin DB para crearla si no existe
  const init = await mysql.createConnection({
    host: DB.host, port: DB.port, user: DB.user, password: DB.password,
  });
  await init.execute(
    `CREATE DATABASE IF NOT EXISTS \`${DB.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await init.execute(`USE \`${DB.database}\``);
  await init.execute(`
    CREATE TABLE IF NOT EXISTS synced_projects (
      code       VARCHAR(8)  PRIMARY KEY,
      data       LONGTEXT    NOT NULL,
      updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await init.end();
  dbReady = true;
  console.log('[sync-api] DB lista:', DB.host + ':' + DB.port + '/' + DB.database);
};

// Lee el body como JSON
const readBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 2e6) reject(new Error('Payload too large')); });
  req.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON inválido')); } });
  req.on('error', reject);
});

const json = (res, status, obj) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(obj));
};

// Middleware connect-compatible para Vite
export const syncMiddleware = async (req, res, next) => {
  // Solo manejamos rutas /api/sync/*
  if (!req.url?.startsWith('/api/sync')) return next?.();

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // Extraer código y sub-ruta: /api/sync/:code  o  /api/sync/:code/status
  const parts = req.url.replace(/^\/api\/sync\/?/, '').split('/').filter(Boolean);
  const code  = parts[0];
  const sub   = parts[1]; // 'status' | undefined

  if (!code || !/^[A-Z0-9]{4,8}$/i.test(code)) {
    return json(res, 400, { error: 'Código inválido' });
  }

  try {
    await ensureDB();
    const db = getPool();

    // GET /api/sync/:code/status  →  solo timestamp
    // GET /api/sync/:code         →  datos completos
    if (req.method === 'GET') {
      const [rows] = await db.execute(
        `SELECT data, updated_at FROM \`${DB.database}\`.synced_projects WHERE code = ?`,
        [code.toUpperCase()]
      );
      if (!rows.length) return json(res, 404, { error: 'Código no encontrado' });

      if (sub === 'status') {
        return json(res, 200, { updated_at: rows[0].updated_at });
      }
      return json(res, 200, {
        data: JSON.parse(rows[0].data),
        updated_at: rows[0].updated_at,
      });
    }

    // POST /api/sync/:code  →  guardar datos
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (!body?.data) return json(res, 400, { error: 'Falta campo "data"' });

      await db.execute(
        `INSERT INTO \`${DB.database}\`.synced_projects (code, data, updated_at)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
        [code.toUpperCase(), JSON.stringify(body.data)]
      );
      return json(res, 200, { ok: true });
    }

    json(res, 405, { error: 'Método no permitido' });

  } catch (err) {
    console.error('[sync-api] Error:', err.message);
    json(res, 500, { error: 'Error del servidor' });
  }
};
