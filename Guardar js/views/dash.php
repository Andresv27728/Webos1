<?php
// dashboard.php

// Lista páginas válidas para evitar problemas de seguridad
$allowed_pages = ['home', 'usuarios', 'comandos', 'logs', 'configuracion'];
$page = $_GET['page'] ?? 'home';
if (!in_array($page, $allowed_pages)) $page = 'home';

// Función para marcar el link activo
function isActive($p, $current) {
    return $p === $current ? 'active' : '';
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dashboard Bot WhatsApp</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body, h1, h2, p, ul, li, a {
      margin: 0; padding: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
      text-decoration: none;
    }
    ul {
      list-style: none;
    }
    .dashboard-container {
      display: flex;
      min-height: 100vh;
      background: #f0f2f5;
    }
    /* Sidebar */
    .sidebar {
      width: 260px;
      background: #1f2937;
      color: #cbd5e1;
      display: flex;
      flex-direction: column;
      padding-top: 20px;
      position: fixed;
      height: 100vh;
      user-select: none;
    }
    .sidebar .logo {
      font-size: 1.8rem;
      font-weight: 700;
      color: #38bdf8;
      text-align: center;
      margin-bottom: 30px;
    }
    .sidebar nav ul li {
      margin-bottom: 10px;
    }
    .sidebar nav ul li a {
      display: block;
      padding: 12px 25px;
      border-left: 4px solid transparent;
      transition: background 0.3s, border-color 0.3s;
      font-weight: 600;
    }
    .sidebar nav ul li a:hover,
    .sidebar nav ul li a.active {
      background: #2563eb;
      border-left-color: #3b82f6;
      color: white;
    }
    /* Main content */
    .main-content {
      margin-left: 260px;
      padding: 30px 40px;
      flex-grow: 1;
      overflow-y: auto;
    }
    /* Responsive */
    @media (max-width: 768px) {
      .sidebar {
        position: relative;
        width: 100%;
        height: auto;
        flex-direction: row;
        padding: 10px 0;
        overflow-x: auto;
      }
      .sidebar .logo {
        margin-bottom: 0;
        padding-left: 20px;
        flex: 0 0 auto;
      }
      .sidebar nav ul {
        display: flex;
        gap: 10px;
        padding-left: 10px;
        margin-bottom: 0;
      }
      .sidebar nav ul li {
        margin-bottom: 0;
      }
      .sidebar nav ul li a {
        border-left: none;
        border-bottom: 2px solid transparent;
        padding: 10px 15px;
      }
      .sidebar nav ul li a:hover,
      .sidebar nav ul li a.active {
        border-bottom-color: #3b82f6;
        background: transparent;
      }
      .main-content {
        margin-left: 0;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="dashboard-container">
    <aside class="sidebar">
      <div class="logo">WA Bot Dashboard</div>
      <nav>
        <ul>
          <li><a href="?page=home" class="<?= isActive('home', $page) ?>">Inicio</a></li>
          <li><a href="?page=usuarios" class="<?= isActive('usuarios', $page) ?>">Usuarios</a></li>
          <li><a href="?page=comandos" class="<?= isActive('comandos', $page) ?>">Comandos</a></li>
          <li><a href="?page=logs" class="<?= isActive('logs', $page) ?>">Logs</a></li>
          <li><a href="?page=configuracion" class="<?= isActive('configuracion', $page) ?>">Configuración</a></li>
        </ul>
      </nav>
    </aside>

    <main class="main-content">
      <?php
      // Cargar contenido según página
      switch($page) {
        case 'usuarios':
          ?>
          <h1>Gestión de Usuarios</h1>
          <p>Aquí puedes ver y administrar los usuarios que interactúan con el bot.</p>
          <!-- Aquí agregarás tablas, formularios, etc -->
          <?php
          break;
        case 'comandos':
          ?>
          <h1>Comandos del Bot</h1>
          <p>Administra los comandos activos, crea nuevos o edita existentes.</p>
          <?php
          break;
        case 'logs':
          ?>
          <h1>Logs de Actividad</h1>
          <p>Revisa el historial de mensajes y actividades del bot.</p>
          <?php
          break;
        case 'configuracion':
          ?>
          <h1>Configuración General</h1>
          <p>Ajusta parámetros globales del bot, como tokens, respuestas, etc.</p>
          <?php
          break;
        case 'home':
        default:
          ?>
          <h1>Bienvenido al Dashboard del Bot WhatsApp</h1>
          <p>Desde aquí puedes gestionar usuarios, comandos, logs y configuración.</p>
          <?php
          break;
      }
      ?>
    </main>
  </div>
</body>
</html>
