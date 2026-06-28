# Mundo3D

Mundo3D es un e-commerce moderno y desacoplado, especializado en la venta de productos personalizados mediante impresión 3D. El proyecto está estructurado como un monorepo simétrico administrado con `pnpm`, compuesto por un frontend estático e interactivo en Astro y una API REST headless en Express/TypeScript bajo arquitectura limpia/hexagonal.

---

## Inicio Rápido (Quick Start)

### 1. Clonar e Instalar
Cloná el repositorio e instalá las dependencias desde la raíz del monorepo:
```bash
git clone https://github.com/GinoL221/Mundo-3D.git
cd Mundo-3D
pnpm install
```

### 2. Configurar Entorno
Creá el archivo de configuración `.env` dentro de la carpeta `backend/` basándote en `backend/.env.example`:
```env
PORT=3000
JWT_SECRET=tu_secreto_super_seguro
CORS_ORIGIN=http://localhost:4321
DB_USER=root
DB_PASS=tu_password
DB_NAME=mundo_3d_db
DB_HOST=localhost
```

### 3. Levantar los Servidores
Podés correr ambos entornos de desarrollo (backend y frontend) de la siguiente manera:
```bash
# Iniciar la API REST Express (Servidor backend en el puerto 3000)
pnpm dev

# Iniciar el Frontend Astro (Servidor de desarrollo en el puerto 4321)
pnpm frontend:dev
```

---

## Estructura del Monorepo

El proyecto implementa una estructura de **Monorepo Simétrico**:

```
Mundo-3D/
├── backend/              # API REST Headless (Express.js + TypeScript)
│   ├── src/              # Código fuente de arquitectura limpia/hexagonal
│   │   ├── domain/       # Entidades puras de dominio y puertos (TypeScript)
│   │   ├── application/  # Casos de uso de negocio (Auth, Cart, Products)
│   │   └── infrastructure/ # Controladores API, adaptadores Sequelize y middlewares
│   ├── public/           # Archivos estáticos servidos por Express (pixel art localizados)
│   ├── tsconfig.json     # Configuración de compilación de TypeScript
│   └── package.json      # Dependencias del servidor backend
├── frontend/             # Aplicación Frontend (Astro 6.x)
│   ├── src/
│   │   ├── components/   # Componentes interactivos y reutilizables
│   │   ├── layouts/      # Estructura de layout base con theme-inject
│   │   ├── pages/        # Rutas estáticas (SSG) y dinámicas (Login, Cart, etc.)
│   │   ├── store/        # Nano Stores para sincronización asíncrona de Carrito
│   │   └── styles/       # Sistema de diseño modular en Vanilla CSS
│   └── public/           # Assets estáticos y assets locales
├── openspec/             # Especificaciones de diseño del sistema bajo metodología SDD
└── package.json          # Orquestador del monorepo (scripts globales y Prettier)
```

---

## Tecnologías Utilizadas

| Capa | Tecnologías | Propósito |
|---|---|---|
| **Root (Monorepo)** | pnpm Workspaces, Prettier | Orquestación de dependencias y formato de código global. |
| **Frontend** | Astro 6.x, Vanilla CSS, HTML5, Nano Stores | Generación de páginas SSG y manejo reactivo del carrito de compras. |
| **Backend** | Node.js, Express.js, TypeScript | API REST Headless, JWT, CORS. |
| **Persistencia** | MySQL, Sequelize 6.x (ORM) | Modelos relacionales con mapeo camelCase en código y snake_case en DB. |
| **Pruebas** | Jest, Supertest | Testing unitario e integración con TDD estricto. |

---

## Funcionalidades Clave

- **Autenticación:** JWT con Bearer Token y almacenamiento local en `localStorage` (sin sesiones en cookies del servidor).
- **Carrito de Compras Asíncrono:** Carrito reactivo del lado del cliente hidratado por Nano Stores con sincronización en tiempo real mediante `/api/cart`.
- **Pre-rendering SSG:** Páginas estáticas informativas pre-renderizadas en build-time con Astro para velocidad de carga máxima.
- **Validación Robusta (TDD):** Validación de formularios en frontend y backend (fuerza de contraseña en tiempo real, validación multipart en subida de imágenes de productos y perfiles).

---

## Sistema de Diseño (Visual System)

El proyecto utiliza un sistema de diseño estético **PICO-8 pixel art**:
- **Tipografías:** **Press Start 2P** para títulos y **VT323** para textos de lectura.
- **Paleta de Colores:** Colores semánticos definidos mediante CSS custom properties mapeados de la paleta oficial de PICO-8.
- **Ajuste Pixelado:** Renderizado óptimo en imágenes usando `image-rendering: pixelated`.
- **Tema:** Soporte de Tema Dark/Light nativo con script anti-flash para evitar parpadeos en carga.

---

## Pruebas (Testing)

El backend cuenta con una suite completa de pruebas unitarias e integración en Jest bajo la metodología **Strict TDD** ejecutadas recursivamente:
```bash
# Correr todas las pruebas unitarias e integración de forma recursiva en el monorepo
pnpm test
```
* **Estado:** 52 suites de pruebas ejecutadas de forma limpia (244 tests pasando), 0 fallados, 0 omitidos.

---

## Colaboradores y Referencias

- [Tiendamia](https://tiendamia.com/ar/)
- [Mercadolibre](https://www.mercadolibre.com.ar/)
- [Doctor Ink](https://www.doctorink.com.ar/)
- [Eldon](https://www.eldon.com.ar/)
