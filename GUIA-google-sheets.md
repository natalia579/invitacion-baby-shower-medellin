# Conectar la hoja de Medellín — paso a paso

Hoja: https://docs.google.com/spreadsheets/d/1QUnLG1b5pyfYwdI_cmQ66xAgPr2avBfcyFIqEFZ44W8/edit

Se hace una sola vez (unos 15 minutos). En iPad o celular usa Safari en **modo escritorio**
(“aA” → *Solicitar sitio web de escritorio*), porque el editor de programas no existe en la app de Sheets.

## 1 · Pegar el programa
1. Abre la hoja → **Extensiones → Apps Script**.
2. Borra todo lo que aparece y pega el contenido completo de `apps-script/Codigo.gs`.
3. Toca **Guardar** (ícono de disco). Nombre del proyecto: **Confirmaciones Medellín**.

## 2 · Crear las pestañas
1. Junto a **▷ Ejecutar**, elige la función **`configurar`** y toca **Ejecutar**.
2. Google pide permiso: **Revisar permisos** → tu cuenta → *Configuración avanzada* →
   **Ir a Confirmaciones Medellín (no seguro)** → **Permitir**. Es normal: el programa es tuyo.
3. En la hoja aparecen **Invitados**, **Configuración** y **Resumen**.

## 3 · Publicarlo
1. **Implementar → Nueva implementación** → engranaje ⚙️ → **Aplicación web**.
2. Ejecutar como: **Yo** · Quién tiene acceso: **Cualquier persona**.
3. **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
4. Envíasela a Claude. “Cualquier persona” solo permite *enviar* una respuesta con un
   identificador válido: la hoja sigue siendo privada.

## 4 · Prueba (antes de enviar enlaces)
1. En Apps Script ejecuta **`crearInvitadoDePrueba`**.
2. En **Invitados**, copia el enlace de la columna F de “Invitado de prueba”, ábrelo,
   confirma **Sí**, luego **Cambiar mi respuesta → No**.
3. Revisa que siga habiendo **una sola fila**, con “No”, fecha de respuesta y última actualización.
4. Borra la fila de prueba.

## Uso diario
- **Agregar invitados:** un nombre por fila en la **columna B**. El identificador (A) y el
  enlace personal (F) se crean solos. Si pegas una lista larga, ejecuta `generarCodigosFaltantes`.
- **Enviar:** copia el enlace de la columna F y pégalo en el WhatsApp de esa persona.
  Cada enlace es solo para ella.
- **No cambies** los identificadores de la columna A después de enviar los enlaces.
- **Ver quién viene:** pestaña **Resumen**.
