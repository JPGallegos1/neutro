# Conectar neutro.solutions a Cloudflare

Guía para continuar la configuración de **https://neutro.solutions/**.

Estado registrado el **19 de octubre de 2026**.

## Estado actual

- Repositorio: [JPGallegos1/neutro](https://github.com/JPGallegos1/neutro), rama `main`.
- Worker desplegado: **`neutro-web`**.
- URL pública de ejemplo: **https://neutro-web.example.workers.dev**.
- Contenido actual: página estática de la web pública de Neutro.
- La página principal y sus estilos respondieron con HTTP 200; las rutas inexistentes, con HTTP 404.
- Configuración del despliegue: `apps/web/wrangler.jsonc`.
- Pendiente: añadir o verificar la zona del dominio en Cloudflare, actualizar la delegación DNS en el registrador y conectar el dominio al Worker.

Antes de la migración, el DNS del dominio lo administraba el registrador. Ese estado anterior no define la configuración del Worker: Cloudflare crea el registro y el certificado al conectar el Custom Domain.

## Resultado esperado

- `https://neutro.solutions/` muestra la página pública de Neutro.
- `https://www.neutro.solutions/` redirige a `https://neutro.solutions/`.
- Cloudflare administra DNS, alojamiento y certificados HTTPS.
- El registrador del dominio sigue administrando la compra y renovación.

## 1. Añadir el dominio a Cloudflare

1. Entrar en [Cloudflare](https://dash.cloudflare.com/) con la misma cuenta donde está desplegado `neutro-web`.
2. Buscar si `neutro.solutions` ya existe entre los dominios de esa cuenta. Si existe, revisar su estado y continuar con su configuración actual.
3. Si todavía no existe, seleccionar la opción para añadir un dominio e introducir **`neutro.solutions`**, sin `https://` ni rutas.
4. Seleccionar el plan **Free**.
5. Revisar los registros DNS detectados o importados. Si se utilizan correo u otros servicios, copiar también sus registros necesarios, como MX, TXT, SPF, DKIM y DMARC: el cambio de delegación DNS no los migra por sí solo.
6. Anotar los **dos servidores DNS que Cloudflare asigne a esta zona**.

Los servidores asignados se obtienen del panel de Cloudflare. No usar los de otro dominio ni sustituirlos por ejemplos genéricos.

Si el dominio tiene DNSSEC activo en el proveedor actual, seguir el procedimiento de migración de Cloudflare para retirar el DS anterior en el registrador antes del cambio. DNSSEC se puede volver a activar con los datos de Cloudflare una vez completada la migración.

## 2. Actualizar la delegación DNS en el registrador

1. Iniciar sesión en el panel del registrador del dominio.
2. Abrir la lista de dominios y buscar **`neutro.solutions`**.
3. Entrar a la gestión DNS o de delegación del dominio.
4. Activar la opción de DNS personalizado (o equivalente) y reemplazar los servidores actuales por los **dos asignados por Cloudflare** en el paso anterior.
5. Guardar los cambios.

Introducir únicamente los nombres de los servidores, sin `https://` ni direcciones IP. Este cambio corresponde a la delegación del dominio, no a crear registros NS dentro de la zona DNS avanzada del registrador.

## 3. Esperar a que Cloudflare active la zona

1. Volver al dominio en Cloudflare.
2. Solicitar una nueva comprobación de la delegación DNS si el panel muestra esa opción.
3. Esperar a que el estado pase a **Active**.

La propagación puede tardar hasta **24 horas**, y más en casos excepcionales. Puede completarse antes; el estado de Cloudflare y las consultas DNS permiten comprobar el avance.

En PowerShell:

```powershell
Resolve-DnsName -Name "neutro.solutions" -Type NS -DnsOnly
```

El resultado debe mostrar los servidores DNS asignados por Cloudflare.

## 4. Conectar el dominio al Worker

Con la zona activa:

1. En Cloudflare, abrir **Workers & Pages**.
2. Seleccionar **`neutro-web`**.
3. Abrir la pestaña **Domains** y buscar **Custom Domains and Routes**. Según la vista del panel, también puede aparecer en **Settings → Domains & Routes**.
4. Seleccionar **Add Domain → Custom Domain**.
5. Introducir **`neutro.solutions`** y asociarlo al despliegue de producción.
6. Confirmar la creación del dominio y esperar a que el certificado esté activo.

Cloudflare crea el registro DNS y emite el certificado HTTPS automáticamente. Para este despliegue se utiliza un **Custom Domain** del Worker; no hace falta introducir una dirección IP de origen ni crear manualmente un CNAME hacia `workers.dev`.

Si Cloudflare informa de un registro DNS existente incompatible, revisar el registro web importado para ese mismo hostname y reemplazarlo como parte de la conexión al Worker. Conservar los registros de los demás servicios.

## 5. Reflejar el dominio en la configuración del repositorio

Para que los siguientes despliegues mantengan el dominio como configuración del proyecto, añadir estos campos a `apps/web/wrangler.jsonc`, conservando su contenido existente:

```jsonc
{
  "workers_dev": true,
  "routes": [{ "pattern": "neutro.solutions", "custom_domain": true }],
}
```

`workers_dev: true` mantiene disponible la URL pública de `workers.dev` además del dominio personalizado.

Desde la raíz del repositorio, validar y desplegar:

```powershell
corepack.cmd pnpm deploy:check
corepack.cmd pnpm deploy
```

Si la sesión de Cloudflare ha caducado:

```powershell
corepack.cmd pnpm --filter @neutro/web exec wrangler login
```

Completar la autorización en el navegador y volver a ejecutar el despliegue. Guardar el cambio de configuración en Git y subirlo a `main` al terminar.

## 6. Redirigir www al dominio principal

El Custom Domain de `neutro.solutions` sólo cubre ese hostname. Para atender `www.neutro.solutions` y redirigirlo:

1. En **DNS → Records** de la zona, crear o ajustar un registro para `www` con el proxy de Cloudflare activado. Para un hostname dedicado únicamente a redirecciones, se puede usar **AAAA**, nombre **`www`**, valor **`100::`**, estado **Proxied**.
2. Abrir **Rules → Redirect Rules**.
3. Usar la plantilla **Redirect from WWW to root**, si está disponible.
4. Configurar la redirección de `www.neutro.solutions` a **`https://neutro.solutions`**, con código **301**, conservando la ruta y los parámetros de consulta.
5. Guardar y activar la regla.

`100::` es una dirección de marcador para este caso sin servidor de origen: el proxy de Cloudflare atiende la petición y aplica la redirección.

## 7. Verificar el resultado

Comprobar en el navegador:

| URL                                  | Resultado esperado                         |
| ------------------------------------ | ------------------------------------------ |
| `https://neutro.solutions/`          | HTTP 200 y página pública de Neutro        |
| `https://www.neutro.solutions/`      | HTTP 301 hacia `https://neutro.solutions/` |
| `https://neutro.solutions/no-existe` | HTTP 404 y página de error del proyecto    |

Para inspeccionar los encabezados desde PowerShell:

```powershell
curl.exe -I https://neutro.solutions/
curl.exe -I https://www.neutro.solutions/
curl.exe -I https://neutro.solutions/no-existe
```

Confirmar también que el navegador acepta el certificado HTTPS y que los estilos cargan correctamente. Cuando el dominio esté funcionando, actualizar el enlace **About / Website** del repositorio de GitHub a `https://neutro.solutions/`.

## Referencias oficiales

- [Cloudflare: configuración DNS completa](https://developers.cloudflare.com/dns/zone-setups/full-setup/)
- [Cloudflare: actualizar la delegación DNS](https://developers.cloudflare.com/dns/nameservers/update-nameservers/)
- [Cloudflare Workers: Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Cloudflare: redirigir www al dominio raíz](https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-www-to-root/)
