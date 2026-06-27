# Mundo3D

Mundo3D es un e-commerce moderno y desacoplado, especializado en la venta de productos personalizados mediante impresión 3D. El proyecto cuenta con un frontend estático e interactivo en Astro y una API REST headless en Express/TypeScript estructurada bajo los principios de Arquitectura Limpia/Hexagonal.

---

## Inicio Rápido (Quick Start)

### 1. Clonar e Instalar
Cloná el repositorio e instalá las dependencias utilizando pnpm workspaces:
```bash
git clone https://github.com/GinoL221/Mundo-3D.git
cd Mundo-3D
pnpm install
```

### 2. Configurar Entorno
Creá un archivo `.env` en la raíz del proyecto basándote en `.env.example`:
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
Necesitás correr ambos servidores en paralelo en terminales distintas:
```bash
# Terminal 1: Iniciar API REST Express (Puerto 3000)
pnpm run dev

# Terminal 2: Iniciar Frontend Astro (Puerto 4321)
pnpm --filter frontend dev
```

---

## Arquitectura del Proyecto

El proyecto está estructurado como un **Monorepo Desacoplado**:

```
Mundo-3D/
├── frontend/             # Aplicación Frontend (Astro 6.x)
│   ├── src/
│   │   ├── components/   # Componentes reactivos (Header, Footer)
│   │   ├── layouts/      # Layout base con theme-inject
│   │   ├── pages/        # Páginas estáticas (SSG) e interactivas (Login, Register, Cart)
│   │   ├── store/        # Nano Stores para sincronización asíncrona de Carrito
│   │   └── styles/       # Sistema de diseño modular en Vanilla CSS
│   └── public/           # Assets públicos pixel art localizados
├── src/                  # API REST Headless (Express.js + TypeScript)
│   ├── domain/           # Entidades puras y puertos (TypeScript)
│   ├── application/      # Casos de uso de negocio (Auth, Cart, Products)
│   ├── infrastructure/   # Controladores API, repositorios Sequelize y middlewares
│   └── database/
│       ├── models/       # Modelos Sequelize mapeados (camelCase ↔ snake_case)
│       └── seed.js       # Script de seeding automático en base de datos
└── openspec/             # Especificaciones de diseño bajo metodología SDD
```

---

## Tecnologías Utilizadas

| Capa | Tecnologías | Propósito |
|---|---|---|
| **Frontend** | Astro 6.x, Vanilla CSS, HTML5, Nano Stores | Generación de páginas SSG y manejo reactivo del carrito de compras. |
| **Backend** | Node.js, Express.js, TypeScript | API REST Headless, JWT, CORS. |
| **Persistencia** | MySQL, Sequelize 6.x (ORM) | Modelos relacionales con mapeo camelCase en código y snake_case en DB. |
| **Pruebas** | Jest, Supertest | Testing unitario e integración con TDD estricto. |

---

## Funcionalidades Clave

- **Autenticación:** JWT con Bearer Token y almacenamiento local en `localStorage` (sin sesiones en cookies del servidor).
- **Carrito de Compras Asíncrono:** Carrito reactivo del lado del cliente hidratado por Nano Stores con sincronización en tiempo real mediante `/api/cart`.
- **Pre-rendering SSG:** Páginas estáticas informativas (Sobre Nosotros, FAQ, Ayuda, etc.) pre-renderizadas en build-time con Astro para velocidad de carga máxima.
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

El backend cuenta con una suite completa de pruebas unitarias e integración en Jest bajo la metodología **Strict TDD**:
```bash
# Correr todas las pruebas unitarias e integración
pnpm test
```
* **Estado:** 48 suites de pruebas ejecutadas de forma limpia (207 tests pasando), 0 fallados, 0 omitidos.

---

## Colaboradores y Referencias

- [Tiendamia](https://tiendamia.com/ar/)
- [Mercadolibre](https://www.mercadolibre.com.ar/)
- [Doctor Ink](https://www.doctorink.com.ar/)
- [Eldon](https://www.eldon.com.ar/)
