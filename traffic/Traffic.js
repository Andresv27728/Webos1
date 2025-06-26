import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.TRAFFIC_PORT || 4000;

const statsFile = path.join(__dirname, 'traffic-stats.json');

let stats = {
  totalVisits: 0,
  visits: []
};

function loadStats() {
  if (fs.existsSync(statsFile)) {
    try {
      stats = JSON.parse(fs.readFileSync(statsFile, 'utf-8'));
    } catch {
      console.error('Error leyendo stats, creando nuevas.');
      stats = { totalVisits: 0, visits: [] };
    }
  }
}

function saveStats() {
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
}

// Middleware para registrar visitas excepto favicon.ico
app.use((req, res, next) => {
  if (req.path === '/favicon.ico') return next();

  stats.totalVisits++;
  stats.visits.push({
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown',
    date: new Date().toISOString(),
    path: req.path
  });

  if (stats.visits.length > 100) stats.visits.shift();

  saveStats();
  next();
});

app.get('/panel', (req, res) => {
  const lastVisit = stats.visits.length > 0 ? stats.visits[stats.visits.length - 1] : null;

  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Panel de Control - Bot</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: #121212;
        color: #eee;
        margin: 0; padding: 20px;
      }
      h1, h2 { color: #1db954; margin-bottom: 10px; }
      hr { border: none; height: 1px; background: #333; margin: 20px 0; }
      ul { list-style: none; padding: 0; }
      ul li {
        background: #222; margin: 8px 0; padding: 12px 20px; border-radius: 8px;
        box-shadow: 0 0 5px #1db954aa; font-size: 1.1em;
      }
      a { color: #1db954; text-decoration: none; font-weight: bold; }
      a:hover { text-decoration: underline; }
      footer { margin-top: 30px; font-size: 0.9em; color: #666; }
    </style>
  </head>
  <body>
    <h1>🤖 Bot is running</h1>
    <hr />
    <h2>📊 Estadísticas de tráfico</h2>
    <ul>
      <li><strong>Total de visitas:</strong> ${stats.totalVisits}</li>
      <li><strong>Última visita:</strong> ${lastVisit ? new Date(lastVisit.date).toLocaleString() : 'N/A'}</li>
      <li><strong>IP última visita:</strong> ${lastVisit ? lastVisit.ip : 'N/A'}</li>
    </ul>
    <hr />
    <a href="/stats">Ver historial de visitas (últimas 100)</a>
    <footer>
      <p>© ${new Date().getFullYear()} Tu Bot - Panel de Control</p>
    </footer>
  </body>
  </html>
  `;

  res.send(html);
});

app.get('/stats', (req, res) => {
  const rows = stats.visits
    .slice()
    .reverse()
    .map(
      (v, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(v.date).toLocaleString()}</td>
        <td>${v.ip}</td>
        <td>${v.path}</td>
      </tr>`
    )
    .join('');

  const html = `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Historial de Visitas - Bot</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: #121212;
        color: #eee;
        margin: 0; padding: 20px;
      }
      h1 { color: #1db954; margin-bottom: 20px; }
      table {
        width: 100%;
        border-collapse: collapse;
        background: #222;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 0 10px #1db954aa;
      }
      th, td {
        padding: 12px 15px;
        text-align: left;
      }
      th {
        background: #1db954;
        color: #121212;
        font-weight: bold;
      }
      tr:nth-child(even) { background: #1e1e1e; }
      tr:hover { background: #333; }
      a {
        color: #1db954;
        text-decoration: none;
        font-weight: bold;
      }
      a:hover { text-decoration: underline; }
      footer {
        margin-top: 30px;
        font-size: 0.9em;
        color: #666;
      }
      @media (max-width: 600px) {
        table, thead, tbody, th, td, tr {
          display: block;
        }
        th {
          position: absolute;
          top: -9999px;
          left: -9999px;
        }
        tr {
          border: 1px solid #333;
          margin-bottom: 10px;
        }
        td {
          border: none;
          border-bottom: 1px solid #444;
          position: relative;
          padding-left: 50%;
        }
        td:before {
          position: absolute;
          top: 12px;
          left: 15px;
          width: 45%;
          padding-right: 10px;
          white-space: nowrap;
          font-weight: bold;
          content: attr(data-label);
          color: #1db954;
        }
      }
    </style>
  </head>
  <body>
    <h1>📈 Historial de visitas (últimas 100)</h1>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Fecha</th>
          <th>IP</th>
          <th>Ruta</th>
        </tr>
      </thead>
      <tbody>
        ${
          rows ||
          `<tr><td colspan="4" style="text-align:center;">No hay visitas registradas.</td></tr>`
        }
      </tbody>
    </table>
    <br />
    <a href="/">← Volver al inicio</a>
    <footer>
      <p>© ${new Date().getFullYear()} Tu Bot - Panel de Control</p>
    </footer>
  </body>
  </html>
  `;

  res.send(html);
});

app.listen(PORT, () => {
  loadStats();
  console.log(`📊 Servidor de estadísticas corriendo en http://localhost:${PORT}`);
});
