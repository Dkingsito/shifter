# Sentinel Shift 🛡️

**Sentinel Shift** es un gestor de cuadrantes y turnos de seguridad diseñado para optimizar la planificación de personal. Es una aplicación web moderna, rápida y con soporte PWA (Progressive Web App) para funcionar sin conexión.

## 🚀 Tecnologías Utilizadas

-   **Framework**: [React 18](https://react.dev/)
-   **Herramienta de Construcción**: [Vite](https://vitejs.dev/)
-   **Estilos**: [TailwindCSS](https://tailwindcss.com/)
-   **Iconos**: [Lucide React](https://lucide.dev/)
-   **Soporte PWA**: [Vite PWA](https://vite-pwa-org.netlify.app/)
-   **Exportación**: [html2canvas](https://html2canvas.hertzen.com/) & [jsPDF](https://github.com/parallax/jsPDF)

## ✨ Características Principales

-   **Gestión de Personal**: Alta, edición y baja de empleados con roles específicos (ej. VS).
-   **Cuadrante Dinámico**: Visualización mensual con días, fines de semana y festivos destacados.
-   **Modos de Turno**: Soporte para jornadas de 8 Horas (`8H`) y 12 Horas (`12H`).
-   **Turnos Personalizados**: Creación de turnos a medida con cálculo de nocturnidad y colores personalizados.
-   **Cálculo Automático**:
    -   Horas totales trabajadas.
    -   Horas nocturnas.
    -   Horas festivas.
-   **Control de Infracciones**: Alertas visuales en caso de descanso insuficiente entre turnos (menos de 12h).
-   **Multi-Selección**: Asignación de turnos en bloque para una planificación más rápida.
-   **Exportación Profesional**:
    -   Descarga en formato **JPG** o **PDF**.
    -   **Resumen para WhatsApp**: Copia un resumen de texto formateado con un clic.
-   **Soporte PWA**: Instálalo en tu dispositivo y úsalo sin conexión a internet.

## 🛠️ Instalación y Uso Local

Para ejecutar este proyecto en tu entorno local, asegúrate de tener [Node.js](https://nodejs.org/) instalado.

1.  **Clonar el repositorio**:
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd shifter
    ```

2.  **Instalar dependencias**:
    ```bash
    npm install
    ```

3.  **Iniciar el servidor de desarrollo**:
    ```bash
    npm run dev
    ```
    El proyecto estará disponible en `http://localhost:3000` (o la IP local).

## 📂 Estructura del Proyecto

```text
shifter/
├── public/                 # Archivos estáticos
├── src/
│   ├── App.jsx             # Lógica y UI Principal (React)
│   ├── index.css           # Estilos Globales (Tailwind)
│   └── main.jsx            # Punto de Entrada
├── index.html              # Plantilla HTML
├── vite.config.js          # Configuración de Vite y PWA
└── package.json            # Dependencias y Scripts
```

---
*Desarrollado con ❤️ para la gestión inteligente de personal.*
