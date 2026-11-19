# Usuarios

## Propósito

El administrador crea cuentas y activa o desactiva las que ya existen. Cada cuenta tiene un rango: administrador, recepcionista, pesador o consulta. El rango decide qué pantallas muestra el menú y qué rutas acepta el proxy. La descripción de la página lo resume: el administrador usa toda la aplicación, el recepcionista registra entradas, el pesador registra la salida para consumo y consulta solo visualiza.

## Quién lo usa

Solo el rango `administrador`. El menú muestra **Usuarios** únicamente a ese rango. El proxy no incluye `/usuarios` entre las rutas de consulta, recepción ni pesaje, así que los demás vuelven a `/`. La página además llama a `exigirAdmin`.

## Pasos

1. El administrador abre `/usuarios`.
2. **Nuevo usuario** pide nombre, usuario, clave y rango. `crearUsuarioFormulario` valida y crea la cuenta.
3. El usuario tiene que medir de 3 a 20 caracteres (`a-z`, números, `.`, `_` o `-`), se guarda en minúsculas y no puede repetirse. El nombre necesita al menos 2 caracteres y la clave al menos 4.
4. La lista se parte en cuatro grupos: administrador, recepcionista, pesador y consulta.
5. **Desactivar** o **Activar** llama a `alternarUsuario`. Nadie puede desactivarse a sí mismo. Si el usuario es el único administrador activo, no se desactiva.
6. Un usuario desactivado sigue en la tabla (`activo = 0`), pero `autenticar` y `sesionSigueActiva` lo rechazan. Una cookie que ya tenía deja de servir en la siguiente página del panel.

## Rutas y páginas

| Ruta | Qué hace |
| --- | --- |
| `/usuarios` | Alta y lista |
| `/usuarios?error=` | Muestra el error al activar o desactivar |

## Componentes

- `FormularioUsuario`: alta.
- `PageFrame`, `Card`, `CardHeader`, `CardTitle`, `CardContent`: marco de la página.
- El grupo de cada rango está en la propia página, no en un componente aparte.

## Server actions

En `src/app/usuarios-acciones.ts`:

- `crearUsuarioFormulario` exige administrador, valida, inserta y revalida `/usuarios`.
- `alternarUsuario` exige administrador y redirige a `/usuarios` o a `/usuarios?error=`.

La validación y el hash están en `validarCuenta`, `crearUsuario` y `alternarActivo` (`src/lib/usuarios.ts` y `src/lib/claves.ts`).

## Tablas y consultas

Tabla `usuarios`. RLS activado, sin políticas: la API pública de Supabase no entra. La app usa la conexión directa.

- `SELECT id, nombre, usuario, rango, activo FROM usuarios ORDER BY nombre`
- `SELECT id FROM usuarios WHERE lower(usuario) = lower(?)`
- `INSERT INTO usuarios (nombre, usuario, clave, rango) VALUES (?, ?, ?, ?) ON CONFLICT ((lower(usuario))) DO NOTHING`
- `SELECT * FROM usuarios WHERE id = ?`
- `SELECT COUNT(*) AS n FROM usuarios WHERE rango = 'administrador' AND activo = 1 AND id <> ?`
- `UPDATE usuarios SET activo = ? WHERE id = ?`

Hay un índice único `idx_usuarios_usuario` sobre `lower(usuario)`. El rango solo puede ser `administrador`, `consulta`, `recepcionista` o `pesador`.

La página no muestra ni edita la clave guardada.

## Variables de entorno

- `DATABASE_URL` o, en su defecto, `POSTGRES_URL`.
- `SESION_SECRETO`, porque la página exige sesión de administrador. El detalle de la cookie está en [autenticacion.md](autenticacion.md).

## Archivos relacionados

- [src/app/(panel)/usuarios/page.tsx](<../src/app/(panel)/usuarios/page.tsx>)
- [src/components/formulario-usuario.tsx](../src/components/formulario-usuario.tsx)
- [src/components/page-frame.tsx](../src/components/page-frame.tsx)
- [src/components/ui/card.tsx](../src/components/ui/card.tsx)
- [src/components/ui/button.tsx](../src/components/ui/button.tsx)
- [src/app/usuarios-acciones.ts](../src/app/usuarios-acciones.ts)
- [src/lib/usuarios.ts](../src/lib/usuarios.ts)
- [src/lib/claves.ts](../src/lib/claves.ts)
- [src/lib/acceso.ts](../src/lib/acceso.ts)
- [src/components/shell.tsx](../src/components/shell.tsx)
- [src/app/(panel)/layout.tsx](<../src/app/(panel)/layout.tsx>)
- [src/proxy.ts](../src/proxy.ts)
- [src/lib/db.ts](../src/lib/db.ts)
- [supabase/esquema.sql](../supabase/esquema.sql)
