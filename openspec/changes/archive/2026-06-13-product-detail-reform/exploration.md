## Exploration: Reforma de la página de detalle de producto (Mundo 3D)

### Current State
El estado actual de la página de detalle de producto (`src/views/products/productDetail.ejs` y `public/css/components/product-detail.css`) presenta los siguientes problemas de diseño y estructura:
- **Falta de jerarquía en el título**: El título `.product-detail__title` es un `h2` plano que carece del color de resalte (`--title-highlight`).
- **Falta de jerarquía en el precio**: Se muestra como un párrafo plano `<p>Precio: $X</p>` sin fuente de encabezado ni color de acento. En las tarjetas se usa `.product-card__price` con tipografía `VT323`/`Press Start 2P` y color de acento.
- **Botones idénticos**: Los botones "COMPRAR" y "AGREGAR AL CARRITO" comparten la misma clase `.product-detail__action` y tienen el mismo estilo visual (sin jerarquía primaria/secundaria).
- **HTML inválido**: Existe un anidamiento inválido de `<button>` dentro de etiquetas `<a>` (`<a><button>...</button></a>`).
- **Imagen sin tratamiento pixel-art**: La imagen de producto no resalta visualmente, necesitando un borde y la propiedad `image-rendering: pixelated` bien aplicada.
- **Enlace de retorno ausente**: No hay un enlace para volver a la tienda/catálogo de productos (`/products`).
- **Consolidación de precio**: El estilo del precio en las tarjetas de producto está duplicado en `product-card.css` y debe extraerse a un archivo compartido `price.css`.

### Affected Areas
- `public/css/components/price.css` (Nuevo archivo) — Contendrá las clases `.price` y `.price--lg`.
- `public/css/components/product-card.css` — Se eliminará la clase `.product-card__price` para usar la clase compartida `.price`.
- `public/css/components/product-detail.css` — Rediseño del layout para centrar la tarjeta, estilo del título (`--title-highlight`), bordes pixelados de la imagen, modificadores de botones primario/secundario y estilo del enlace de regreso.
- `src/views/partials/head.ejs` — Vinculación del nuevo archivo `price.css` antes de `product-card.css`.
- `src/views/index.ejs` — Reemplazo de `.product-card__price` por `.price`.
- `src/views/products/products.ejs` — Reemplazo de `.product-card__price` por `.price`.
- `src/views/products/productDetail.ejs` — Modificación estructural de la vista para usar HTML válido (enlaces `<a>` con estilo de botón en lugar de anidación inválida), aplicar la nueva clase `.price.price--lg`, y agregar el enlace de retorno.

### Approaches
1. **Enfoque 1: Tarjeta Contenedora Unificada (Recomendado)**
   - **Descripción**: Diseñar `.product-detail__card` como una tarjeta Synthwave centrada en la pantalla, con un fondo oscuro (`var(--surface)`), borde y una sombra de resplandor. Los botones se transforman en etiquetas `<a>` directas con clases de botón, donde "COMPRAR" es el botón primario (relleno con el color de acento) y "AGREGAR AL CARRITO" es el secundario (estilo outline). El precio se muestra de forma directa con la clase `.price.price--lg`.
   - **Pros**:
     - Estructura limpia y alineada con BEM.
     - Corrige la validez del HTML de manera nativa.
     - Proporciona una clara jerarquía visual y foco en la acción principal.
   - **Cons**: Requiere reescribir y estructurar la mayor parte de las reglas en `product-detail.css`.
   - **Effort**: Medium

2. **Enfoque 2: Componentes Separados con Bordes Independientes**
   - **Descripción**: Mantener la imagen y la sección de información con bordes e imágenes de fondo independientes dentro del flujo, aplicando sombras de neón por separado en cada bloque.
   - **Pros**: Conserva un estilo más fragmentado si es el deseado por la dirección artística.
   - **Cons**: Puede verse sobrecargado en resoluciones de escritorio al tener múltiples bordes y fondos yuxtapuestos.
   - **Effort**: Medium

### Recommendation
Se recomienda el **Enfoque 1** para lograr un diseño limpio, profesional y consistente con la estética retro-arcade y Synthwave de Mundo 3D. Esto unifica la información del producto bajo un mismo contenedor y guía visualmente al usuario con botones jerarquizados de manera clara.

### Risks
- **Inconsistencia de rutas en Home**: Se detectó que el archivo `src/views/index.ejs` enlaza los productos a `/products/<%= product.IDProduct %>`, mientras que la ruta real del servidor es `/product/:id` (definida en `productsRoutes.js`). Esto provoca un error 404 al hacer clic en los productos destacados del home. Aunque está fuera del alcance de estilos, se recomienda corregir este enlace a `/product/<%= product.IDProduct %>` para evitar errores de navegación.
- **Rendimiento de imagen**: Asegurar que las imágenes de producto tengan tamaños y resoluciones adecuadas para evitar estiramientos no deseados al aplicar `image-rendering: pixelated`.

### Ready for Proposal
Yes — La exploración está lista. El orquestador puede continuar proponiendo los cambios y generar las especificaciones del diseño.
