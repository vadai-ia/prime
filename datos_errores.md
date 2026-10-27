# Datos por corregir o completar · Prime HR

*26 oct 2026. Revisión del Excel "Lista de Rol y Vacante" antes de cargarlo al sistema.*

Lo que está aquí no se carga hasta que Prime lo confirme o lo corrija. Lo demás se carga tal cual viene.
**Grupo Huerta:** se cargan sus 3 razones sociales como 3 clientes; sus 11 vacantes esperan a saber de cuál es cada una (§2).

## 1. Clientes (hoja "LISTA DE CLIENTES")

### Correos que no sirven

Los reportes diarios y semanales del cliente salen a este correo; si está mal, no le llegan.

| Cliente | Viene así | Problema |
|---|---|---|
| Big Data | `gabriela.ey@bd-1` | Le falta el dominio (¿`@bd-1.com.mx`?). |
| Burguer Bar Joint | `facturaion@burguerbarjoint.com` | Parece "facturacion" con error, y es un correo de facturación. ¿Es a quien le deben llegar los reportes de reclutamiento? |
| Divol (Grupo Huerta) | `rh.@un-divolnorte.com.mx` | No es válido: punto antes de la "@". *(Para después, con Grupo Huerta.)* |

### Razón social y nombre comercial

| Cliente | Viene así | Duda |
|---|---|---|
| Burguer Bar Joint | Razón social "ESTILO ENRESTAURANTES ROMA" | ¿"ESTILO EN RESTAURANTES ROMA"? |
| Scorpion | Razón social "PRODUCTOS DE CONSUMO" | Parece giro, no razón social. ¿Cuál es la razón social? |
| MC2 Arquitectos | Razón social "INMOBILIARIA MURATO", nombre comercial "MURATORE" | ¿Murato o Muratore? |
| Todos | Ninguna trae el tipo de sociedad | ¿Va "S.A. de C.V.", "S.A.P.I. de C.V.", etc.? Si es para facturas o contratos, conviene completa. |

### Datos que faltan

| Cliente | Falta |
|---|---|
| Del Fruto | Todo: razón social, giro, domicilio, responsable, correo. En vacantes dice "Refresquera". |
| Telasist | Todo: razón social, giro, domicilio, responsable, correo. En vacantes dice "Telecomunicaciones". |
| Scorpion | Giro, domicilio y responsable. En vacantes dice "Autogística y transporte" (¿Logística?). |
| Orange, Gráficos La Central, MC2, Big Data, Prime HR | Nombre del responsable, puesto y teléfono. |
| Burguer Bar Joint | Apellido del responsable ("Oscar") y teléfono. |
| Big Data | El domicilio no trae municipio ni estado ("Ciudad Cuauhtémoc, sección Moctezuma, CP 55067": ¿Ecatepec, Estado de México?). |

### Otros

- **Gráficos La Central:** "AZACAPOTZALCO" → Azcapotzalco.
- **Prime HR** se da de alta como cliente para las vacantes internas (razón social Catch Your Talent), sin portal de cliente.

## 2. Vacantes (hoja "VACANTES ACTIVAS POR CLIENTES")

### Vacantes que no se cargaron (26 oct)

Las otras 22 vacantes de la hoja ya están en el sistema. Estas 12 esperan respuesta:

- **Grupo Huerta (11 vacantes):** se dio de alta como **tres clientes**, uno por razón social: "GRUPO HUERTA - SHIZUOKA MOTORS", "GRUPO HUERTA - ESMERALDA MOTORCYCLE" y "GRUPO HUERTA - DIVOL TRUCK & BUSES". Cada uno tiene su portal y su reporte; si una sola persona de RH lleva las tres, necesita un usuario por empresa (avísennos). En Divol, "SAPI DE CV" venía en el nombre comercial; lo pasamos a la razón social. Shizuoka y Divol no traen responsable ni correo válido (§1).

  **Necesitamos que nos digan de qué empresa es cada vacante** (llenar la última columna). La sugerencia sale de la zona, pero las de Lindavista y La Villa no coinciden con ningún domicilio:

  | # | Vacante | Zona | Reclutador | Sugerencia | ¿Empresa? |
  |---|---|---|---|---|---|
  | 1 | Gerente de marketing | La Villa, Tultitlán | Nancy | ¿Divol? (Tultitlán) | |
  | 2 | Gerente de marketing | Zona Esmeralda | Nancy y Diego | Esmeralda | |
  | 3 | Gerente de flotilla | Lindavista | Nancy | ? | |
  | 4 | Hostess ("HOSTEST") | Lindavista | Nancy | ? | |
  | 5 | Gerente de servicios | Zona Esmeralda | Nancy | Esmeralda | |
  | 6 | Hojalatero | Lindavista | Nancy | ? | |
  | 7 | Técnico master | Coacalco ("COCALCO") | Nancy | Shizuoka | |
  | 8 | Auxiliar contable | Coacalco | Nancy y Diego | Shizuoka | |
  | 9 | Asesor de venta | Lindavista | Gabriela, Denisse y Diego | ? | |
  | 10 | Back office | Lindavista | Gabriela | ? | |
  | 11 | Becario de sistemas ("CMR": ¿CRM?) | Lindavista | Gabriela | ? | |

  ¿Hay una sucursal en Lindavista? Si es de una de las tres empresas, díganos cuál.
- **CHELA CHUPAS** (Capitán de meseros, Nancy): no aparece en la lista de clientes. Faltan sus datos (razón social, giro, domicilio, contacto, correo).

### Número de vacantes

- Telasist (2 puestos) y Scorpion (4 puestos) dicen **"Por requisición del cliente"**. El sistema pide un número: ¿cuántas posiciones abiertas hay hoy en cada una? Mientras, se cargan con 1.

### Nombres de puesto

| Viene así | Se cargaría como |
|---|---|
| DISEÑADOR INDRUSTRIAL | Diseñador industrial |
| CNC (Orange) | ¿Operador de CNC? |
| HOSTEST (Grupo Huerta) | ¿Hostess? *(para después)* |
| BECARIO SISTEMAS CMR (Grupo Huerta) | ¿CRM? *(para después)* |
| TECNICOESPECIALISTA ELECTROMECANICO (Big Data) | Técnico especialista electromecánico |
| ARQUITECTOS (MC2) | ¿Arquitecto? ¿Cuántas posiciones? |
| AUXILIAR ADMIN DE VENTAS (Orange) | Auxiliar administrativo de ventas |

Zonas con error: "COCALCO" → Coacalco (Grupo Huerta).

### Unidad de negocio

En la hoja, "Unidad de negocio" trae el giro del cliente copiado. En el sistema la unidad de negocio es el área dentro de la empresa (por ejemplo "Ventas", "Operaciones", "Crédito y cobranza"). ¿Nos dan el área de cada vacante o la dejamos vacía?

## 3. Usuarios (hoja "USUARIOS DEL SISTEMA")

Los usuarios los da de alta VADAI por separado; esto es para que Prime corrija la lista.

- **Xavier Rebolledo:** en esta hoja el correo viene sin "@". En la hoja "Subdominio del sistema" viene bien. Usamos el que trae la "@".
- **Patricia Denisse Rodríguez:** sin correo (solo el dominio).
- **"Posible Ingreso 2":** se da de alta cuando entre.
- **Edwin** aparece como administrador en las hojas "Correo" y "Buzón", pero no está en la lista de usuarios. ¿Quién es y qué rol tiene? (También: "ULICES" → Ulises.)

### Las vacantes de cada reclutador no coinciden entre hojas

La hoja de usuarios lista vacantes por reclutador que **no existen** en la hoja de vacantes activas, y al revés. Ejemplos:

- En usuarios, pero no en vacantes activas: Gerente de Logística - Puebla, Gerente de Unidad, Nominista, Gerente de Canal a detalle - Monterrey, Ejecutivo de Ventas - GH, Comprador, Analista de IMSS Interno, Operador de Corte, Operador de Máquina, Cita de Servicios, Gerente de Refacciones, Contador Sr.
- En vacantes activas, pero en ningún reclutador de la hoja de usuarios: Administrador de compras, Gerente operativo y Recursos humanos (Burguer Bar), los 4 operadores de Scorpion, Jefe de preprensa (La Central), Capitán de meseros (Chela Chupas).

**¿Cuál hoja manda?** Proponemos que mande "Vacantes activas por clientes" (trae cliente, zona y reclutador), y que las vacantes de la hoja de usuarios que no estén ahí sean vacantes cerradas o por abrir.

### Reclutadores del cliente contra los de la vacante

Algunos no coinciden; en el sistema manda el de cada vacante:

- **Telasist:** el cliente dice Gabriela, Eduardo, Mauricio y Denisse; las vacantes agregan a **Diego**.
- **Orange:** el cliente dice Gabriela; las vacantes también tienen a **Nancy**.
- **Del Fruto:** el cliente dice Gabriela; Chofer de camioneta es de **Diego**.
- **Burguer Bar Joint:** el cliente dice Nancy y Eduardo; las 3 vacantes son solo de Eduardo.
- **Prime HR:** el cliente dice Eduardo y Denisse; Chofer mensajero es de **Gabriela**.
- **Big Data:** las vacantes agregan a **Denisse**.

## 4. Hojas sin contestar

Estas hojas solo traen el título o una imagen; falta la respuesta de Prime:

- **Horarios de entrevista:** vacía. Se necesita para agendar.
- **Consentimiento opt-in:** falta el texto que va en cada vacante y formulario.
- **Aviso de privacidad:** el enlace es una página de prueba en `chatgpt.site`. Piden ver un machote; el aviso definitivo y su URL en el dominio de Prime son de Prime (lo revisa su abogado).
- **Facebook, LinkedIn y Pandapé:** sin descripciones ni accesos.
- **Cuenta y créditos (Psicotest), cómo llegan los reportes, decisión Meet o Zoom** (ya se decidió Teams), **política de retención, entrega al cliente, inteligencia interna, dónde vive hoy la información, acceso y bajas, respaldos y continuidad, participantes de la capacitación:** sin respuesta.
- **Perfil del negocio:** falta la descripción.
