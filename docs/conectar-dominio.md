# Conectar neutro.solutions a Cloudflare

Guía para continuar la configuración de **https://neutro.solutions/**.

Estado registrado el **19 de octubre de 2026**.

## Estado actual

- Repositorio: [JPGallegos1/neutro](https://github.com/JPGallegos1/neutro), privado, rama `main`.
- Worker desplegado: **`neutro-web`**.
- URL pública funcionando: **https://neutro-web.jpgallegos20.workers.dev**.
- Contenido actual: página estática de la web pública de Neutro.
- La página principal y sus estilos respondieron con HTTP 200; las rutas inexistentes, con HTTP 404.
- Configuración del despliegue: `apps/web/wrangler.jsonc`.
- Pendiente: añadir o verificar la zona del dominio en Cloudflare, cambiar la delegación en Namecheap y conectar el dominio al Worker.

En la consulta DNS realizada, `neutro.solutions` utilizaba estos nameservers de Namecheap:

```text
dns1.registrar-servers.com
dns2.registrar-servers.com
```

El registro A del dominio resolvía a `192.64.119.232`. Es una referencia del estado anterior, no la dirección que debe configurarse para el Worker.

## Resultado esperado

- `https://neutro.solutions/` muestra la página pública de Neutro.
- `https://www.neutro.solutions/` redirige a `https://neutro.solutions/`.
- Cloudflare administra DNS, alojamiento y certificados HTTPS.
- Namecheap sigue siendo el registrador donde se administra la compra y renovación del dominio.

## 1. Añadir el dominio a Cloudflare

1. Entrar en [Cloudflare](https://dash.cloudflare.com/) con la misma cuenta donde está desplegado `neutro-web`.
2. Buscar si `neutro.solutions` ya existe entre los dominios de esa cuenta. Si existe, revisar su estado y continuar con su configuración actual.
3. Si todavía no existe, seleccionar la opción para añadir un dominio e introducir **`neutro.solutions`**, sin `https://` ni rutas.
4. Seleccionar el plan **Free**.
5. Revisar los registros DNS detectados o importados. Si se utilizan correo u otros servicios, copiar también sus registros necesarios, como MX, TXT, SPF, DKIM y DMARC: el cambio de nameservers no los migra por sí solo.
6. Anotar los **dos nameservers que Cloudflare asigne a esta zona**.

Los nameservers asignados se obtienen del panel de Cloudflare. No usar los de otro dominio ni sustituirlos por ejemplos genéricos.

Si el dominio tiene DNSSEC activo en el proveedor actual, seguir el procedimiento de migración de Cloudflare para retirar el DS anterior en el registrador antes del cambio. DNSSEC se puede volver a activar con los datos de Cloudflare una vez completada la migración.

## 2. Cambiar los nameservers en Namecheap

1. Iniciar sesión en [Namecheap](https://www.namecheap.com/myaccount/login.aspx).
2. Abrir **Domain List**.
3. Buscar **`neutro.solutions`** y pulsar **Manage**.
4. En **Nameservers**, seleccionar **Custom DNS**.
5. Reemplazar los nameservers actuales por los **dos asignados por Cloudflare** en el paso anterior.
6. Guardar con la marca de verificación del panel.

Introducir únicamente los nombres de los servidores, sin `https://` ni direcciones IP. Este cambio corresponde al apartado **Nameservers**, no a crear registros NS dentro de **Advanced DNS**.

## 3. Esperar a que Cloudflare active la zona

1. Volver al dominio en Cloudflare.
2. Solicitar una nueva comprobación de nameservers si el panel muestra esa opción.
3. Esperar a que el estado pase a **Active**.

Namecheap indica que la propagación puede tardar hasta **24 horas**, y más en casos excepcionales. Puede completarse antes; el estado de Cloudflare y las consultas DNS permiten comprobar el avance.

En PowerShell:

```powershell
Resolve-DnsName -Name "neutro.solutions" -Type NS -DnsOnly
```

El resultado debe mostrar los nameservers asignados por Cloudflare.

## 4. Conectar el dominio al Worker

Con la zona activa:

1. En Cloudflare, abrir **Workers & Pages**.
2. Seleccionar **`neutro-web`**.
3. Abrir la pestaña **Domains** y buscar **Custom Domains and Routes**. Según la vista del panel, también puede aparecer en **Settings → Domains & Routes**.
4. Seleccionar **Add Domain → Custom Domain**.
5. Introducir **`neutro.solutions`** y asociarlo al despliegue de producción.
6. Confirmar la creación del dominio y esperar a que el certificado esté activo.

Cloudflare crea el registro DNS y emite el certificado HTTPS automáticamente. Para este despliegue se utiliza un **Custom Domain** del Worker; no hace falta introducir la IP anterior ni crear manualmente un CNAME hacia `workers.dev`.

Si Cloudflare informa de un registro DNS existente incompatible, revisar el registro web importado para ese mismo hostname y reemplazarlo como parte de la conexión al Worker. Conservar los registros de los demás servicios.

## 5. Reflejar el dominio en la configuración del repositorio

Para que los siguientes despliegues mantengan el dominio como configuración del proyecto, añadir estos campos a `apps/web/wrangler.jsonc`, conservando su contenido existente:

```jsonc
{
  "workers_dev": true,
  "routes": [{ "pattern": "neutro.solutions", "custom_domain": true }],
}
```

`workers_dev: true` mantiene disponible la URL pública original además del dominio personalizado.

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

- [Namecheap: cambiar los nameservers de un dominio](https://www.namecheap.com/support/knowledgebase/article.aspx/767/10/how-to-change-dns-for-a-domain/)
- [Cloudflare: configuración DNS completa](https://developers.cloudflare.com/dns/zone-setups/full-setup/)
- [Cloudflare: actualizar nameservers](https://developers.cloudflare.com/dns/nameservers/update-nameservers/)
- [Cloudflare Workers: Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Cloudflare: redirigir www al dominio raíz](https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-www-to-root/)
