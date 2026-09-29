MACROXEL · ECOSISTEMA WEB CENTRAL

ESTE REPOSITORIO ES LA FUENTE ÚNICA DEL ECOSISTEMA WEB.
No dupliques la aplicación completa en los repositorios de visores.

URL CENTRAL:
https://macroxelarista-tech.github.io/ESPEJO-PUNTO-DE-VENTA-CENTRAL/

ESTRUCTURA DEL CENTRAL
- / = Espejo Web / supervisión del propietario
- /reportes/ = Kardex, resumen financiero, trazabilidad y facturación
- /mi-farmacia/ = Mi Farmacia en línea
- /macroxel-config.json = configuración compartida generada por el sistema principal
- /macroxel-ecosistema.json = manifiesto de módulos y repositorios externos

REPOSITORIOS DE VISORES
1. ESPEJO-PUNTO-DE-VENTA
   Estado: YA CREADO. Debe enlazar al CENTRAL.
   Destino: https://macroxelarista-tech.github.io/ESPEJO-PUNTO-DE-VENTA-CENTRAL/

2. REPORTES-PUNTO-DE-VENTA
   Crear cuando quieras una URL independiente para Kardex/Financiero.
   Debe enlazar a:
   https://macroxelarista-tech.github.io/ESPEJO-PUNTO-DE-VENTA-CENTRAL/reportes/

3. MI-FARMACIA-PUNTO-DE-VENTA
   Crear cuando quieras una URL independiente para Mi Farmacia.
   Debe enlazar a:
   https://macroxelarista-tech.github.io/ESPEJO-PUNTO-DE-VENTA-CENTRAL/mi-farmacia/

REGLA DE ARQUITECTURA
- Firebase operativa y datos públicos se configuran una sola vez en el sistema principal.
- El sistema principal genera/publica la carpeta del CENTRAL.
- Los repositorios de visores NO guardan API Key, correo, contraseña ni licencias.
- Los repositorios de visores sólo enlazan/redirigen a la ruta correspondiente del CENTRAL.
- Una actualización del CENTRAL se refleja en todos los visores sin volver a copiar la aplicación completa.

Para un cliente nuevo:
1) Configura su Firebase operativa en Macroxel.
2) Crea su repositorio CENTRAL y publica /docs con GitHub Pages.
3) Crea únicamente los repositorios-visores que el cliente contrate.
4) Enlaza cada visor a la ruta correspondiente del CENTRAL.
