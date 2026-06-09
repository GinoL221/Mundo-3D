# Mundo3D

Mundo3D es un ecommerce especializado en productos personalizados y únicos mediante impresión 3D.
Los clientes pueden explorar, diseñar y adquirir una variedad de objetos, desde elementos decorativos hasta prototipos funcionales, con opciones para elegir diseños, colores y materiales.

## Público objetivo

- Personas interesadas en la innovación y la impresión 3D, que buscan productos únicos y personalizados.
- Clientes que disfrutan creando proyectos y prototipos, y que buscan una manera accesible de materializar sus ideas.

## Tecnologías utilizadas

- Node.js
- Express.js
- Sequelize (ORM)
- MySQL
- EJS (vistas)
- HTML, CSS, JavaScript (frontend)
- bcryptjs (hash de contraseñas)

## Instalación y uso

1. Clona el repositorio:
   ```bash
   git clone <url-del-repo>
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura el archivo `.env` con tus variables de entorno (puerto, credenciales de base de datos, etc):
   ```env
   PORT=3031
   DB_USER=root
   DB_PASS=tu_password
   DB_NAME=ecommerce_dbtest
   DB_HOST=localhost
   ```
4. Inicia el servidor:
   ```bash
   npm run dev
   ```

## Diseño visual

El proyecto utiliza un sistema de diseño **PICO-8 pixel art** con:
- Paleta PICO-8 mapeada a roles semánticos (`--bg`, `--fg`, `--accent`, etc.)
- Tipografía pixel: **Press Start 2P** (headings) + **VT323** (body)
- Renderizado pixelado: `image-rendering: pixelated` en todas las imágenes
- Iconos pixel art (16×16) en `public/images/icons/`
- Ilustraciones de categoría (64×64) en `public/images/illustrations/`

## Estructura del proyecto

```
├── src/
│   ├── app.js
│   ├── controllers/
│   ├── database/
│   │   ├── config/
│   │   ├── data/
│   │   ├── models/
│   │   └── seed.js
│   ├── middlewares/
│   ├── routes/
│   └── views/
├── public/
│   ├── css/
│   │   └── styles.css    # PICO-8 design system (single stylesheet)
│   ├── images/
│   │   ├── icons/        # Pixel art icons (16×16)
│   │   └── illustrations/ # Category illustrations (64×64)
│   ├── img/
│   └── ...
├── index.js
├── package.json
└── README.md
```

## Funcionalidades principales

- Registro e inicio de sesión de usuarios (con hash de contraseña)
- ABM de productos (crear, ver, modificar, eliminar)
- Carrito de compras
- Panel de administración (pendiente de completar)
- Seed automático de datos iniciales (categorías, franquicias, usuarios, productos)

## Checklist para completar

- [ ] Mejorar validaciones de formularios
- [ ] Agregar tests automáticos
- [ ] Documentar endpoints de la API
- [ ] Mejorar la UI/UX del frontend
- [ ] Implementar panel de administración completo
- [ ] Agregar soporte para imágenes de productos subidas por el usuario
- [ ] Internacionalización (i18n)
- [ ] Despliegue en producción

## Referencias

- [Tiendamia](https://tiendamia.com/ar/)
- [Eldon](https://www.eldon.com.ar/)
- [Mercadolibre](https://www.mercadolibre.com.ar/)
- [Doctor Ink](https://www.doctorink.com.ar/)
- [Enanddes](https://enanddes.es/quienes-somos/)
