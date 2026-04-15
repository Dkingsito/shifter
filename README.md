# Sentinel Shift 🛡️

**Sentinel Shift** es un gestor de cuadrantes y turnos de seguridad diseñado para optimizar la planificación de personal en servicios 24/7. Es una PWA (Progressive Web App) rápida, instalable y con soporte offline.

🌐 **Demo en vivo**: [turnos.dking.es](https://turnos.dking.es)

## 🚀 Tecnologías

| Área | Tecnología |
|---|---|
| Framework | React 18 + Vite |
| Estilos | TailwindCSS + Lucide React |
| PWA | vite-plugin-pwa |
| Exportación | html2canvas · jsPDF |
| Sync backend | Node.js · mysql2 · MariaDB |
| QR | qrcode |

## ✨ Características

### Cuadrante
- Visualización mensual con fines de semana y festivos destacados
- Modos de jornada **8H** y **12H**
- Multi-selección de celdas para asignación en bloque
- Alertas de infracción de descanso (< 12h entre turnos)
- Cálculo automático de horas totales, nocturnas y festivas
- Gestión de personal: alta, edición y baja con rol configurable
- Soporte multi-proyecto (varios servicios independientes)

### Turnos personalizados
- Creación mediante hora de entrada y hora de salida (duración y nocturnidad calculadas automáticamente)
- Preview en vivo antes de guardar
- Color libre con selector nativo + paleta de acceso rápido

### Plantillas de rotación
- Presets rápidos: 4×2, 3×3, 5×2, 6×3, 2×2, 7×7
- Ciclo personalizado (días trabajando / días libres)
- Modo **Semana Larga · Semana Corta** (patrón específico de seguridad privada)
- Offset de inicio ajustable con preview interactivo del mes completo

### Exportación
- Descarga en **JPG** o **PDF**
- Resumen automático para **WhatsApp** con un clic

### Sincronización entre dispositivos
- Código de sync de 6 caracteres por proyecto (sin cuentas)
- QR generado en la app para pasar el código al móvil
- Push / Pull bidireccional contra MariaDB
- Indicador de cambios pendientes en el servidor

### PWA
- Instalable en escritorio y móvil
- Funciona sin conexión a internet

## 🛠️ Instalación local

Requiere [Node.js](https://nodejs.org/).

```bash
git clone https://github.com/Dkingsito/shifter
cd shifter
npm install
npm run dev
```

La app estará disponible en `http://localhost:3000`.

> La sincronización entre dispositivos requiere una instancia de MariaDB. Sin ella, la app funciona completamente en local (localStorage).

## ☁️ Configuración del sync (opcional)

Crea un fichero `.env` en la raíz (ver `.env.example`):

```env
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=tu_usuario
DB_PASS=tu_contraseña
DB_NAME=shifter_sync
```

La base de datos y la tabla se crean automáticamente al primer uso.

## 📂 Estructura del proyecto

```
shifter/
├── src/
│   ├── App.jsx         # Lógica y UI principal
│   ├── index.css       # Estilos globales (Tailwind)
│   └── main.jsx        # Punto de entrada
├── sync-api.js         # Middleware de sync (MariaDB)
├── index.js            # Entry point para AMP / Node.js
├── vite.config.js      # Configuración de Vite, PWA y API middleware
├── .env.example        # Plantilla de variables de entorno
├── deploy/             # Copia lista para subir al servidor (WinSCP)
└── package.json
```

---
*Desarrollado con ❤️ para la gestión inteligente de personal de seguridad.*
