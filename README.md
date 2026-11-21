# Invitación Medellín — Nati y Santi

Gender Reveal & Baby Shower · domingo 6 de diciembre de 2026 · 4:00 p. m. · Urbanización Nature Aqua.

Proyecto **independiente** de la primera invitación (`nati-y-santi.github.io`): otro repositorio,
otra dirección (`https://natalia579.github.io/invitacion-baby-shower-medellin/`), otra hoja y otro programa de Apps Script.

| Archivo | Qué es |
|---|---|
| `index.src.html` | La invitación (texto, estilos, animación, confirmación) |
| `arte/arte.html` | Ilustraciones en acuarela (coche, ruedas, sobre, lacre, carta) |
| `apps-script/Codigo.gs` | Programa de la hoja de Medellín |
| `GUIA-google-sheets.md` | Cómo conectar la hoja, paso a paso |
| `index.html` | Página publicada (una sola pieza, generada con `tools/build.mjs`) |

```bash
node tools/render-arte.mjs                         # ilustraciones → arte/png/*.webp
RSVP_ENDPOINT=https://script.google.com/macros/s/…/exec node tools/build.mjs   # → index.html
node tools/simulador-sheets.mjs test               # prueba el programa de la hoja sin Google
```

Confirmación: cada invitado recibe `…/medellin/?i=IDENTIFICADOR`. Sin identificador válido no se
puede confirmar; el nombre lo pone la hoja; cambiar la respuesta actualiza la misma fila.
