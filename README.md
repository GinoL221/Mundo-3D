# Mundo3D

Mundo3D es un ecommerce especializado en productos personalizados y únicos mediante impresión 3D.
Los clientes pueden explorar, diseñar y adquirir una variedad de objetos, desde elementos decorativos hasta prototipos funcionales, con opciones para elegir diseños, colores y materiales.

## Público objetivo

- Personas interesadas en la innovación y la impresión 3D, que buscan productos únicos y personalizados.
- Clientes que disfrutan creando proyectos y prototipos, y que buscan una manera accesible de materializar sus ideas.

## Tecnologías utilizadas

- Node.js / Express.js 4.x
- TypeScript (transpilado en dev con ts-node)
- Sequelize 6.x (ORM, mapeo camelCase → snake_case via `field`)
- MySQL (mysql2)
- EJS (vistas)
- HTML, CSS modular (design system PICO-8), JavaScript (frontend)
- bcryptjs + JWT (autenticación)
- express-validator (validaciones)
- multer + uuid (upload de imágenes)
- Jest (testing, 326 tests passing)

## Instalación y uso

1. Clona el repositorio:
   ```bash
   git clone https://github.com/GinoL221/Mundo-3D.git
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura el archivo `.env` con tus variables de entorno:
   ```env
   PORT=3031
   DB_USER=root
   DB_PASS=tu_password
   DB_NAME=mundo_3d_db
   DB_HOST=localhost
   SESSION_SECRET=tu_secreto
   ```
4. Inicia el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```
5. Ejecuta los tests:
   ```bash
   npm test
   ```

## Arquitectura

El proyecto sigue **Clean Architecture / Hexagonal**:

```
src/
├── domain/             # Entidades, puertos, excepciones
├── application/        # Casos de uso (RegisterUser, AuthenticateUser, VerifyRememberToken…)
├── infrastructure/     # Controladores, repositorios Sequelize, middlewares y rutas (TypeScript)
│   ├── controllers/
│   ├── repositories/
│   ├── middlewares/    # auth, csrf, errorHandler, loginLimiter, upload, validators
│   └── routes/         # api/, userRoutes, productRoutes, cartRoutes, staticPagesRoutes
├── database/
│   ├── models/         # Sequelize models con mapeo camelCase → snake_case
│   └── config/
└── views/              # Templates EJS
public/
├── css/                # Design system modular (tokens + base + 12 componentes BEM)
└── js/                 # carousel.js, theme.js, register.js (validación reactiva)
```

## Diseño visual

El proyecto utiliza un sistema de diseño **PICO-8 pixel art** con:
- Paleta PICO-8 mapeada a roles semánticos (`--color-primary`, `--color-bg`, `--color-text`, etc.)
- Tipografía pixel: **Press Start 2P** (headings) + **VT323** (body)
- Renderizado pixelado: `image-rendering: pixelated` en todas las imágenes
- Iconos pixel art (16×16) en `public/images/icons/`
- Ilustraciones de categoría (64×64) en `public/images/illustrations/`
- Tema dark/light con CSS custom properties y anti-flash script

## Funcionalidades principales

- Registro e inicio de sesión de usuarios
  - Contraseña fuerte: mín 8 / máx 32 chars, al menos 1 mayúscula, 1 número y 1 carácter especial
  - Feedback visual en tiempo real en el formulario de registro
  - Remember-me con token persistido en base de datos
- ABM de productos (crear, ver, modificar, eliminar)
- Carrito de compras
- API REST securizada con JWT (`/api/products`, `/api/users`)
- Panel de administración (en desarrollo)
- Seed automático de datos iniciales (categorías, franquicias, usuarios, productos)

## Testing

```bash
npm test
```

326 tests passing · 63 suites · strict TDD

## Referencias

- [Tiendamia](https://tiendamia.com/ar/)
- [Eldon](https://www.eldon.com.ar/)
- [Mercadolibre](https://www.mercadolibre.com.ar/)
- [Doctor Ink](https://www.doctorink.com.ar/)
- [Enanddes](https://enanddes.es/quienes-somos/)
