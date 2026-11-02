# ⚔️ KAIROS — High-Performance iOS Fitness & Precision Timing PWA

**KAIROS** ("El dominio del momento exacto") es una Progressive Web App (PWA) de alto rendimiento, diseñada con estética OLED Gothic Minimalist, arquitectura **Offline-First**, sincronización en la nube multi-usuario con **Supabase (PostgreSQL)**, motores de audio WebKit no excluyentes y motores de IA para la prescripción biomecánica y extracción de rutinas.

---

## 🏛️ Arquitectura de Producción y Persistencia de Datos

### 1. ¿Dónde se guardan los datos de los usuarios?
* **Base de Datos en la Nube (Supabase PostgreSQL):** Cada usuario registrado almacena sus credenciales, perfil antropométrico, rutina y sesiones en la tabla `kairos_users`.
* **Compresión TOAST y Compactación de Almacenamiento:**
  * Las sesiones de entrenamiento se limpian antes de persistirse (`compactSessionForStorage`): se eliminan registros redundantes (como descansos intra-entreno), se redondean decimales y se limitan campos de texto innecesarios.
  * PostgreSQL comprime automáticamente las columnas `JSONB` mediante el motor interno **TOAST (pglz/lz4)** con almacenamiento extendido (`SET STORAGE EXTENDED`), reduciendo la huella en disco hasta un **70%**.
  * Miles de usuarios activos consumirán apenas unos pocos megabytes en total.
* **Resiliencia Serverless (Zero-Crash Fallback):**
  * Si la conexión con Supabase presenta latencia o está configurándose, el servidor conmuta de forma transparente al almacenamiento en `/tmp` (en Vercel) o en `data/` local, evitando caídas (*500 Internal Server Error*).
  * El cliente web guarda una copia local sincronizada en `localStorage` / `IndexedDB`, lo que garantiza que si el usuario pierde señal en el gimnasio, **puede seguir entrenando y cronometrando sin interrupciones**. Al recuperar conexión, los datos se sincronizan con la nube.

### 2. Seguridad Criptográfica de Alto Nivel
* **Contraseñas:** Hasheadas mediante la función de derivación de claves **scrypt** con salt aleatorio de 32 caracteres por usuario (`crypto.scryptSync(password, salt, 64)`). No se almacenan contraseñas en texto plano bajo ninguna circunstancia.
* **Sesiones Seguras:** Tokens de sesión firmados criptográficamente con **HMAC-SHA256** y validados mediante comparación de tiempo constante (`crypto.timingSafeEqual`) para prevenir ataques de temporización (*timing attacks*).
* **Cookies de Sesión:** Cookies `HttpOnly`, `SameSite=Lax`, `Secure` (en producción HTTPS) con soporte dual para cabeceras `Authorization: Bearer <token>` para compatibilidad total con Safari PWA en iOS.

### 3. Motores de Inteligencia Artificial
* **Generador Científico de Rutinas:** Motor determinista basado en meta-análisis (Schoenfeld, Behm, Morton) que calcula volumen por grupo muscular, distribución de descansos y genera explicaciones biomecánicas.
* **Extractor de Rutinas (Imagen / PDF):**
  * Admite imágenes (capturas de pantalla) y PDFs de entrenadores.
  * Si se proporciona `GEMINI_API_KEY`, utiliza Google Gemini 2.5 Flash para un análisis multimodal ultrarrápido.
  * Si **no** hay API Key, se activa automáticamente el motor local neural OCR (Tesseract multilingüe) y el analizador de coordenadas Y de PDF (`unpdf`), asegurando que **el servicio jamás falle**.

---

## 🚀 Despliegue en Internet (Guía Paso a Paso)

### Paso 1: Configurar la Base de Datos en Supabase (Gratis)
1. Entra a [https://supabase.com](https://supabase.com) y crea una cuenta o inicia sesión.
2. Crea un nuevo proyecto (ej. `kairos-production`).
3. En el menú lateral izquierdo, ve a **SQL Editor**.
4. Abre el archivo [`supabase/schema.sql`](file:///c:/Users/isaia/OneDrive/Documentos/Proyecto%20Kairos/supabase/schema.sql) de este proyecto, copia todo su contenido y pégalo en el editor de Supabase.
5. Presiona **Run**. Verás la tabla `kairos_users`, índices y triggers creados de inmediato.
6. Ve a **Project Settings** -> **API** y copia:
   * **Project URL** (ej. `https://xyzcompany.supabase.co`)
   * **service_role secret** (o `anon public` key)

---

### Paso 2: Desplegar en Vercel (Recomendado)

#### Opción A: Despliegue Automático mediante GitHub (Más sencillo para actualizaciones)
1. Sube este repositorio a tu cuenta de GitHub:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/kairos.git
   git branch -M main
   git push -u origin main
   ```
2. Entra a [https://vercel.com](https://vercel.com) e inicia sesión con GitHub.
3. Haz clic en **Add New...** -> **Project** e importa el repositorio de KAIROS.
4. En la sección **Environment Variables**, agrega las variables (ver `.env.example`):
   * `SUPABASE_URL`: Tu URL de Supabase
   * `SUPABASE_SERVICE_ROLE_KEY`: Tu clave service_role de Supabase
   * `SESSION_SECRET`: Una cadena de texto secreta aleatoria de más de 32 caracteres
   * `GEMINI_API_KEY`: *(Opcional)* Tu API Key de Google Gemini
5. Haz clic en **Deploy**. En menos de 2 minutos tu aplicación estará en vivo con HTTPS gratuito (ej. `https://kairos-app.vercel.app`).

#### Opción B: Despliegue Directo por Terminal con Vercel CLI
```bash
npx vercel
```
Sigue las instrucciones en pantalla, vincula tu cuenta e ingresa las variables de entorno en el panel web de Vercel.

---

## 📱 Instalación en iPhone como App Nativa (PWA)

1. Abre el enlace de producción (ej. `https://kairos-app.vercel.app`) en **Safari** en tu iPhone.
2. Toca el botón **Compartir** (icono de cuadrado con flecha hacia arriba en la barra inferior).
3. Desplázate hacia abajo y selecciona **"Agregar a pantalla de inicio"** (*Add to Home Screen*).
4. Toca **"Agregar"**.
5. ¡Listo! KAIROS aparecerá en tu pantalla de inicio como una aplicación nativa completa, sin barras del navegador, con soporte háptico, pantalla completa OLED y mezcla de audio ambiental para Spotify y Apple Music.

---

## 🧪 Pruebas de Integridad Automatizadas

Puedes verificar la base de datos, el compactador y los algoritmos criptográficos en cualquier momento ejecutando:

```bash
npm run test:db
```
Resultado esperado:
```
--- [KAIROS PROD TEST SUITE] INICIANDO PRUEBAS DE INFRAESTRUCTURA Y SEGURIDAD ---
✅ 1. Registro seguro completado exitosamente.
✅ 2. Detección y bloqueo de usuarios duplicados verificado.
✅ 3. Rechazo de credenciales incorrectas verificado (Timing-safe).
✅ 4. Autenticación exitosa verificada (Scrypt KDF).
✅ 5. Tokens de sesión HMAC-SHA256 y resistencia a manipulación verificados.
✅ 6. Compactador de almacenamiento validado: 1115 B -> 865 B (-22% de huella en disco).
✅ 7. Actualización de perfil atómica y persistencia verificadas.
✅ 8. Motor de IA Científica verificado: Generó semana de 7 días y ciclo con evidencia citada.
--- TODOS LOS TESTS DE PRODUCCIÓN Y PERSISTENCIA PASARON CON ÉXITO (100%) ---
```
