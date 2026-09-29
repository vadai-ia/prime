import { useState, useMemo } from "react";
import {
  LayoutDashboard, Building2, ClipboardList, Users, CalendarClock, BarChart3,
  Globe, MessageCircle, FileText, ShieldCheck, Brain, Video, Mail, Check, X,
  AlertTriangle, ChevronRight, Plus, Sparkles, Phone, MapPin, Clock, Search,
  ArrowRight, ArrowLeft, Send, Paperclip, Filter, Briefcase, GraduationCap, Wallet, BadgeCheck, Cpu, Boxes, MessageSquare, Minus,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, Cell,
} from "recharts";

/* ─────────────────────────────────────────────────────────────
   PRIME HR INNOVATION · Demo de sistema de reclutamiento
   Preparado por VADAI · septiembre 2026
   Cliente demo: Telasist · Perfil base: Ejecutivo de Cobranza
   ───────────────────────────────────────────────────────────── */

const T = {
  forest: "#0E4632",
  forest2: "#145A41",
  leaf: "#1E8A57",
  leafSoft: "#DDF2E6",
  mint: "#EEF7F1",
  lime: "#8FD45D",
  ink: "#152019",
  slate: "#5D6D63",
  line: "#D8E4DC",
  paper: "#F5F8F6",
  white: "#FFFFFF",
  amber: "#B7791F",
  amberSoft: "#FBF1DC",
  red: "#B93A32",
  redSoft: "#FBE7E5",
  blue: "#2C5FA8",
  blueSoft: "#E4ECF8",
  wa: "#25D366",
  font: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
};

const PRIME_LOGO =
  "https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=768,fit=crop/A0xjLPrRpZUXKw9q/verdeyblanco-A1a5VvOx9xsJ25JA.png";

const HOY = "2026-09-10";

/* ───────────── etapas del pipeline ───────────── */
const STAGES = [
  { id: "nuevo", label: "Nuevo", short: "Nuevo" },
  { id: "prefiltro", label: "Prefiltro WhatsApp", short: "Prefiltro" },
  { id: "cv", label: "CV evaluado", short: "CV" },
  { id: "entrevista_prime", label: "Entrevista Prime", short: "Ent. Prime" },
  { id: "psico", label: "Psicométrico", short: "Psico" },
  { id: "expediente", label: "Expediente", short: "Expediente" },
  { id: "entrevista_cliente", label: "Entrevista cliente", short: "Ent. cliente" },
  { id: "contratado", label: "Contratado", short: "Contratado" },
];
const STAGE_IDX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));
const stageLabel = (id) => (id === "descartado" ? "Descartado" : STAGES.find((s) => s.id === id)?.label || id);

const DOCS = [
  { k: "ine", label: "INE (ambos lados)" },
  { k: "curp", label: "CURP" },
  { k: "rfc", label: "Constancia de situación fiscal (RFC)" },
  { k: "nss", label: "Número de seguro social (IMSS)" },
  { k: "domicilio", label: "Comprobante de domicilio" },
  { k: "acta", label: "Acta de nacimiento" },
  { k: "estudios", label: "Comprobante de estudios" },
  { k: "cv", label: "CV actualizado" },
  { k: "recomendacion", label: "Cartas de recomendación (2)" },
  { k: "confirmacion", label: "Hoja de confirmación del candidato" },
];

/* ───────────── clientes ───────────── */
const CLIENTS = [
  {
    id: "telasist",
    nombre: "Telasist",
    giro: "Servicios de asistencia empresarial y telemarketing",
    zona: "Guillermo González Camarena 1000, Santa Fe, CDMX",
    contacto: "Verónica Salinas",
    puesto: "Gerente de Atracción de Talento",
    email: "reclutamiento@telasist.com",
    tel: "55 1084 1084",
    desde: "2025-03",
    reporteSemanal: "Viernes 9:00",
    reporteDiario: "Diario 18:00",
  },
  {
    id: "orange",
    nombre: "Orange Printing Solutions",
    giro: "Servicios de impresión y soluciones gráficas",
    zona: "Sevilla 1021, Portales Sur, Benito Juárez, CDMX",
    contacto: "Mauricio Peña",
    puesto: "Coordinador de Diseño Industrial",
    email: "rh@orangeprinting.mx",
    tel: "55 5539 2210",
    desde: "2026-08",
    reporteSemanal: "Viernes 9:00",
    reporteDiario: "Diario 18:00",
  },
  {
    id: "fortaprest",
    nombre: "Fortaprest",
    giro: "Servicios financieros y préstamos",
    zona: "Colonia Roma Norte, CDMX",
    contacto: "Gabriel Ortega",
    puesto: "Gerente de Crédito y Cobranza",
    email: "talento@fortaprest.mx",
    tel: "55 4160 8830",
    desde: "2025-11",
    reporteSemanal: "Lunes 9:00",
    reporteDiario: "Diario 18:00",
  },
];

/* ───────────── perfiles de puesto ───────────── */
const PROFILES = [
  {
    id: "p1",
    clientId: "telasist",
    titulo: "Ejecutivo de Cobranza",
    estado: "Activa",
    vacantes: 4,
    fecha: "2026-08-24",
    elaboradoPor: "Nancy Morales, Gerente de Atracción de Talento",
    unidad: "Cobranza y recuperación",
    zona: "Colonia Roma Norte, CDMX (5 min del metro/metrobús Insurgentes)",
    objetivo:
      "Asegurar la recuperación oportuna de pagos de la cartera asignada, contribuyendo al flujo efectivo de la empresa.",
    especificaciones: { edad: "19 a 40 años", sexo: "Indistinto", estadoCivil: "Indistinto", hijos: "Indistinto", residencia: "CDMX y zona metropolitana" },
    requisitos: {
      escolaridad: "Secundaria o bachillerato concluido (profesional no necesario)",
      experiencia: "6 meses a 1 año en cobranza y atención al cliente",
      conocimientos: "Comunicación, orientación al cliente, toma de decisiones estratégicas, trabajo bajo presión",
      idiomas: "No requeridos",
      sistemas: "Office básico, marcador y CRM de cobranza (deseable)",
    },
    actividades: [
      "Gestionar la cobranza de la cartera de clientes asignada",
      "Contactar a clientes para recordatorios, negociación y acuerdos de pago",
      "Reportar avances y resultados de recuperación de cartera",
      "Conciliar pagos y aclarar diferencias con clientes",
      "Mantener comunicación directa para establecer acuerdos de pago",
      "Resolver dudas e inquietudes del cliente",
      "Ofrecer opciones flexibles de pago",
      "Dar seguimiento constante al pago",
      "Ofrecer información precisa de formas de pago",
    ],
    condiciones: {
      sueldo: "$9,510 bruto mensual + comisiones de $500 a $3,000 quincenales; bono de $1,900 netos garantizado 2 meses",
      prestaciones: "De ley: aguinaldo 15 días, 12 días de vacaciones, 25% prima vacacional, IMSS",
      horario: "Lunes a sábado de 8:00 a 17:00, descanso fijo en domingo",
      modalidad: "Presencial",
      viajar: "No aplica",
      personalACargo: "No aplica",
      herramientas: "Equipo de cómputo, diadema y línea telefónica",
    },
    relaciones: [{ con: "Team leader", para: "Alcanzar las metas establecidas" }],
    reportaA: "Gerencias",
    competenciasFuncionales: [
      { c: "Negociación", n: "Avanzado" },
      { c: "Ética y valores", n: "Esencial" },
      { c: "Análisis de información", n: "Experto" },
    ],
    competenciasLiderazgo: [
      { c: "Integridad y confianza", n: "Esencial" },
      { c: "Manejo de visión y propósito", n: "Experto" },
      { c: "Administración y medición del trabajo", n: "Esencial" },
      { c: "Seguimiento y gestión con equipos", n: "Esencial" },
      { c: "Autodesarrollo", n: "Esencial" },
    ],
    proceso: [
      "Publicación de la vacante (Pandape, Facebook, LinkedIn)",
      "Filtrado de CVs de acuerdo a la D.P.",
      "Candidatos citados para entrevista",
      "Solicitar documentos al candidato (RFC, INE, IMSS)",
      "Llenado de hoja de confirmación del candidato",
      "Entrevista con supervisor y gerente del área",
      "Retroalimentación y Vo.Bo. del área",
      "Firma de contrato",
    ],
    /* capa de IA */
    reglas: { edadMin: 19, edadMax: 40, trasladoMax: 60, expMin: 6, expectativaMax: 12500, horario: "lunes a sábado 8:00–17:00" },
    pesos: [
      { k: "experiencia", label: "Experiencia en cobranza", w: 25 },
      { k: "escolaridad", label: "Escolaridad", w: 10 },
      { k: "disponibilidad", label: "Edad, zona y disponibilidad", w: 20 },
      { k: "habilidades", label: "Habilidades y conocimientos", w: 20 },
      { k: "competencias", label: "Competencias del puesto", w: 25 },
    ],
    umbral: 70,
    preguntas: [
      "¿Qué edad tienes?",
      "¿En qué colonia o municipio vives y cuánto tardarías en llegar a Roma Norte?",
      "¿Cuánto tiempo has trabajado en cobranza y qué tipo de cartera manejabas?",
      "¿Tienes disponibilidad de lunes a sábado de 8:00 a 17:00?",
      "El sueldo es $9,510 brutos más comisiones. ¿Está dentro de lo que buscas?",
      "¿Cuál es tu último grado de estudios concluido?",
      "¿Cuentas con INE, RFC y número de seguro social a la mano?",
    ],
    psicoEsperado: [
      { k: "Tolerancia a la presión", min: 60 },
      { k: "Comunicación oral", min: 60 },
      { k: "Enfoque a resultados", min: 60 },
      { k: "Actitud de servicio", min: 60 },
      { k: "Toma de decisiones", min: 55 },
      { k: "Análisis de problemas", min: 55 },
    ],
  },
  {
    id: "p2",
    clientId: "telasist",
    titulo: "Ejecutivo de Atención a Clientes (Cabina de asistencia vial)",
    estado: "Activa",
    vacantes: 6,
    fecha: "2026-08-31",
    elaboradoPor: "Nancy Morales, Gerente de Atracción de Talento",
    unidad: "Cabina de asistencias 24/7",
    zona: "Santa Fe, CDMX",
    objetivo: "Atender y dar seguimiento a los eventos de asistencia vial de los usuarios asegurados, coordinando proveedores hasta el cierre del servicio.",
    especificaciones: { edad: "18 a 45 años", sexo: "Indistinto", estadoCivil: "Indistinto", hijos: "Indistinto", residencia: "Poniente de CDMX o zonas con acceso a Santa Fe" },
    requisitos: {
      escolaridad: "Bachillerato concluido",
      experiencia: "6 meses en call center, atención a clientes o asistencias",
      conocimientos: "Manejo de llamadas, empatía, seguimiento de protocolos, captura en sistema",
      idiomas: "Inglés básico deseable",
      sistemas: "CRM de asistencias, Office básico",
    },
    actividades: ["Recibir llamadas de usuarios y registrar el evento", "Asignar proveedor de grúa o auxilio vial", "Dar seguimiento hasta el cierre del servicio", "Registrar incidencias y quejas"],
    condiciones: {
      sueldo: "$9,800 bruto mensual + bono de puntualidad y calidad hasta $2,000",
      prestaciones: "De ley + vales de despensa $1,000",
      horario: "Turnos rotativos de 8 horas, 24/7, dos días de descanso",
      modalidad: "Presencial",
      viajar: "No aplica",
      personalACargo: "No aplica",
      herramientas: "Equipo de cómputo, diadema, sistema de asistencias",
    },
    relaciones: [{ con: "Supervisor de cabina", para: "Escalar eventos y cumplir niveles de servicio" }, { con: "Red de proveedores", para: "Asignar y dar seguimiento a servicios" }],
    reportaA: "Supervisor de cabina",
    competenciasFuncionales: [{ c: "Atención al cliente", n: "Avanzado" }, { c: "Manejo de crisis", n: "Avanzado" }, { c: "Captura y seguimiento", n: "Esencial" }],
    competenciasLiderazgo: [{ c: "Integridad y confianza", n: "Esencial" }, { c: "Autodesarrollo", n: "Esencial" }],
    proceso: ["Publicación de la vacante", "Filtrado de CVs", "Entrevista Prime", "Psicométrico", "Expediente", "Entrevista con supervisor de cabina", "Firma de contrato"],
    reglas: { edadMin: 18, edadMax: 45, trasladoMax: 75, expMin: 6, expectativaMax: 12000, horario: "turnos rotativos 24/7" },
    pesos: [
      { k: "experiencia", label: "Experiencia en call center o asistencias", w: 25 },
      { k: "escolaridad", label: "Escolaridad", w: 10 },
      { k: "disponibilidad", label: "Edad, zona y turnos", w: 25 },
      { k: "habilidades", label: "Habilidades y conocimientos", w: 20 },
      { k: "competencias", label: "Competencias del puesto", w: 20 },
    ],
    umbral: 70,
    preguntas: ["¿Qué edad tienes?", "¿Dónde vives y cuánto tardas en llegar a Santa Fe?", "¿Has trabajado en call center o asistencias? ¿Cuánto tiempo?", "¿Puedes cubrir turnos rotativos, incluidos nocturnos y fines de semana?", "El sueldo es $9,800 brutos más bonos. ¿Te funciona?", "¿Cuál es tu último grado de estudios?", "¿Tienes INE, RFC y NSS?"],
    psicoEsperado: [
      { k: "Tolerancia a la presión", min: 65 },
      { k: "Actitud de servicio", min: 65 },
      { k: "Comunicación oral", min: 60 },
      { k: "Inteligencia emocional", min: 60 },
      { k: "Seguimiento y control", min: 55 },
    ],
  },
  {
    id: "p3",
    clientId: "telasist",
    titulo: "Ejecutivo de Telemarketing",
    estado: "Activa",
    vacantes: 3,
    fecha: "2026-09-02",
    elaboradoPor: "Nancy Morales, Gerente de Atracción de Talento",
    unidad: "Telemarketing",
    zona: "Santa Fe, CDMX",
    objetivo: "Colocar productos de asistencia por vía telefónica a bases de clientes de socios comerciales, cumpliendo metas de conversión y calidad.",
    especificaciones: { edad: "20 a 45 años", sexo: "Indistinto", estadoCivil: "Indistinto", hijos: "Indistinto", residencia: "CDMX y zona metropolitana" },
    requisitos: { escolaridad: "Bachillerato concluido", experiencia: "1 año en ventas telefónicas", conocimientos: "Cierre de ventas, manejo de objeciones, guiones", idiomas: "No requeridos", sistemas: "Marcador predictivo, CRM" },
    actividades: ["Realizar llamadas de venta a bases asignadas", "Cerrar ventas y registrar en CRM", "Cumplir metas diarias de conversión", "Mantener calidad en llamada"],
    condiciones: { sueldo: "$9,200 bruto mensual + comisiones sin tope (promedio $4,000)", prestaciones: "De ley", horario: "Lunes a viernes 9:00 a 18:00, sábados 9:00 a 14:00", modalidad: "Presencial", viajar: "No aplica", personalACargo: "No aplica", herramientas: "Equipo de cómputo, diadema, marcador" },
    relaciones: [{ con: "Supervisor de ventas", para: "Cumplir metas y recibir retroalimentación" }],
    reportaA: "Supervisor de ventas",
    competenciasFuncionales: [{ c: "Cierre de ventas", n: "Avanzado" }, { c: "Manejo de objeciones", n: "Avanzado" }, { c: "Ética y valores", n: "Esencial" }],
    competenciasLiderazgo: [{ c: "Integridad y confianza", n: "Esencial" }],
    proceso: ["Publicación de la vacante", "Filtrado de CVs", "Entrevista Prime", "Psicométrico", "Expediente", "Entrevista con supervisor de ventas", "Firma de contrato"],
    reglas: { edadMin: 20, edadMax: 45, trasladoMax: 70, expMin: 12, expectativaMax: 13500, horario: "lunes a viernes 9:00–18:00 y sábados 9:00–14:00" },
    pesos: [
      { k: "experiencia", label: "Experiencia en ventas telefónicas", w: 30 },
      { k: "escolaridad", label: "Escolaridad", w: 10 },
      { k: "disponibilidad", label: "Edad, zona y disponibilidad", w: 15 },
      { k: "habilidades", label: "Habilidades y conocimientos", w: 20 },
      { k: "competencias", label: "Competencias del puesto", w: 25 },
    ],
    umbral: 72,
    preguntas: ["¿Qué edad tienes?", "¿Dónde vives y cuánto tardas en llegar a Santa Fe?", "¿Cuánto tiempo llevas en ventas por teléfono y qué productos vendías?", "¿Tienes disponibilidad de lunes a sábado?", "El sueldo base es $9,200 más comisiones sin tope. ¿Te interesa?", "¿Cuál es tu último grado de estudios?", "¿Tienes INE, RFC y NSS?"],
    psicoEsperado: [
      { k: "Enfoque a resultados", min: 65 },
      { k: "Comunicación oral", min: 65 },
      { k: "Tolerancia a la presión", min: 60 },
      { k: "Toma de decisiones", min: 55 },
    ],
  },
  {
    id: "p4",
    clientId: "orange",
    titulo: "Diseñador Industrial",
    estado: "Levantamiento",
    vacantes: 1,
    fecha: "2026-09-09",
    elaboradoPor: "Nancy Morales, Gerente de Atracción de Talento",
    unidad: "Diseño Industrial",
    zona: "Sevilla 1021, Portales Sur, Benito Juárez, CDMX",
    objetivo: "Desarrollar los proyectos de diseño solicitados por el cliente, brindando soluciones a los procesos de fabricación del producto.",
    especificaciones: { edad: "25 a 40 años", sexo: "Indistinto", estadoCivil: "Indistinto", hijos: "Indistinto", residencia: "" },
    requisitos: { escolaridad: "Licenciatura en Diseño Industrial", experiencia: "2 a 3 años en puesto similar", conocimientos: "AutoCAD, SolidWorks, KeyShot, Illustrator, Photoshop, Inventor; planos de producción, renders, modelado 3D, prototipos, exhibidores, stands, POP", idiomas: "", sistemas: "" },
    actividades: ["Recepción de la orden de trabajo del Coordinador de Diseño Industrial vía correo", "Desarrollar la propuesta según solicitud del cliente (render o armado)", "Enviar información al área de ventas o al coordinador", "Realizar ajustes de ser necesario", "Desarrollar planos de producción una vez aprobado por el cliente", "Enviar piezas de corte a diseño gráfico", "Enviar planos de producción a proveedores de estructuras metálicas, acrílico o cartón", "Supervisar con producción ajustes a las piezas enviadas"],
    condiciones: { sueldo: "", prestaciones: "Ley y superiores", horario: "", modalidad: "", viajar: "", personalACargo: "No aplica", herramientas: "" },
    relaciones: [],
    reportaA: "Coordinador de Diseño Industrial",
    competenciasFuncionales: [],
    competenciasLiderazgo: [],
    competenciasLaborales: ["Trabajo en equipo", "Responsabilidad", "Productividad", "Orientación al cliente", "Orientación a resultados", "Organización y orden", "Pensamiento crítico", "Vocación de servicio", "Planificación", "Análisis y solución de problemas", "Toma de decisiones", "Honestidad/Integridad"],
    proceso: [],
    reglas: { edadMin: 25, edadMax: 40, trasladoMax: 75, expMin: 24, expectativaMax: 0, horario: "por definir" },
    pesos: [],
    umbral: 70,
    preguntas: [],
    psicoEsperado: [],
  },
  {
    id: "p5",
    clientId: "fortaprest",
    titulo: "Analista de Crédito",
    estado: "Pausada",
    vacantes: 2,
    fecha: "2026-07-15",
    elaboradoPor: "Nancy Morales, Gerente de Atracción de Talento",
    unidad: "Crédito",
    zona: "Colonia Roma Norte, CDMX",
    objetivo: "Evaluar solicitudes de crédito conforme a la política de riesgo de la empresa.",
    especificaciones: { edad: "23 a 40 años", sexo: "Indistinto", estadoCivil: "Indistinto", hijos: "Indistinto", residencia: "CDMX" },
    requisitos: { escolaridad: "Licenciatura en Economía, Finanzas o afín", experiencia: "1 año en análisis de crédito", conocimientos: "Buró de crédito, Excel avanzado", idiomas: "", sistemas: "Excel, core bancario" },
    actividades: ["Analizar solicitudes", "Emitir dictamen", "Dar seguimiento a cartera"],
    condiciones: { sueldo: "$16,000 bruto mensual", prestaciones: "De ley", horario: "Lunes a viernes 9:00 a 18:00", modalidad: "Híbrido", viajar: "No aplica", personalACargo: "No aplica", herramientas: "Laptop" },
    relaciones: [],
    reportaA: "Gerente de crédito",
    competenciasFuncionales: [{ c: "Análisis de información", n: "Experto" }],
    competenciasLiderazgo: [],
    proceso: [],
    reglas: { edadMin: 23, edadMax: 40, trasladoMax: 75, expMin: 12, expectativaMax: 18000, horario: "lunes a viernes" },
    pesos: [],
    umbral: 70,
    preguntas: [],
    psicoEsperado: [],
  },
];

/* ───────────── candidatos ───────────── */
/* cv: puntuación 0–100 por criterio. Se pondera con los pesos del perfil. */
const C = (o) => ({ docs: {}, notas: "", ...o });

const CANDIDATES = [
  /* ── Ejecutivo de Cobranza (p1) ── */
  C({ id: 1, nombre: "Mariana Cortés Vega", edad: 31, zona: "Iztapalapa", traslado: 45, canal: "Pandape", fecha: "2026-09-01", perfilId: "p1", etapa: "expediente", expMeses: 14, escolaridad: "Bachillerato", expectativa: 11000, disponible: true, cv: { experiencia: 82, escolaridad: 100, disponibilidad: 75, habilidades: 78, competencias: 70 },
    docs: { ine: "ok", curp: "ok", rfc: "ok", nss: "ok", domicilio: "ok", acta: "rev", estudios: "ok", cv: "ok", recomendacion: "pend", confirmacion: "pend" },
    resumenCV: "14 meses como Ejecutiva de Cobranza en Coppel (cartera vencida 30–90 días). Antes, 2 años en atención a clientes en Elektra. Bachillerato concluido. Maneja marcador y captura en CRM.",
    psico: {
      fecha: "2026-09-09", proveedor: "Psicotest", ci: 95, ciNivel: "Regular",
      coleibor: [["Detección de talento", 72], ["Actitud de servicio", 66], ["Inteligencia emocional", 65], ["Seguimiento y control", 64], ["Toma de decisiones", 62], ["Análisis de problemas", 61], ["Comunicación oral", 60], ["Tolerancia a la presión", 59], ["Trabajo en equipo", 57], ["Juicio", 56], ["Enfoque a resultados", 54]],
      cibainAltas: ["Gusto por dirigir personal (89%)", "Deseo de sobresalir (78%)", "Metódico (78%)"],
      cibainBajas: ["Seguridad para decidir (11%)", "Dinámico (11%)", "Aceptación del grupo (22%)"],
      inceval: { confianza: "Regular", honestidad: "Regular", etica: "Regular" },
      cacter: "Bajo presión tiende a la constancia: prefiere rutinas estables y le cuesta iniciar cambios. Se motiva con pasos metódicos y reconocimiento por cumplir lineamientos.",
      ciesmanBajos: ["Planeación (muy bajo)", "Concentración (bajo)", "Atención numérica (insuficiente)"],
    },
    entrevista: {
      fecha: "2026-09-08 12:00", plataforma: "Google Meet", duracion: "32 min", fireflies: "FF-260908-018", estado: "Analizada", entrevistador: "Andrea Lugo (Prime)", score: 76,
      resumen: "Candidata con experiencia real en cartera vencida y buen manejo de objeciones. Confirma disponibilidad de sábados y traslado de 45 min. Expectativa alineada. Muestra dudas al describir cómo prioriza cuentas cuando la cartera es grande.",
      hallazgos: [
        { k: "Experiencia en cobranza", ok: true, txt: "14 meses en cartera vencida 30–90 días; describe el proceso de negociación con ejemplos concretos." },
        { k: "Manejo de objeciones", ok: true, txt: "Ejemplo claro de cliente que negaba adeudo; cerró convenio a 3 pagos." },
        { k: "Disponibilidad L–S 8:00–17:00", ok: true, txt: "Confirma sin condiciones." },
        { k: "Expectativa salarial", ok: true, txt: "$11,000 con comisiones; acepta base de $9,510." },
        { k: "Priorización de cartera", ok: false, txt: "Respuesta vaga; conviene validar con el supervisor en entrevista cliente." },
      ],
      transcript: [
        ["00:04", "Andrea", "Cuéntame de tu último trabajo en cobranza, ¿qué tipo de cartera manejabas?"],
        ["00:11", "Mariana", "Estuve catorce meses en Coppel, en cartera vencida de treinta a noventa días. Hacía llamadas de recordatorio, negociaba convenios y daba seguimiento a los pagos."],
        ["03:20", "Andrea", "¿Qué haces cuando un cliente te dice que ya pagó y no aparece el pago?"],
        ["03:27", "Mariana", "Primero le pido el comprobante o la fecha y la sucursal. Si lo tiene, levanto la aclaración; si no, le explico con calma cómo se ve el estado de cuenta y le ofrezco opciones para regularizarse."],
        ["18:40", "Andrea", "El horario es de lunes a sábado de ocho a cinco, ¿te funciona?"],
        ["18:44", "Mariana", "Sí, sin problema, en Coppel también trabajaba sábados."],
      ],
    },
    notas: "Resultado psicométrico con reservas: baja seguridad para decidir y bajo dinamismo. Recomendación IA: avanzar a entrevista cliente con pregunta dirigida sobre priorización de cartera.",
  }),
  C({ id: 2, nombre: "Luis Ángel Ramírez Soto", edad: 27, zona: "Nezahualcóyotl", traslado: 55, canal: "Pandape", fecha: "2026-08-28", perfilId: "p1", etapa: "entrevista_cliente", expMeses: 24, escolaridad: "Bachillerato", expectativa: 10500, disponible: true, cv: { experiencia: 90, escolaridad: 100, disponibilidad: 80, habilidades: 84, competencias: 82 },
    docs: { ine: "ok", curp: "ok", rfc: "ok", nss: "ok", domicilio: "ok", acta: "ok", estudios: "ok", cv: "ok", recomendacion: "ok", confirmacion: "ok" },
    resumenCV: "2 años en cobranza telefónica en BBVA (cartera temprana) y 1 año en Liverpool. Bachillerato. Certificado interno en negociación.",
    psico: { fecha: "2026-09-04", proveedor: "Psicotest", ci: 104, ciNivel: "Suficiente", coleibor: [["Tolerancia a la presión", 74], ["Comunicación oral", 71], ["Enfoque a resultados", 70], ["Actitud de servicio", 68], ["Toma de decisiones", 66], ["Análisis de problemas", 63], ["Seguimiento y control", 62], ["Inteligencia emocional", 61], ["Trabajo en equipo", 60], ["Juicio", 58], ["Detección de talento", 48]], cibainAltas: ["Dinámico (78%)", "Enfoque a resultados (75%)"], cibainBajas: ["Minucioso (33%)"], inceval: { confianza: "Suficiente", honestidad: "Suficiente", etica: "Regular" }, cacter: "Bajo presión mantiene ritmo y decisión; tiende a la impaciencia con procesos lentos.", ciesmanBajos: ["Organización (insuficiente)"] },
    entrevista: { fecha: "2026-09-03 10:00", plataforma: "Google Meet", duracion: "28 min", fireflies: "FF-260903-011", estado: "Analizada", entrevistador: "Andrea Lugo (Prime)", score: 88, resumen: "Perfil sólido: experiencia amplia, comunicación clara, metas cuantificadas. Único punto a validar: orden en el registro de gestiones.", hallazgos: [{ k: "Experiencia en cobranza", ok: true, txt: "36 meses acumulados, cartera temprana y vencida." }, { k: "Manejo de objeciones", ok: true, txt: "Tres ejemplos con cifras de recuperación." }, { k: "Disponibilidad L–S", ok: true, txt: "Confirmada." }, { k: "Expectativa salarial", ok: true, txt: "$10,500, alineada." }, { k: "Registro de gestiones", ok: false, txt: "Reconoce que descuida la captura en CRM cuando hay volumen." }], transcript: [["00:05", "Andrea", "Platícame de tus resultados en BBVA."], ["00:10", "Luis Ángel", "Recuperaba en promedio el ochenta y dos por ciento de mi cartera mensual, estaba entre los tres primeros del equipo."]] },
    notas: "Entrevista con cliente programada 11 sep 13:00 con Supervisor de cobranza de Telasist.",
  }),
  C({ id: 3, nombre: "Diana Laura Hernández Pineda", edad: 24, zona: "Benito Juárez", traslado: 20, canal: "Facebook", fecha: "2026-09-03", perfilId: "p1", etapa: "psico", expMeses: 8, escolaridad: "Carrera técnica", expectativa: 9500, disponible: true, cv: { experiencia: 68, escolaridad: 100, disponibilidad: 92, habilidades: 72, competencias: 70 }, docs: { cv: "ok" }, resumenCV: "8 meses en cobranza en Financiera Independencia. Técnica en administración.", entrevista: { fecha: "2026-09-08 16:00", plataforma: "Google Meet", duracion: "24 min", fireflies: "FF-260908-021", estado: "Analizada", entrevistador: "Andrea Lugo (Prime)", score: 72, resumen: "Buena actitud y cercanía al centro de trabajo. Experiencia corta pero relevante.", hallazgos: [{ k: "Experiencia en cobranza", ok: true, txt: "8 meses, cartera temprana." }, { k: "Disponibilidad L–S", ok: true, txt: "Confirmada." }, { k: "Expectativa salarial", ok: true, txt: "$9,500." }], transcript: [] }, notas: "Psicométrico enviado por WhatsApp el 9 sep; pendiente de completar." }),
  C({ id: 4, nombre: "Jorge Alberto Mendoza Ruiz", edad: 38, zona: "Ecatepec", traslado: 70, canal: "Pandape", fecha: "2026-09-04", perfilId: "p1", etapa: "entrevista_prime", expMeses: 36, escolaridad: "Secundaria", expectativa: 12000, disponible: true, cv: { experiencia: 92, escolaridad: 90, disponibilidad: 55, habilidades: 80, competencias: 78 }, docs: {}, resumenCV: "3 años en cobranza domiciliaria y telefónica en Elektra. Secundaria concluida.", notas: "Traslado de 70 min supera el máximo de 60; el agente lo marcó como alerta y el reclutador decidió citarlo por su experiencia." }),
  C({ id: 5, nombre: "Karen Itzel Flores Díaz", edad: 22, zona: "Coyoacán", traslado: 30, canal: "LinkedIn", fecha: "2026-09-08", perfilId: "p1", etapa: "cv", expMeses: 6, escolaridad: "Licenciatura trunca", expectativa: 10000, disponible: true, cv: { experiencia: 60, escolaridad: 100, disponibilidad: 90, habilidades: 74, competencias: 72 }, docs: {}, resumenCV: "6 meses en cobranza en Kueski. Estudiante de administración (trunca)." }),
  C({ id: 6, nombre: "Ricardo Torres Almanza", edad: 45, zona: "Tlalpan", traslado: 50, canal: "Facebook", fecha: "2026-09-02", perfilId: "p1", etapa: "descartado", expMeses: 60, escolaridad: "Bachillerato", expectativa: 13000, disponible: false, cv: { experiencia: 95, escolaridad: 100, disponibilidad: 20, habilidades: 80, competencias: 75 }, docs: {}, motivo: "Fuera de rango de edad (45) y sin disponibilidad de sábados", resumenCV: "5 años en cobranza en Santander." }),
  C({ id: 7, nombre: "Sofía Navarro Ledesma", edad: 29, zona: "Cuauhtémoc", traslado: 15, canal: "Bolsa Prime", fecha: "2026-09-08", perfilId: "p1", etapa: "cv", expMeses: 10, escolaridad: "Bachillerato", expectativa: 9800, disponible: true, cv: { experiencia: 76, escolaridad: 100, disponibilidad: 95, habilidades: 78, competencias: 74 }, docs: {}, resumenCV: "10 meses en cobranza en Crédito Familiar. Vive a 15 min del centro de trabajo." }),
  C({ id: 8, nombre: "Miguel Ángel Cruz Bautista", edad: 33, zona: "Iztacalco", traslado: 35, canal: "Pandape", fecha: "2026-09-05", perfilId: "p1", etapa: "descartado", expMeses: 0, escolaridad: "Bachillerato", expectativa: 9500, disponible: true, cv: { experiencia: 15, escolaridad: 100, disponibilidad: 85, habilidades: 60, competencias: 55 }, docs: {}, motivo: "Sin experiencia en cobranza (perfil de ventas de piso)", resumenCV: "4 años en ventas de piso en Coppel." }),
  C({ id: 9, nombre: "Alejandra Paredes Morán", edad: 26, zona: "Gustavo A. Madero", traslado: 40, canal: "Pandape", fecha: "2026-09-09", perfilId: "p1", etapa: "prefiltro", expMeses: 12, escolaridad: "Bachillerato", expectativa: 10500, disponible: true, cv: { experiencia: 78, escolaridad: 100, disponibilidad: 85, habilidades: 70, competencias: 70 }, docs: {}, resumenCV: "1 año en cobranza en Elektra.", notas: "Conversación con el agente en curso (5 de 7 preguntas)." }),
  C({ id: 10, nombre: "Fernando Ochoa Villalobos", edad: 35, zona: "Naucalpan", traslado: 65, canal: "LinkedIn", fecha: "2026-09-09", perfilId: "p1", etapa: "prefiltro", expMeses: 48, escolaridad: "Licenciatura", expectativa: 14500, disponible: true, cv: { experiencia: 94, escolaridad: 100, disponibilidad: 55, habilidades: 88, competencias: 84 }, docs: {}, resumenCV: "4 años como supervisor de cobranza en Banco Azteca.", notas: "Expectativa de $14,500 supera el máximo; el agente le explicó el esquema de comisiones y espera respuesta." }),
  C({ id: 11, nombre: "Paola Jiménez Castañeda", edad: 21, zona: "Iztapalapa", traslado: 50, canal: "Facebook", fecha: "2026-09-10", perfilId: "p1", etapa: "nuevo", expMeses: 7, escolaridad: "Secundaria", expectativa: 9510, disponible: true, cv: { experiencia: 62, escolaridad: 90, disponibilidad: 80, habilidades: 65, competencias: 66 }, docs: {}, resumenCV: "7 meses en cobranza en Financiera Independencia." }),
  C({ id: 12, nombre: "Andrés Salgado Prieto", edad: 30, zona: "Azcapotzalco", traslado: 40, canal: "Pandape", fecha: "2026-09-10", perfilId: "p1", etapa: "nuevo", expMeses: 18, escolaridad: "Bachillerato", expectativa: 11000, disponible: true, cv: { experiencia: 84, escolaridad: 100, disponibilidad: 85, habilidades: 76, competencias: 74 }, docs: {}, resumenCV: "18 meses en cobranza en Coppel." }),
  C({ id: 13, nombre: "Guadalupe Rosales Ibarra", edad: 41, zona: "Chalco", traslado: 90, canal: "Pandape", fecha: "2026-09-06", perfilId: "p1", etapa: "descartado", expMeses: 20, escolaridad: "Secundaria", expectativa: 9500, disponible: true, cv: { experiencia: 80, escolaridad: 90, disponibilidad: 10, habilidades: 70, competencias: 68 }, docs: {}, motivo: "Fuera de rango de edad (41) y traslado de 90 min", resumenCV: "20 meses en cobranza domiciliaria." }),
  C({ id: 14, nombre: "Emilio Vargas Cantú", edad: 25, zona: "Venustiano Carranza", traslado: 25, canal: "Bolsa Prime", fecha: "2026-08-20", perfilId: "p1", etapa: "contratado", expMeses: 9, escolaridad: "Bachillerato", expectativa: 10000, disponible: true, contratadoEl: "2026-09-04", cv: { experiencia: 74, escolaridad: 100, disponibilidad: 92, habilidades: 80, competencias: 78 }, docs: Object.fromEntries(DOCS.map((d) => [d.k, "ok"])), resumenCV: "9 meses en cobranza en Kueski." }),
  C({ id: 15, nombre: "Valeria Estrada Núñez", edad: 28, zona: "Miguel Hidalgo", traslado: 30, canal: "LinkedIn", fecha: "2026-08-18", perfilId: "p1", etapa: "contratado", expMeses: 16, escolaridad: "Licenciatura", expectativa: 11500, disponible: true, contratadoEl: "2026-09-02", cv: { experiencia: 86, escolaridad: 100, disponibilidad: 90, habilidades: 84, competencias: 82 }, docs: Object.fromEntries(DOCS.map((d) => [d.k, "ok"])), resumenCV: "16 meses en cobranza en Nu México." }),

  /* ── Atención a Clientes cabina (p2) ── */
  C({ id: 16, nombre: "Brenda Castillo Reyes", edad: 23, zona: "Álvaro Obregón", traslado: 25, canal: "Pandape", fecha: "2026-09-05", perfilId: "p2", etapa: "entrevista_prime", expMeses: 12, escolaridad: "Bachillerato", expectativa: 10000, disponible: true, cv: { experiencia: 80, escolaridad: 100, disponibilidad: 90, habilidades: 78, competencias: 76 }, docs: {}, resumenCV: "1 año en call center de Atento (atención a clientes Telcel).", notas: "Entrevista Prime hoy 11:00 por Meet." }),
  C({ id: 17, nombre: "Óscar Daniel Peña Luna", edad: 29, zona: "Cuajimalpa", traslado: 20, canal: "Facebook", fecha: "2026-09-02", perfilId: "p2", etapa: "psico", expMeses: 30, escolaridad: "Carrera técnica", expectativa: 10500, disponible: true, cv: { experiencia: 88, escolaridad: 100, disponibilidad: 92, habilidades: 82, competencias: 78 }, docs: { cv: "ok" }, resumenCV: "2.5 años en cabina de asistencia vial en Ike Asistencia.", entrevista: { fecha: "2026-09-07 10:00", plataforma: "Google Meet", duracion: "26 min", fireflies: "FF-260907-006", estado: "Analizada", entrevistador: "Roberto Ávila (Prime)", score: 84, resumen: "Experiencia directa en cabina de asistencia vial; conoce protocolos y red de proveedores.", hallazgos: [{ k: "Experiencia en asistencias", ok: true, txt: "30 meses en Ike." }, { k: "Turnos rotativos", ok: true, txt: "Acepta nocturnos." }], transcript: [] } }),
  C({ id: 18, nombre: "Ximena Robles Aguirre", edad: 20, zona: "Santa Fe", traslado: 10, canal: "Bolsa Prime", fecha: "2026-09-08", perfilId: "p2", etapa: "cv", expMeses: 6, escolaridad: "Bachillerato", expectativa: 9000, disponible: true, cv: { experiencia: 62, escolaridad: 100, disponibilidad: 98, habilidades: 70, competencias: 72 }, docs: {}, resumenCV: "6 meses en atención a clientes en Oxxo Gas call center." }),
  C({ id: 19, nombre: "Iván Sandoval Mejía", edad: 34, zona: "Tlalnepantla", traslado: 80, canal: "Pandape", fecha: "2026-09-04", perfilId: "p2", etapa: "descartado", expMeses: 24, escolaridad: "Bachillerato", expectativa: 11000, disponible: true, cv: { experiencia: 84, escolaridad: 100, disponibilidad: 30, habilidades: 78, competencias: 74 }, docs: {}, motivo: "Traslado de 80 min a Santa Fe con turnos nocturnos", resumenCV: "2 años en call center." }),
  C({ id: 20, nombre: "Regina Ávila Montes", edad: 26, zona: "Benito Juárez", traslado: 40, canal: "LinkedIn", fecha: "2026-09-01", perfilId: "p2", etapa: "expediente", expMeses: 15, escolaridad: "Licenciatura", expectativa: 12000, disponible: true, cv: { experiencia: 80, escolaridad: 100, disponibilidad: 82, habilidades: 84, competencias: 80 }, docs: { ine: "ok", curp: "ok", rfc: "pend", nss: "ok", domicilio: "ok", acta: "ok", estudios: "ok", cv: "ok", recomendacion: "pend", confirmacion: "pend" }, resumenCV: "15 meses en atención a clientes en Quálitas (siniestros).", psico: { fecha: "2026-09-08", proveedor: "Psicotest", ci: 108, ciNivel: "Suficiente", coleibor: [["Actitud de servicio", 79], ["Inteligencia emocional", 74], ["Tolerancia a la presión", 70], ["Comunicación oral", 69], ["Seguimiento y control", 66], ["Toma de decisiones", 60], ["Análisis de problemas", 62], ["Trabajo en equipo", 64], ["Juicio", 61], ["Enfoque a resultados", 63], ["Detección de talento", 50]], cibainAltas: ["Estabilidad anímica (78%)"], cibainBajas: [], inceval: { confianza: "Suficiente", honestidad: "Alto", etica: "Suficiente" }, cacter: "Bajo presión mantiene calma y protocolo.", ciesmanBajos: [] }, entrevista: { fecha: "2026-09-09 09:30", plataforma: "Google Meet", duracion: "30 min", fireflies: "FF-260909-003", estado: "Transcrita", entrevistador: "Roberto Ávila (Prime)", score: null, resumen: "Análisis en proceso.", hallazgos: [], transcript: [] } }),
  C({ id: 21, nombre: "Héctor Manuel Guzmán Ortiz", edad: 31, zona: "Álvaro Obregón", traslado: 30, canal: "Pandape", fecha: "2026-08-27", perfilId: "p2", etapa: "entrevista_cliente", expMeses: 40, escolaridad: "Bachillerato", expectativa: 10000, disponible: true, cv: { experiencia: 92, escolaridad: 100, disponibilidad: 90, habilidades: 84, competencias: 82 }, docs: Object.fromEntries(DOCS.map((d) => [d.k, "ok"])), resumenCV: "3+ años en cabina de asistencia en Europ Assistance.", psico: { fecha: "2026-09-03", proveedor: "Psicotest", ci: 101, ciNivel: "Suficiente", coleibor: [["Tolerancia a la presión", 76], ["Actitud de servicio", 72], ["Comunicación oral", 70], ["Inteligencia emocional", 68], ["Seguimiento y control", 70], ["Toma de decisiones", 64], ["Análisis de problemas", 60], ["Trabajo en equipo", 66], ["Juicio", 62], ["Enfoque a resultados", 65], ["Detección de talento", 52]], cibainAltas: ["Constancia (80%)"], cibainBajas: [], inceval: { confianza: "Suficiente", honestidad: "Suficiente", etica: "Suficiente" }, cacter: "Estable bajo presión.", ciesmanBajos: [] }, entrevista: { fecha: "2026-09-02 10:30", plataforma: "Google Meet", duracion: "27 min", fireflies: "FF-260902-004", estado: "Analizada", entrevistador: "Roberto Ávila (Prime)", score: 86, resumen: "Perfil ideal de cabina.", hallazgos: [{ k: "Experiencia en asistencias", ok: true, txt: "40 meses." }, { k: "Turnos rotativos", ok: true, txt: "Acepta." }], transcript: [] } }),
  C({ id: 22, nombre: "Natalia Ríos Camacho", edad: 24, zona: "Magdalena Contreras", traslado: 45, canal: "Pandape", fecha: "2026-09-09", perfilId: "p2", etapa: "prefiltro", expMeses: 9, escolaridad: "Bachillerato", expectativa: 9500, disponible: true, cv: { experiencia: 70, escolaridad: 100, disponibilidad: 84, habilidades: 72, competencias: 70 }, docs: {}, resumenCV: "9 meses en call center de cobranza." }),
  C({ id: 23, nombre: "Diego Fuentes Barrera", edad: 27, zona: "Iztapalapa", traslado: 70, canal: "Facebook", fecha: "2026-09-10", perfilId: "p2", etapa: "nuevo", expMeses: 18, escolaridad: "Bachillerato", expectativa: 10000, disponible: true, cv: { experiencia: 82, escolaridad: 100, disponibilidad: 60, habilidades: 76, competencias: 72 }, docs: {}, resumenCV: "18 meses en atención a clientes en Konecta." }),
  C({ id: 24, nombre: "Lucía Herrera Domínguez", edad: 22, zona: "Cuajimalpa", traslado: 15, canal: "Pandape", fecha: "2026-08-15", perfilId: "p2", etapa: "contratado", expMeses: 7, escolaridad: "Bachillerato", expectativa: 9500, disponible: true, contratadoEl: "2026-09-01", cv: { experiencia: 66, escolaridad: 100, disponibilidad: 96, habilidades: 74, competencias: 76 }, docs: Object.fromEntries(DOCS.map((d) => [d.k, "ok"])), resumenCV: "7 meses en call center." }),

  /* ── Telemarketing (p3) ── */
  C({ id: 25, nombre: "Arturo Lozano Beltrán", edad: 30, zona: "Gustavo A. Madero", traslado: 50, canal: "Pandape", fecha: "2026-09-07", perfilId: "p3", etapa: "cv", expMeses: 20, escolaridad: "Bachillerato", expectativa: 10000, disponible: true, cv: { experiencia: 84, escolaridad: 100, disponibilidad: 80, habilidades: 78, competencias: 76 }, docs: {}, resumenCV: "20 meses vendiendo seguros por teléfono en GNP." }),
  C({ id: 26, nombre: "Fátima Quintero Salas", edad: 25, zona: "Iztacalco", traslado: 35, canal: "Facebook", fecha: "2026-09-09", perfilId: "p3", etapa: "prefiltro", expMeses: 10, escolaridad: "Bachillerato", expectativa: 9500, disponible: true, cv: { experiencia: 62, escolaridad: 100, disponibilidad: 86, habilidades: 70, competencias: 68 }, docs: {}, resumenCV: "10 meses en telemarketing de tarjetas." }),
  C({ id: 27, nombre: "Rodrigo Márquez Ponce", edad: 28, zona: "Coyoacán", traslado: 30, canal: "LinkedIn", fecha: "2026-09-04", perfilId: "p3", etapa: "entrevista_prime", expMeses: 36, escolaridad: "Licenciatura", expectativa: 13000, disponible: true, cv: { experiencia: 92, escolaridad: 100, disponibilidad: 88, habilidades: 86, competencias: 84 }, docs: {}, resumenCV: "3 años en ventas telefónicas B2C en Telcel; top 5% en conversión.", notas: "Entrevista Prime hoy 16:30 por Meet." }),
  C({ id: 28, nombre: "Carolina Ibáñez Tello", edad: 23, zona: "Xochimilco", traslado: 60, canal: "Pandape", fecha: "2026-09-10", perfilId: "p3", etapa: "nuevo", expMeses: 8, escolaridad: "Bachillerato", expectativa: 9800, disponible: true, cv: { experiencia: 56, escolaridad: 100, disponibilidad: 72, habilidades: 66, competencias: 64 }, docs: {}, resumenCV: "8 meses en ventas por teléfono." }),
  C({ id: 29, nombre: "Sergio Nava Escobedo", edad: 36, zona: "Tláhuac", traslado: 65, canal: "Pandape", fecha: "2026-09-10", perfilId: "p3", etapa: "nuevo", expMeses: 24, escolaridad: "Secundaria", expectativa: 10000, disponible: true, cv: { experiencia: 86, escolaridad: 80, disponibilidad: 70, habilidades: 78, competencias: 74 }, docs: {}, resumenCV: "2 años en telemarketing de seguros." }),
];

/* ───────────── entrevistas (agenda) ───────────── */
const INTERVIEWS = [
  { id: "e1", candId: 16, fecha: "2026-09-10", hora: "11:00", tipo: "Entrevista Prime", plataforma: "Google Meet", estado: "Programada", fireflies: "Invitado a la reunión", entrevistador: "Roberto Ávila (Prime)" },
  { id: "e2", candId: 27, fecha: "2026-09-10", hora: "16:30", tipo: "Entrevista Prime", plataforma: "Google Meet", estado: "Programada", fireflies: "Invitado a la reunión", entrevistador: "Andrea Lugo (Prime)" },
  { id: "e3", candId: 4, fecha: "2026-09-11", hora: "10:00", tipo: "Entrevista Prime", plataforma: "Zoom", estado: "Programada", fireflies: "Invitado a la reunión", entrevistador: "Andrea Lugo (Prime)" },
  { id: "e4", candId: 2, fecha: "2026-09-11", hora: "13:00", tipo: "Entrevista cliente", plataforma: "Google Meet", estado: "Programada", fireflies: "Invitado a la reunión", entrevistador: "Supervisor de cobranza (Telasist)" },
  { id: "e5", candId: 20, fecha: "2026-09-09", hora: "09:30", tipo: "Entrevista Prime", plataforma: "Google Meet", estado: "Transcrita", fireflies: "FF-260909-003", entrevistador: "Roberto Ávila (Prime)" },
  { id: "e6", candId: 1, fecha: "2026-09-08", hora: "12:00", tipo: "Entrevista Prime", plataforma: "Google Meet", estado: "Analizada", fireflies: "FF-260908-018", entrevistador: "Andrea Lugo (Prime)" },
  { id: "e7", candId: 3, fecha: "2026-09-08", hora: "16:00", tipo: "Entrevista Prime", plataforma: "Google Meet", estado: "Analizada", fireflies: "FF-260908-021", entrevistador: "Andrea Lugo (Prime)" },
  { id: "e8", candId: 17, fecha: "2026-09-07", hora: "10:00", tipo: "Entrevista Prime", plataforma: "Google Meet", estado: "Analizada", fireflies: "FF-260907-006", entrevistador: "Roberto Ávila (Prime)" },
];

/* ───────────── BI (histórico junio–agosto 2026, Telasist) ───────────── */
const BI_CANAL = [
  { canal: "Pandape", candidatos: 214, prefiltroOK: 41, entrevistas: 52, contratados: 14, dias: 11 },
  { canal: "Facebook", candidatos: 96, prefiltroOK: 29, entrevistas: 17, contratados: 4, dias: 13 },
  { canal: "LinkedIn", candidatos: 38, prefiltroOK: 58, entrevistas: 15, contratados: 6, dias: 9 },
  { canal: "Bolsa Prime", candidatos: 27, prefiltroOK: 63, entrevistas: 12, contratados: 5, dias: 8 },
];
const BI_SEMANAS = [
  { semana: "S32", nuevos: 48, entrevistas: 12, contratados: 3 },
  { semana: "S33", nuevos: 56, entrevistas: 14, contratados: 4 },
  { semana: "S34", nuevos: 61, entrevistas: 17, contratados: 3 },
  { semana: "S35", nuevos: 52, entrevistas: 15, contratados: 5 },
  { semana: "S36", nuevos: 67, entrevistas: 19, contratados: 4 },
  { semana: "S37", nuevos: 29, entrevistas: 8, contratados: 3 },
];
const BI_RETENCION = [
  { rango: "Score CV < 70", contratados: 6, permanecen90: 2 },
  { rango: "Score CV 70–79", contratados: 11, permanecen90: 7 },
  { rango: "Score CV 80+", contratados: 12, permanecen90: 11 },
];
const BI_MOTIVOS = [
  { motivo: "Sin disponibilidad de sábados", n: 38 },
  { motivo: "Traslado mayor a 60 min", n: 31 },
  { motivo: "Sin experiencia en cobranza", n: 27 },
  { motivo: "Expectativa salarial alta", n: 22 },
  { motivo: "Fuera de rango de edad", n: 14 },
];

/* ───────────── lógica de evaluación (lo que haría la IA) ───────────── */
const profileOf = (c) => PROFILES.find((p) => p.id === c.perfilId);
const clientOf = (p) => CLIENTS.find((k) => k.id === p.clientId);

function scoreCV(c) {
  const p = profileOf(c);
  if (!p || !p.pesos.length) return 0;
  const total = p.pesos.reduce((acc, w) => acc + (c.cv[w.k] || 0) * w.w, 0) / 100;
  return Math.round(total);
}

function prefiltro(c) {
  const r = profileOf(c)?.reglas;
  if (!r) return [];
  return [
    { q: "Edad", a: `${c.edad} años`, ok: c.edad >= r.edadMin && c.edad <= r.edadMax, req: `${r.edadMin} a ${r.edadMax} años` },
    { q: "Traslado", a: `${c.zona}, ${c.traslado} min`, ok: c.traslado <= r.trasladoMax, req: `máximo ${r.trasladoMax} min` },
    { q: "Experiencia", a: c.expMeses ? `${c.expMeses} meses` : "Sin experiencia", ok: c.expMeses >= r.expMin, req: `mínimo ${r.expMin} meses` },
    { q: "Disponibilidad", a: c.disponible ? "Sí" : "No", ok: c.disponible, req: r.horario },
    { q: "Expectativa", a: `$${c.expectativa.toLocaleString("es-MX")}`, ok: c.expectativa <= r.expectativaMax, req: `hasta $${r.expectativaMax.toLocaleString("es-MX")}` },
    { q: "Escolaridad", a: c.escolaridad, ok: true, req: "Secundaria o bachillerato" },
  ];
}

function psicoFit(c) {
  const p = profileOf(c);
  if (!c.psico || !p) return null;
  const map = Object.fromEntries(c.psico.coleibor);
  const rows = p.psicoEsperado.map((e) => ({ k: e.k, min: e.min, v: map[e.k] ?? 0, ok: (map[e.k] ?? 0) >= e.min }));
  const ok = rows.filter((r) => r.ok).length;
  const pct = Math.round((ok / Math.max(rows.length, 1)) * 100);
  const alertas = c.psico.cibainBajas.length;
  const veredicto = pct >= 80 && alertas === 0 ? "Apto" : pct >= 60 ? "Apto con reservas" : "No recomendado";
  return { rows, pct, veredicto };
}

const docsProgress = (c) => {
  const ok = DOCS.filter((d) => c.docs[d.k] === "ok").length;
  return { ok, total: DOCS.length, pct: Math.round((ok / DOCS.length) * 100) };
};

const fmtDate = (iso) => {
  const [y, m, d] = iso.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]}`;
};
const diasDesde = (iso) => Math.round((new Date(HOY) - new Date(iso)) / 86400000);
const initials = (n) => n.split(" ").slice(0, 2).map((w) => w[0]).join("");

/* ───────────── estilos globales ───────────── */
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
      .pr-root { -webkit-font-smoothing: antialiased; }
      .pr-root *:focus-visible { outline: 2px solid ${T.lime}; outline-offset: 2px; border-radius: 4px; }
      .pr-tnum { font-variant-numeric: tabular-nums; }
      .pr-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
      .pr-scroll::-webkit-scrollbar-thumb { background: ${T.line}; border-radius: 8px; }
      .pr-nav-btn { display:flex; align-items:center; gap:10px; width:100%; padding:9px 12px; border-radius:8px; border:none; background:transparent; color:rgba(255,255,255,.72); font:inherit; font-size:14px; font-weight:500; cursor:pointer; text-align:left; }
      .pr-nav-btn:hover { background: rgba(255,255,255,.08); color:#fff; }
      .pr-nav-btn.on { background: rgba(255,255,255,.14); color:#fff; }
      .pr-row:hover { background: ${T.mint}; }
      .pr-kcard { transition: box-shadow .15s; cursor: pointer; }
      .pr-kcard:hover { box-shadow: 0 2px 10px rgba(14,70,50,.14); }
      @media (prefers-reduced-motion: reduce) { .pr-root * { transition: none !important; } }
    `}</style>
  );
}

/* ───────────── primitivas ───────────── */
function Pill({ children, tone = "neutral", small }) {
  const tones = {
    neutral: [T.mint, T.forest], ok: [T.leafSoft, T.forest], warn: [T.amberSoft, T.amber],
    bad: [T.redSoft, T.red], info: [T.blueSoft, T.blue], dark: [T.forest, "#fff"], wa: ["#E6F9EE", "#128C4B"],
  };
  const [bg, fg] = tones[tone] || tones.neutral;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, color: fg, borderRadius: 999, padding: small ? "2px 8px" : "3px 10px", fontSize: small ? 11.5 : 12.5, fontWeight: 600, whiteSpace: "nowrap", lineHeight: 1.4 }}>
      {children}
    </span>
  );
}

function Btn({ children, onClick, primary, ghost, small, icon: Icon, disabled, danger }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 8, fontFamily: T.font, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontSize: small ? 13 : 14, padding: small ? "6px 11px" : "9px 14px", border: `1px solid ${T.line}`, background: T.white, color: T.ink, opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap" };
  if (primary) Object.assign(base, { background: T.leaf, color: "#fff", border: `1px solid ${T.leaf}` });
  if (ghost) Object.assign(base, { background: "transparent", border: "1px solid transparent", color: T.forest });
  if (danger) Object.assign(base, { background: T.white, color: T.red, border: `1px solid ${T.redSoft}` });
  return (
    <button type="button" onClick={disabled ? undefined : onClick} style={base}>
      {Icon && <Icon size={small ? 14 : 16} strokeWidth={2.25} />}
      {children}
    </button>
  );
}

function Card({ children, style, pad = 20, title, right }) {
  return (
    <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, padding: pad, ...style }}>
      {(title || right) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
          {title && <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: T.ink }}>{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function H1({ children, sub, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: T.ink, letterSpacing: "-0.01em" }}>{children}</h1>
        {sub && <div style={{ color: T.slate, fontSize: 14, marginTop: 4 }}>{sub}</div>}
      </div>
      {right && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{right}</div>}
    </div>
  );
}

function Stat({ label, value, hint, tone }) {
  const color = tone === "warn" ? T.amber : tone === "bad" ? T.red : T.forest;
  return (
    <Card pad={16}>
      <div style={{ fontSize: 13, color: T.slate }}>{label}</div>
      <div className="pr-tnum" style={{ fontSize: 30, fontWeight: 600, color, lineHeight: 1.15, marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 12.5, color: T.slate, marginTop: 4 }}>{hint}</div>}
    </Card>
  );
}

function Ring({ value, size = 56, stroke = 6, label }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = value >= 80 ? T.leaf : value >= 70 ? T.lime : value >= 55 ? T.amber : T.red;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={T.line} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={circ} strokeDashoffset={circ * (1 - value / 100)} strokeLinecap="round" />
      </svg>
      <div className="pr-tnum" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size > 60 ? 18 : 14, color: T.ink, lineHeight: 1 }}>
        {value}
        {label && <span style={{ fontSize: 10, fontWeight: 500, color: T.slate, marginTop: 2 }}>{label}</span>}
      </div>
    </div>
  );
}

function Bar({ value, max = 100, color, height = 8, marker }) {
  return (
    <div style={{ position: "relative", background: T.mint, borderRadius: 999, height, width: "100%", overflow: "visible" }}>
      <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color || T.leaf, height, borderRadius: 999 }} />
      {marker != null && (
        <div style={{ position: "absolute", left: `${(marker / max) * 100}%`, top: -3, width: 2, height: height + 6, background: T.ink, borderRadius: 2 }} />
      )}
    </div>
  );
}

function Avatar({ name, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: T.leafSoft, color: T.forest, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: size * 0.36, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

function Field({ label, children, wide }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14.5, color: T.ink, lineHeight: 1.5 }}>{children || <span style={{ color: T.slate }}>Por definir</span>}</div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, area, wide }) {
  const s = { width: "100%", border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 11px", fontFamily: T.font, fontSize: 14, color: T.ink, background: T.white, boxSizing: "border-box" };
  return (
    <label style={{ display: "block", gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 5 }}>{label}</div>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...s, resize: "vertical" }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={s} />
      )}
    </label>
  );
}

function StageChip({ etapa }) {
  const tone = etapa === "contratado" ? "ok" : etapa === "descartado" ? "bad" : etapa === "nuevo" ? "neutral" : "info";
  return <Pill tone={tone} small>{stageLabel(etapa)}</Pill>;
}

function ChannelDot({ canal }) {
  const c = { Pandape: "#F26522", Facebook: "#1877F2", LinkedIn: "#0A66C2", "Bolsa Prime": T.leaf }[canal] || T.slate;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.slate }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />
      {canal}
    </span>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", background: T.forest, color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 500, zIndex: 60, boxShadow: "0 8px 24px rgba(14,70,50,.3)", display: "flex", gap: 8, alignItems: "center" }}>
      <Check size={16} /> {msg}
    </div>
  );
}

/* ═════════════ TABLERO ═════════════ */
function Tablero({ cands, profiles, go, openCand, nombre }) {
  const activos = cands.filter((c) => c.etapa !== "descartado" && c.etapa !== "contratado");
  const nuevosHoy = cands.filter((c) => c.fecha === HOY).length;
  const enPrefiltro = cands.filter((c) => c.etapa === "prefiltro").length;
  const entHoy = INTERVIEWS.filter((e) => e.fecha === HOY);
  const psicoPend = cands.filter((c) => c.etapa === "psico" && !c.psico).length;
  const expPend = cands.filter((c) => c.etapa === "expediente").length;
  const contratadosSem = cands.filter((c) => c.etapa === "contratado" && diasDesde(c.contratadoEl) <= 7).length;

  const alertas = [];
  cands.forEach((c) => {
    if (["nuevo", "prefiltro", "cv"].includes(c.etapa)) {
      const fails = prefiltro(c).filter((r) => !r.ok);
      if (fails.length) alertas.push({ c, txt: `${fails.map((f) => f.q.toLowerCase()).join(", ")} fuera de perfil`, tone: "warn" });
    }
    if (c.etapa === "expediente") {
      const d = docsProgress(c);
      if (d.ok < d.total) alertas.push({ c, txt: `expediente ${d.ok}/${d.total} documentos`, tone: "info" });
    }
    if (c.etapa === "psico" && !c.psico) alertas.push({ c, txt: "psicométrico enviado, sin completar", tone: "info" });
  });

  const funnel = profiles.filter((p) => p.estado === "Activa").map((p) => {
    const cs = cands.filter((c) => c.perfilId === p.id);
    const row = { name: p.titulo.split(" (")[0] };
    STAGES.forEach((s) => { row[s.id] = cs.filter((c) => c.etapa === s.id).length; });
    row.descartado = cs.filter((c) => c.etapa === "descartado").length;
    return row;
  });
  const stageColors = ["#C9E5D4", "#A9D8BC", "#86C9A3", "#63B98A", "#3FA872", "#1E8A57", "#14694A", "#0E4632"];

  return (
    <div>
      <H1 sub="Jueves 10 de septiembre de 2026 · Prime HR Innovation">Buenos días, {nombre}</H1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Stat label="Candidatos nuevos hoy" value={nuevosHoy} hint="Llegaron de Pandape y Facebook" />
        <Stat label="En prefiltro con el agente" value={enPrefiltro} hint="Conversación de WhatsApp activa" />
        <Stat label="Entrevistas hoy" value={entHoy.length} hint="Meet con Fireflies invitado" />
        <Stat label="Psicométricos por completar" value={psicoPend} tone={psicoPend ? "warn" : undefined} hint="Enviados por WhatsApp" />
        <Stat label="Expedientes en captura" value={expPend} hint="El agente pide los documentos" />
        <Stat label="Contratados esta semana" value={contratadosSem} hint="Telasist, 3 vacantes" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)", gap: 16, marginBottom: 16 }}>
        <Card title="Embudo por vacante" right={<Btn small ghost onClick={() => go("candidatos")}>Ver pipeline</Btn>}>
          <div style={{ height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }} barSize={22}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 12.5, fill: T.ink }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: T.mint }} contentStyle={{ borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5 }} />
                {STAGES.map((s, i) => (
                  <Bar key={s.id} dataKey={s.id} name={s.label} stackId="a" fill={stageColors[i]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8 }}>
            {STAGES.map((s, i) => (
              <span key={s.id} style={{ fontSize: 11.5, color: T.slate, display: "inline-flex", gap: 5, alignItems: "center" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: stageColors[i], display: "inline-block" }} />{s.short}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Agenda de hoy" right={<Btn small ghost onClick={() => go("entrevistas")}>Ver entrevistas</Btn>}>
          {entHoy.map((e) => {
            const c = cands.find((x) => x.id === e.candId);
            return (
              <div key={e.id} className="pr-row" onClick={() => openCand(c.id)} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 12, alignItems: "center", padding: "10px 8px", borderRadius: 8, cursor: "pointer" }}>
                <div className="pr-tnum" style={{ fontWeight: 600, color: T.forest }}>{e.hora}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nombre}</div>
                  <div style={{ fontSize: 12.5, color: T.slate }}>{profileOf(c).titulo.split(" (")[0]} · {e.tipo}</div>
                </div>
                <Pill tone="info" small><Video size={12} /> {e.plataforma}</Pill>
              </div>
            );
          })}
          <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 10, paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Requiere tu atención</div>
            {alertas.slice(0, 5).map((a, i) => (
              <div key={i} className="pr-row" onClick={() => openCand(a.c.id)} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 8px", borderRadius: 8, cursor: "pointer" }}>
                <AlertTriangle size={15} color={a.tone === "warn" ? T.amber : T.blue} />
                <div style={{ fontSize: 13.5 }}><span style={{ fontWeight: 600 }}>{a.c.nombre.split(" ").slice(0, 2).join(" ")}</span> <span style={{ color: T.slate }}>{a.txt}</span></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <Card title="Resumen diario interno" right={<Pill tone="ok" small><Mail size={12} /> Se envía 18:00</Pill>}>
          <p style={{ margin: "0 0 10px", fontSize: 14, color: T.ink, lineHeight: 1.55 }}>Hoy llegaron {nuevosHoy} candidatos, {enPrefiltro} siguen en prefiltro y {cands.filter((c) => c.etapa === "cv").length} pasaron la evaluación de CV. {entHoy.length} entrevistas programadas. {alertas.filter((a) => a.tone === "warn").length} candidatos con criterios fuera de perfil esperan decisión del reclutador.</p>
          <Btn small onClick={() => go("reportes")}>Ver correo completo</Btn>
        </Card>
        <Card title="Envío diario a Telasist" right={<Pill tone="ok" small><Mail size={12} /> Se envía 18:00</Pill>}>
          <p style={{ margin: "0 0 10px", fontSize: 14, color: T.ink, lineHeight: 1.55 }}>{activos.filter((c) => STAGE_IDX[c.etapa] >= STAGE_IDX.psico).length} candidatos avanzaron en el proceso esta semana. Telasist recibe solo los que ya pasaron entrevista Prime, con su puntuación, psicométrico y estado del expediente.</p>
          <Btn small onClick={() => go("reportes")}>Ver correo al cliente</Btn>
        </Card>
        <Card title="Prefiltro automático" right={<Pill tone="wa" small><MessageCircle size={12} /> Whaapy</Pill>}>
          <p style={{ margin: "0 0 10px", fontSize: 14, color: T.ink, lineHeight: 1.55 }}>El agente de WhatsApp contactó a {cands.filter((c) => diasDesde(c.fecha) <= 1).length} candidatos en las últimas 24 horas y descartó {cands.filter((c) => c.etapa === "descartado").length} por reglas del perfil. Tiempo promedio de respuesta: 4 minutos.</p>
          <Btn small onClick={() => go("candidatos")}>Ver conversaciones</Btn>
        </Card>
      </div>
    </div>
  );
}

/* ═════════════ CLIENTES ═════════════ */
function Clientes({ cands, profiles, selected, setSelected, go, openProfile, startLevantamiento }) {
  const cl = CLIENTS.find((k) => k.id === selected);
  if (cl) {
    const ps = profiles.filter((p) => p.clientId === cl.id);
    const cs = cands.filter((c) => ps.some((p) => p.id === c.perfilId));
    return (
      <div>
        <Btn ghost small icon={ArrowLeft} onClick={() => setSelected(null)}>Clientes</Btn>
        <div style={{ height: 10 }} />
        <H1 sub={cl.giro} right={<><Btn onClick={() => go("portal")} icon={Globe}>Ver portal del cliente</Btn><Btn primary icon={Plus} onClick={() => startLevantamiento(cl.id)}>Nuevo perfil de puesto</Btn></>}>{cl.nombre}</H1>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16 }}>
          <div>
            <Card title="Perfiles de puesto">
              {ps.map((p) => {
                const pc = cands.filter((c) => c.perfilId === p.id);
                const activos = pc.filter((c) => !["descartado", "contratado"].includes(c.etapa)).length;
                const contr = pc.filter((c) => c.etapa === "contratado").length;
                return (
                  <div key={p.id} className="pr-row" onClick={() => openProfile(p.id)} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 16, alignItems: "center", padding: "12px 10px", borderRadius: 8, cursor: "pointer", borderBottom: `1px solid ${T.line}` }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.titulo}</div>
                      <div style={{ fontSize: 12.5, color: T.slate }}>{p.vacantes} vacante{p.vacantes > 1 ? "s" : ""} · {p.unidad} · creado {fmtDate(p.fecha)}</div>
                    </div>
                    <div className="pr-tnum" style={{ textAlign: "right", fontSize: 13 }}><div style={{ fontWeight: 600 }}>{activos}</div><div style={{ color: T.slate, fontSize: 12 }}>en proceso</div></div>
                    <div className="pr-tnum" style={{ textAlign: "right", fontSize: 13 }}><div style={{ fontWeight: 600 }}>{contr}/{p.vacantes}</div><div style={{ color: T.slate, fontSize: 12 }}>cubiertas</div></div>
                    <Pill tone={p.estado === "Activa" ? "ok" : p.estado === "Pausada" ? "warn" : "info"} small>{p.estado}</Pill>
                  </div>
                );
              })}
              {ps.length === 0 && <div style={{ color: T.slate, fontSize: 14 }}>Este cliente aún no tiene perfiles. Crea el primero desde el levantamiento.</div>}
            </Card>
          </div>
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <Card title="Contacto">
              <div style={{ display: "grid", gap: 10 }}>
                <Field label="Responsable">{cl.contacto}<div style={{ fontSize: 12.5, color: T.slate }}>{cl.puesto}</div></Field>
                <Field label="Correo">{cl.email}</Field>
                <Field label="Teléfono">{cl.tel}</Field>
                <Field label="Domicilio">{cl.zona}</Field>
                <Field label="Cliente desde">{cl.desde}</Field>
              </div>
            </Card>
            <Card title="Reportes automáticos">
              <div style={{ display: "grid", gap: 10 }}>
                <Field label="Candidatos que avanzan">{cl.reporteDiario} por correo</Field>
                <Field label="Reporte semanal">{cl.reporteSemanal} por correo</Field>
                <Field label="Acceso al portal">{cl.contacto} (solo lectura)</Field>
              </div>
            </Card>
            <Card title="Resultados">
              <div style={{ display: "grid", gap: 10 }}>
                <Field label="Candidatos en proceso">{cs.filter((c) => !["descartado", "contratado"].includes(c.etapa)).length}</Field>
                <Field label="Contratados en el mes">{cs.filter((c) => c.etapa === "contratado").length}</Field>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <H1 sub="Empresas que reclutan con Prime" right={<Btn primary icon={Plus} onClick={() => startLevantamiento(null)}>Alta de cliente</Btn>}>Clientes</H1>
      <Card pad={0}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: T.slate, fontSize: 12.5 }}>
              {["Cliente", "Giro", "Vacantes activas", "En proceso", "Contratados", "Contacto"].map((h, i) => (
                <th key={h} style={{ padding: "12px 16px", borderBottom: `1px solid ${T.line}`, fontWeight: 600, textAlign: i >= 2 && i <= 4 ? "right" : "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLIENTS.map((cl) => {
              const ps = profiles.filter((p) => p.clientId === cl.id);
              const cs = cands.filter((c) => ps.some((p) => p.id === c.perfilId));
              return (
                <tr key={cl.id} className="pr-row" onClick={() => setSelected(cl.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${T.line}` }}>
                  <td style={{ padding: "13px 16px", fontWeight: 600 }}>{cl.nombre}</td>
                  <td style={{ padding: "13px 16px", color: T.slate }}>{cl.giro}</td>
                  <td className="pr-tnum" style={{ padding: "13px 16px", textAlign: "right" }}>{ps.filter((p) => p.estado === "Activa").reduce((a, p) => a + p.vacantes, 0)}</td>
                  <td className="pr-tnum" style={{ padding: "13px 16px", textAlign: "right" }}>{cs.filter((c) => !["descartado", "contratado"].includes(c.etapa)).length}</td>
                  <td className="pr-tnum" style={{ padding: "13px 16px", textAlign: "right" }}>{cs.filter((c) => c.etapa === "contratado").length}</td>
                  <td style={{ padding: "13px 16px" }}>{cl.contacto}<div style={{ fontSize: 12, color: T.slate }}>{cl.email}</div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ═════════════ PERFILES DE PUESTO ═════════════ */
function Sec({ title, children, form }) {
  return (
    <div style={{ marginBottom: form ? 24 : 22 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.forest, paddingBottom: 6, borderBottom: `2px solid ${T.leafSoft}`, marginBottom: 12 }}>{title}</div>
      {form ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>{children}</div> : children}
    </div>
  );
}
function Grid({ children }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px 20px" }}>{children}</div>;
}

function Perfiles({ cands, profiles, selected, setSelected, openCand, startLevantamiento }) {
  const [tab, setTab] = useState("descriptivo");
  const p = profiles.find((x) => x.id === selected);

  if (p) {
    const cl = clientOf(p);
    const pc = cands.filter((c) => c.perfilId === p.id);

    return (
      <div>
        <Btn ghost small icon={ArrowLeft} onClick={() => setSelected(null)}>Perfiles de puesto</Btn>
        <div style={{ height: 10 }} />
        <H1 sub={`${cl.nombre} · ${p.unidad} · ${p.vacantes} vacante${p.vacantes > 1 ? "s" : ""} · elaborado por ${p.elaboradoPor}`} right={<Pill tone={p.estado === "Activa" ? "ok" : "warn"}>{p.estado}</Pill>}>{p.titulo}</H1>

        <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: `1px solid ${T.line}` }}>
          {[["descriptivo", "Descriptivo de puesto"], ["ia", "Evaluación automática"], ["candidatos", `Candidatos (${pc.length})`]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === k ? T.leaf : "transparent"}`, padding: "8px 12px", fontFamily: T.font, fontSize: 14, fontWeight: 600, color: tab === k ? T.forest : T.slate, cursor: "pointer", marginBottom: -1 }}>{l}</button>
          ))}
        </div>

        {tab === "descriptivo" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 16 }}>
            <Card>
              <Sec title="I. Datos generales">
                <Grid>
                  <Field label="Empresa">{cl.nombre}</Field>
                  <Field label="Giro">{cl.giro}</Field>
                  <Field label="Zona de trabajo" wide>{p.zona}</Field>
                  <Field label="Número de vacantes">{p.vacantes}</Field>
                  <Field label="Reporta a">{p.reportaA}</Field>
                </Grid>
              </Sec>
              <Sec title="II. Objetivo del puesto"><div style={{ fontSize: 14.5, lineHeight: 1.6 }}>{p.objetivo}</div></Sec>
              <Sec title="III. Especificaciones">
                <Grid>
                  <Field label="Edad">{p.especificaciones.edad}</Field>
                  <Field label="Sexo">{p.especificaciones.sexo}</Field>
                  <Field label="Estado civil">{p.especificaciones.estadoCivil}</Field>
                  <Field label="Hijos">{p.especificaciones.hijos}</Field>
                  <Field label="Localidad de residencia" wide>{p.especificaciones.residencia}</Field>
                </Grid>
              </Sec>
              <Sec title="IV. Requisitos">
                <Grid>
                  <Field label="Escolaridad">{p.requisitos.escolaridad}</Field>
                  <Field label="Experiencia">{p.requisitos.experiencia}</Field>
                  <Field label="Conocimientos y habilidades" wide>{p.requisitos.conocimientos}</Field>
                  <Field label="Idiomas">{p.requisitos.idiomas}</Field>
                  <Field label="Sistemas">{p.requisitos.sistemas}</Field>
                </Grid>
                <div style={{ fontSize: 12.5, color: T.slate, margin: "14px 0 6px" }}>Actividades</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>{p.actividades.map((a) => <li key={a}>{a}</li>)}</ul>
              </Sec>
              <Sec title="V. Condiciones laborales">
                <Grid>
                  <Field label="Sueldo mensual" wide>{p.condiciones.sueldo}</Field>
                  <Field label="Prestaciones" wide>{p.condiciones.prestaciones}</Field>
                  <Field label="Horario">{p.condiciones.horario}</Field>
                  <Field label="Modalidad">{p.condiciones.modalidad}</Field>
                  <Field label="Disponibilidad para viajar">{p.condiciones.viajar}</Field>
                  <Field label="Personal a cargo">{p.condiciones.personalACargo}</Field>
                  <Field label="Herramientas de trabajo" wide>{p.condiciones.herramientas}</Field>
                </Grid>
              </Sec>
              <Sec title="VI. Competencias">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 6 }}>Funcionales</div>
                    {p.competenciasFuncionales.map((c) => <div key={c.c} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "5px 0", borderBottom: `1px solid ${T.line}` }}><span>{c.c}</span><Pill small tone={c.n === "Experto" ? "dark" : c.n === "Avanzado" ? "ok" : "neutral"}>{c.n}</Pill></div>)}
                    {p.competenciasLaborales && p.competenciasLaborales.map((c) => <div key={c} style={{ fontSize: 14, padding: "5px 0", borderBottom: `1px solid ${T.line}` }}>{c}</div>)}
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, color: T.slate, marginBottom: 6 }}>Liderazgo</div>
                    {p.competenciasLiderazgo.map((c) => <div key={c.c} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "5px 0", borderBottom: `1px solid ${T.line}` }}><span>{c.c}</span><Pill small tone={c.n === "Experto" ? "dark" : c.n === "Avanzado" ? "ok" : "neutral"}>{c.n}</Pill></div>)}
                    {p.competenciasLiderazgo.length === 0 && <div style={{ fontSize: 13.5, color: T.slate }}>Sin competencias de liderazgo para este puesto.</div>}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: T.slate, marginTop: 10 }}>Esencial: aplica la competencia con apoyo · Avanzado: la aplica en situaciones complejas · Experto: es mentor de otros en su uso.</div>
              </Sec>
              <Sec title="VII. Proceso de selección">
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>{p.proceso.map((s) => <li key={s}>{s}</li>)}</ol>
              </Sec>
            </Card>
            <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <Card title="Relaciones del puesto">
                {p.relaciones.map((r) => <div key={r.con} style={{ marginBottom: 10 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{r.con}</div><div style={{ fontSize: 13, color: T.slate }}>{r.para}</div></div>)}
                {p.relaciones.length === 0 && <div style={{ fontSize: 13.5, color: T.slate }}>Sin relaciones registradas.</div>}
              </Card>
              <Card title="Publicación">
                <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.55 }}>Prime publica manualmente en Pandape, Facebook y LinkedIn. Cada postulante entra al sistema con su canal de origen y el agente de WhatsApp lo contacta en minutos.</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>{["Pandape", "Facebook", "LinkedIn", "Bolsa Prime"].map((c) => <ChannelDot key={c} canal={c} />)}</div>
              </Card>
            </div>
          </div>
        )}

        {tab === "ia" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            <Card title="Puntuación del CV contra el perfil" right={<Pill small>Umbral {p.umbral}</Pill>}>
              <div style={{ fontSize: 13.5, color: T.slate, marginBottom: 12, lineHeight: 1.5 }}>La IA lee el CV y las respuestas del prefiltro, califica cada criterio de 0 a 100 y pondera con estos pesos. Con {p.umbral} o más pasa a entrevista Prime.</div>
              {p.pesos.map((w) => (
                <div key={w.k} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 }}><span>{w.label}</span><span className="pr-tnum" style={{ fontWeight: 600 }}>{w.w}%</span></div>
                  <Bar value={w.w} max={40} />
                </div>
              ))}
            </Card>
            <Card title="Preguntas del agente de WhatsApp" right={<Pill tone="wa" small><MessageCircle size={12} /> Whaapy</Pill>}>
              <div style={{ fontSize: 13.5, color: T.slate, marginBottom: 12, lineHeight: 1.5 }}>Generadas a partir de la sección III, IV y V del perfil. El agente las hace en conversación natural y valida cada respuesta contra la regla.</div>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>{p.preguntas.map((q) => <li key={q}>{q}</li>)}</ol>
              <div style={{ marginTop: 12, fontSize: 12.5, color: T.slate }}>Reglas: edad {p.reglas.edadMin}–{p.reglas.edadMax} · traslado ≤ {p.reglas.trasladoMax} min · experiencia ≥ {p.reglas.expMin} meses · expectativa ≤ ${p.reglas.expectativaMax.toLocaleString("es-MX")}</div>
            </Card>
            <Card title="Perfil psicométrico esperado" right={<Pill small tone="info"><Brain size={12} /> Psicotest</Pill>}>
              <div style={{ fontSize: 13.5, color: T.slate, marginBottom: 12, lineHeight: 1.5 }}>Mínimos en la prueba de competencias (Coleibor) derivados de las competencias del puesto. La IA lee el PDF de Psicotest y compara.</div>
              {p.psicoEsperado.map((e) => (
                <div key={e.k} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "6px 0", borderBottom: `1px solid ${T.line}` }}><span>{e.k}</span><span className="pr-tnum" style={{ fontWeight: 600 }}>≥ {e.min}%</span></div>
              ))}
              <div style={{ marginTop: 10, fontSize: 12.5, color: T.slate }}>También revisa Inceval (honestidad y ética ≥ Regular), Cibain (escalas bajas como alerta) y Ciesman (CI y planeación).</div>
            </Card>
            <Card title="Análisis de entrevista" right={<Pill small tone="info"><Video size={12} /> Fireflies</Pill>}>
              <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.6 }}>Al agendar, el sistema crea la reunión de Meet o Zoom e invita a Fireflies. Cuando termina, toma la transcripción y busca evidencia de cada requisito del perfil: experiencia, disponibilidad, expectativa y competencias. Devuelve hallazgos con cita textual y una puntuación de entrevista.</div>
            </Card>
          </div>
        )}

        {tab === "candidatos" && (
          <Card pad={0}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ color: T.slate, fontSize: 12.5, textAlign: "left" }}>{["Candidato", "Canal", "Ingreso", "Score CV", "Etapa"].map((h) => <th key={h} style={{ padding: "12px 16px", borderBottom: `1px solid ${T.line}`, fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {pc.sort((a, b) => STAGE_IDX[b.etapa] - STAGE_IDX[a.etapa] || 0).map((c) => (
                  <tr key={c.id} className="pr-row" onClick={() => openCand(c.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${T.line}` }}>
                    <td style={{ padding: "11px 16px", fontWeight: 600 }}>{c.nombre}</td>
                    <td style={{ padding: "11px 16px" }}><ChannelDot canal={c.canal} /></td>
                    <td style={{ padding: "11px 16px", color: T.slate }}>{fmtDate(c.fecha)}</td>
                    <td className="pr-tnum" style={{ padding: "11px 16px", fontWeight: 600 }}>{scoreCV(c)}</td>
                    <td style={{ padding: "11px 16px" }}><StageChip etapa={c.etapa} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div>
      <H1 sub="Descriptivos de puesto por cliente, con su configuración de evaluación automática" right={<Btn primary icon={Plus} onClick={() => startLevantamiento(null)}>Nuevo levantamiento</Btn>}>Perfiles de puesto</H1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {profiles.map((p) => {
          const cl = clientOf(p);
          const pc = cands.filter((c) => c.perfilId === p.id);
          return (
            <div key={p.id} className="pr-kcard" onClick={() => setSelected(p.id)} style={{ background: T.white, border: `1px solid ${T.line}`, borderLeft: `4px solid ${p.estado === "Activa" ? T.leaf : p.estado === "Pausada" ? T.amber : T.blue}`, borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{p.titulo}</div>
                <Pill small tone={p.estado === "Activa" ? "ok" : p.estado === "Pausada" ? "warn" : "info"}>{p.estado}</Pill>
              </div>
              <div style={{ fontSize: 13, color: T.slate, marginTop: 4 }}>{cl.nombre} · {p.vacantes} vacante{p.vacantes > 1 ? "s" : ""}</div>
              <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 13 }}>
                <span><span className="pr-tnum" style={{ fontWeight: 600 }}>{pc.filter((c) => !["descartado", "contratado"].includes(c.etapa)).length}</span> <span style={{ color: T.slate }}>en proceso</span></span>
                <span><span className="pr-tnum" style={{ fontWeight: 600 }}>{pc.filter((c) => c.etapa === "contratado").length}</span> <span style={{ color: T.slate }}>contratados</span></span>
                <span><span className="pr-tnum" style={{ fontWeight: 600 }}>{p.umbral}</span> <span style={{ color: T.slate }}>umbral</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════ LEVANTAMIENTO DE PERFIL ═════════════ */
function Levantamiento({ clientId, onCancel, onGenerate }) {
  const base = PROFILES.find((p) => p.id === "p4");
  const preset = clientId === "orange" || clientId == null;
  const [f, setF] = useState(() => ({
    empresa: preset ? "Orange Printing Solutions" : CLIENTS.find((c) => c.id === clientId)?.nombre || "",
    giro: preset ? base.requisitos && "Servicios de impresión y soluciones gráficas" : "",
    zona: preset ? base.zona : "",
    vacantes: preset ? "1" : "",
    titulo: preset ? "Diseñador Industrial" : "",
    objetivo: preset ? base.objetivo : "",
    edad: preset ? "25 a 40 años" : "",
    sexo: "Indistinto", estadoCivil: "Indistinto", hijos: "Indistinto", residencia: "",
    escolaridad: preset ? base.requisitos.escolaridad : "",
    experiencia: preset ? base.requisitos.experiencia : "",
    actividades: preset ? base.actividades.join("\n") : "",
    conocimientos: preset ? base.requisitos.conocimientos : "",
    horario: "", dias: "", modalidad: "", sueldo: "", prestaciones: preset ? "Ley y superiores" : "", disponibilidadHorario: "Sí", personal: "N/A", herramientas: "",
    competencias: preset ? base.competenciasLaborales.join(", ") : "",
  }));
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const faltan = ["sueldo", "horario", "modalidad"].filter((k) => !f[k]);
  return (
    <div>
      <Btn ghost small icon={ArrowLeft} onClick={onCancel}>Cancelar</Btn>
      <div style={{ height: 10 }} />
      <H1 sub="Mismo formato que el levantamiento en Excel. Al guardar, la IA redacta el descriptivo, las preguntas del agente y los pesos de evaluación." right={<Btn primary icon={Sparkles} onClick={() => onGenerate(f)}>Generar perfil de puesto</Btn>}>Levantamiento de perfil</H1>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 16 }}>
        <Card>
          <Sec form title="I. Datos generales">
            <Input label="Puesto" value={f.titulo} onChange={set("titulo")} />
            <Input label="Empresa" value={f.empresa} onChange={set("empresa")} />
            <Input label="Giro" value={f.giro} onChange={set("giro")} />
            <Input label="Número de vacantes" value={f.vacantes} onChange={set("vacantes")} />
            <Input label="Zona de trabajo" value={f.zona} onChange={set("zona")} wide />
          </Sec>
          <Sec form title="II. Objetivo del perfil"><Input label="Objetivo" value={f.objetivo} onChange={set("objetivo")} area wide /></Sec>
          <Sec form title="III. Especificaciones del perfil">
            <Input label="Edad" value={f.edad} onChange={set("edad")} />
            <Input label="Sexo" value={f.sexo} onChange={set("sexo")} />
            <Input label="Estado civil" value={f.estadoCivil} onChange={set("estadoCivil")} />
            <Input label="Con o sin hijos" value={f.hijos} onChange={set("hijos")} />
            <Input label="Localidad de residencia" value={f.residencia} onChange={set("residencia")} wide />
          </Sec>
          <Sec form title="IV. Requisitos del perfil">
            <Input label="Escolaridad" value={f.escolaridad} onChange={set("escolaridad")} />
            <Input label="Experiencia" value={f.experiencia} onChange={set("experiencia")} />
            <Input label="Actividades (una por línea)" value={f.actividades} onChange={set("actividades")} area wide />
            <Input label="Conocimientos" value={f.conocimientos} onChange={set("conocimientos")} area wide />
          </Sec>
          <Sec form title="V. Condiciones laborales">
            <Input label="Horarios" value={f.horario} onChange={set("horario")} placeholder="Ej. 9:00 a 18:00" />
            <Input label="Días de trabajo" value={f.dias} onChange={set("dias")} placeholder="Ej. lunes a viernes" />
            <Input label="Presencial / HO / Híbrido" value={f.modalidad} onChange={set("modalidad")} />
            <Input label="Sueldo mensual" value={f.sueldo} onChange={set("sueldo")} placeholder="Ej. $18,000 brutos" />
            <Input label="Prestaciones (ley o superiores)" value={f.prestaciones} onChange={set("prestaciones")} />
            <Input label="Disponibilidad de horario" value={f.disponibilidadHorario} onChange={set("disponibilidadHorario")} />
            <Input label="Personal a cargo" value={f.personal} onChange={set("personal")} />
            <Input label="Herramientas de trabajo" value={f.herramientas} onChange={set("herramientas")} />
          </Sec>
          <Sec form title="VI. Competencias laborales"><Input label="Competencias (separadas por coma)" value={f.competencias} onChange={set("competencias")} area wide /></Sec>
        </Card>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Card title="Lo que generará la IA">
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: T.ink }}>
              <li>Descriptivo de puesto en el formato D.P. de Prime</li>
              <li>Reglas de prefiltro (edad, zona, experiencia, expectativa)</li>
              <li>Preguntas del agente de WhatsApp</li>
              <li>Pesos de puntuación del CV y umbral sugerido</li>
              <li>Mínimos psicométricos por competencia</li>
              <li>Texto de la vacante listo para Pandape, Facebook y LinkedIn</li>
            </ul>
          </Card>
          {faltan.length > 0 && (
            <Card pad={14} style={{ background: T.amberSoft, borderColor: "#EBD9A8" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, color: T.amber, lineHeight: 1.5 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>Faltan {faltan.join(", ")}. Puedes generar el perfil y el sistema dejará esos campos marcados para completar con el cliente.</div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═════════════ CANDIDATOS · PIPELINE ═════════════ */
function Candidatos({ cands, profiles, openCand, filtroPerfil, setFiltroPerfil }) {
  const [canal, setCanal] = useState("Todos");
  const [q, setQ] = useState("");
  const [vista, setVista] = useState("kanban");
  const list = cands.filter((c) => (filtroPerfil === "todos" || c.perfilId === filtroPerfil) && (canal === "Todos" || c.canal === canal) && (!q || c.nombre.toLowerCase().includes(q.toLowerCase())));
  const cols = [...STAGES, { id: "descartado", label: "Descartado", short: "Descartado" }];
  const sel = { border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", fontFamily: T.font, fontSize: 13.5, background: T.white, color: T.ink };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <H1 sub="Cada tarjeta avanza sola con el agente de WhatsApp, la evaluación del CV y el análisis de entrevista; el reclutador decide en los puntos marcados." right={
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, ...sel }}><Search size={14} color={T.slate} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar candidato" style={{ border: "none", outline: "none", fontFamily: T.font, fontSize: 13.5, width: 140 }} /></div>
          <select value={filtroPerfil} onChange={(e) => setFiltroPerfil(e.target.value)} style={sel}>
            <option value="todos">Todas las vacantes</option>
            {profiles.filter((p) => p.estado === "Activa").map((p) => <option key={p.id} value={p.id}>{clientOf(p).nombre} · {p.titulo.split(" (")[0]}</option>)}
          </select>
          <select value={canal} onChange={(e) => setCanal(e.target.value)} style={sel}>{["Todos", "Pandape", "Facebook", "LinkedIn", "Bolsa Prime"].map((c) => <option key={c}>{c}</option>)}</select>
          <div style={{ display: "inline-flex", border: `1px solid ${T.line}`, borderRadius: 8, overflow: "hidden" }}>
            {[["kanban", "Pipeline"], ["lista", "Lista"]].map(([k, l]) => <button key={k} type="button" onClick={() => setVista(k)} style={{ border: "none", padding: "8px 12px", fontFamily: T.font, fontSize: 13.5, fontWeight: 600, background: vista === k ? T.forest : T.white, color: vista === k ? "#fff" : T.slate, cursor: "pointer" }}>{l}</button>)}
          </div>
        </>
      }>Candidatos</H1>

      {vista === "kanban" ? (
        <div className="pr-scroll" style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12, flex: 1, alignItems: "flex-start" }}>
          {cols.map((s) => {
            const items = list.filter((c) => c.etapa === s.id);
            return (
              <div key={s.id} style={{ minWidth: 218, width: 218, background: s.id === "descartado" ? "#F3F1F0" : T.mint, borderRadius: 12, padding: 10, flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 4px 10px" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: s.id === "descartado" ? T.slate : T.forest }}>{s.label}</span>
                  <span className="pr-tnum" style={{ fontSize: 12, fontWeight: 600, color: T.slate, background: T.white, borderRadius: 999, padding: "1px 8px" }}>{items.length}</span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {items.map((c) => {
                    const sc = scoreCV(c);
                    const p = profileOf(c);
                    const fails = ["nuevo", "prefiltro", "cv"].includes(c.etapa) ? prefiltro(c).filter((r) => !r.ok).length : 0;
                    return (
                      <div key={c.id} className="pr-kcard" onClick={() => openCand(c.id)} style={{ background: T.white, borderRadius: 10, padding: "11px 12px", border: `1px solid ${T.line}`, opacity: s.id === "descartado" ? 0.75 : 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.3 }}>{c.nombre}</div>
                            <div style={{ fontSize: 12, color: T.slate, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.titulo.split(" (")[0]}</div>
                          </div>
                          <Ring value={sc} size={38} stroke={4} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                          <ChannelDot canal={c.canal} />
                          <span style={{ fontSize: 11.5, color: T.slate }}>{diasDesde(c.fecha) === 0 ? "hoy" : `${diasDesde(c.fecha)} d`}</span>
                        </div>
                        {(fails > 0 || c.etapa === "expediente" || (c.etapa === "psico" && !c.psico)) && (
                          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {fails > 0 && <Pill tone="warn" small><AlertTriangle size={11} /> {fails} fuera de perfil</Pill>}
                            {c.etapa === "expediente" && <Pill tone="info" small><FileText size={11} /> {docsProgress(c).ok}/{DOCS.length} docs</Pill>}
                            {c.etapa === "psico" && !c.psico && <Pill tone="info" small><Brain size={11} /> pendiente</Pill>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card pad={0}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr style={{ color: T.slate, fontSize: 12.5, textAlign: "left" }}>{["Candidato", "Vacante", "Canal", "Ingreso", "Prefiltro", "Score CV", "Etapa"].map((h) => <th key={h} style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, fontWeight: 600 }}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((c) => {
                const pf = prefiltro(c); const ok = pf.filter((r) => r.ok).length;
                return (
                  <tr key={c.id} className="pr-row" onClick={() => openCand(c.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${T.line}` }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{c.nombre}</td>
                    <td style={{ padding: "10px 14px", color: T.slate }}>{profileOf(c).titulo.split(" (")[0]}</td>
                    <td style={{ padding: "10px 14px" }}><ChannelDot canal={c.canal} /></td>
                    <td style={{ padding: "10px 14px", color: T.slate }}>{fmtDate(c.fecha)}</td>
                    <td className="pr-tnum" style={{ padding: "10px 14px", color: ok === pf.length ? T.leaf : T.amber, fontWeight: 600 }}>{ok}/{pf.length}</td>
                    <td className="pr-tnum" style={{ padding: "10px 14px", fontWeight: 600 }}>{scoreCV(c)}</td>
                    <td style={{ padding: "10px 14px" }}><StageChip etapa={c.etapa} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ───────────── conversación del agente ───────────── */
function waConversation(c) {
  const p = profileOf(c);
  const first = c.nombre.split(" ")[0];
  const pf = prefiltro(c);
  const answers = [
    `${c.edad} años`,
    `Vivo en ${c.zona}, más o menos ${c.traslado} minutos`,
    c.expMeses ? c.resumenCV.split(".")[0] : "No tengo experiencia en cobranza, pero sí en ventas",
    c.disponible ? "Sí, sin problema" : "Los sábados no puedo, tengo otro compromiso",
    c.expectativa <= p.reglas.expectativaMax ? `Sí, yo buscaba alrededor de $${c.expectativa.toLocaleString("es-MX")}` : `Yo buscaba $${c.expectativa.toLocaleString("es-MX")}, ¿hay forma de llegar a eso?`,
    c.escolaridad,
    "Sí, los tengo a la mano",
  ];
  const msgs = [
    { a: true, t: `Hola ${first}, soy Vale, asistente de Prime HR Innovation. Vi tu postulación a ${p.titulo.split(" (")[0]} por ${c.canal}. ¿Tienes dos minutos para unas preguntas rápidas?` },
    { a: false, t: "Sí, claro" },
  ];
  const n = c.etapa === "nuevo" ? 0 : c.etapa === "prefiltro" ? 5 : p.preguntas.length;
  for (let i = 0; i < n; i++) { msgs.push({ a: true, t: p.preguntas[i] }); msgs.push({ a: false, t: answers[i] }); }
  if (c.etapa === "nuevo") return { msgs, estado: "Esperando respuesta" };
  if (c.etapa === "prefiltro") {
    const fail = pf.find((r) => !r.ok);
    if (fail) msgs.push({ a: true, t: fail.q === "Expectativa" ? `Entiendo. La base es $${p.reglas.expectativaMax > 12000 ? "9,510" : "9,800"} pero con comisiones el promedio del equipo llega a $13,000. ¿Te gustaría continuar con esa referencia?` : `Gracias por decirme. Ese punto está fuera de lo que pide la vacante; un reclutador revisará tu caso y te escribe hoy mismo.` });
    return { msgs, estado: "Conversación en curso" };
  }
  if (c.etapa === "descartado") { msgs.push({ a: true, t: `Gracias ${first}. Por ahora la vacante pide ${c.motivo ? c.motivo.toLowerCase() : "otro perfil"}, así que no podemos avanzar en este proceso. Te tenemos en cuenta para otras vacantes de Prime.` }); return { msgs, estado: "Cerrada por regla del perfil" }; }
  msgs.push({ a: true, t: `Perfecto ${first}, cumples con el perfil. Te comparto el enlace para elegir el horario de tu entrevista por videollamada: prime.mx/agenda/${c.id}` });
  if (STAGE_IDX[c.etapa] >= STAGE_IDX.psico) msgs.push({ a: true, t: `Hola ${first}. Como siguiente paso te envío tu evaluación psicométrica. Tarda unos 50 minutos y puedes hacerla desde tu celular: psicotest.mx/e/${c.id}. Tienes hasta mañana a las 20:00.` });
  if (STAGE_IDX[c.etapa] >= STAGE_IDX.expediente) msgs.push({ a: true, t: `${first}, para armar tu expediente necesito fotos legibles de: INE por ambos lados, CURP, constancia de situación fiscal, número de seguro social y comprobante de domicilio. Mándamelas aquí mismo, una por una.` });
  return { msgs, estado: "Cerrada con éxito" };
}

/* ═════════════ EXPEDIENTE DEL CANDIDATO (panel lateral) ═════════════ */
function CandDrawer({ c, onClose, act, role }) {
  const [tab, setTab] = useState("resumen");
  if (!c) return null;
  const p = profileOf(c); const cl = clientOf(p);
  const sc = scoreCV(c); const pf = prefiltro(c); const fit = psicoFit(c); const dp = docsProgress(c);
  const wa = waConversation(c);
  const nextStage = STAGES[STAGE_IDX[c.etapa] + 1];
  const cliente = role === "cliente";
  const tabs = [["resumen", "Resumen"], ["whatsapp", "WhatsApp"], ["entrevista", "Entrevista"], ["psico", "Psicométrico"], ["expediente", "Expediente"]].filter(([k]) => !cliente || k !== "whatsapp");

  const Row = ({ label, children }) => <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, fontSize: 13.5, padding: "6px 0", borderBottom: `1px solid ${T.line}` }}><span style={{ color: T.slate }}>{label}</span><span>{children}</span></div>;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(14,70,50,.28)", zIndex: 40 }} />
      <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(620px, 100vw)", background: T.paper, zIndex: 50, boxShadow: "-12px 0 40px rgba(14,70,50,.18)", display: "flex", flexDirection: "column", fontFamily: T.font }}>
        <div style={{ background: T.white, borderBottom: `1px solid ${T.line}`, padding: "18px 22px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Ring value={sc} size={64} stroke={6} label="CV" />
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>{c.nombre}</div>
                <div style={{ fontSize: 13, color: T.slate, marginTop: 3 }}>{c.edad} años · {c.zona} · {c.traslado} min al centro de trabajo</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <StageChip etapa={c.etapa} />
                  <Pill small>{p.titulo.split(" (")[0]}</Pill>
                  <ChannelDot canal={c.canal} />
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: "none", background: T.mint, borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 14, overflowX: "auto" }}>
            {tabs.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === k ? T.leaf : "transparent"}`, padding: "8px 12px", fontFamily: T.font, fontSize: 13.5, fontWeight: 600, color: tab === k ? T.forest : T.slate, cursor: "pointer", whiteSpace: "nowrap" }}>{l}</button>
            ))}
          </div>
        </div>

        <div className="pr-scroll" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {tab === "resumen" && (
            <div style={{ display: "grid", gap: 14 }}>
              {c.notas && (
                <div style={{ background: T.leafSoft, borderRadius: 10, padding: "12px 14px", display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5, color: T.forest }}><Sparkles size={16} style={{ flexShrink: 0, marginTop: 2 }} /><div><strong>Nota de la IA.</strong> {c.notas}</div></div>
              )}
              {c.motivo && (
                <div style={{ background: T.redSoft, borderRadius: 10, padding: "12px 14px", display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5, color: T.red }}><X size={16} style={{ flexShrink: 0, marginTop: 2 }} /><div><strong>Descartado por el agente.</strong> {c.motivo}.</div></div>
              )}
              <Card pad={16} title="Puntuación del CV contra el perfil" right={<Pill small tone={sc >= p.umbral ? "ok" : "warn"}>{sc >= p.umbral ? `Pasa (umbral ${p.umbral})` : `Bajo umbral ${p.umbral}`}</Pill>}>
                {p.pesos.map((w) => (
                  <div key={w.k} style={{ display: "grid", gridTemplateColumns: "1fr 120px 36px", gap: 12, alignItems: "center", fontSize: 13.5, marginBottom: 8 }}>
                    <span>{w.label} <span style={{ color: T.slate, fontSize: 12 }}>({w.w}%)</span></span>
                    <Bar value={c.cv[w.k]} color={c.cv[w.k] >= 70 ? T.leaf : c.cv[w.k] >= 50 ? T.amber : T.red} />
                    <span className="pr-tnum" style={{ textAlign: "right", fontWeight: 600 }}>{c.cv[w.k]}</span>
                  </div>
                ))}
                <div style={{ fontSize: 13, color: T.slate, marginTop: 6, lineHeight: 1.5 }}>{c.resumenCV}</div>
              </Card>
              <Card pad={16} title="Prefiltro del agente" right={<Pill small tone={pf.every((r) => r.ok) ? "ok" : "warn"}>{pf.filter((r) => r.ok).length}/{pf.length} criterios</Pill>}>
                {pf.map((r) => (
                  <div key={r.q} style={{ display: "grid", gridTemplateColumns: "22px 110px 1fr", gap: 8, alignItems: "start", fontSize: 13.5, padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
                    {r.ok ? <Check size={16} color={T.leaf} /> : <X size={16} color={T.red} />}
                    <span style={{ color: T.slate }}>{r.q}</span>
                    <span>{r.a} <span style={{ color: T.slate, fontSize: 12 }}>· perfil: {r.req}</span></span>
                  </div>
                ))}
              </Card>
              <Card pad={16} title="Línea de tiempo">
                {[
                  { t: `${fmtDate(c.fecha)}`, txt: `Postulación recibida por ${c.canal}`, on: true },
                  { t: `${fmtDate(c.fecha)}`, txt: "El agente de WhatsApp inició el prefiltro", on: STAGE_IDX[c.etapa] >= 1 || c.etapa === "descartado" },
                  { t: "", txt: `CV evaluado: ${sc} puntos`, on: STAGE_IDX[c.etapa] >= 2 },
                  { t: c.entrevista ? fmtDate(c.entrevista.fecha.slice(0, 10)) : "", txt: c.entrevista ? `Entrevista Prime por ${c.entrevista.plataforma}, ${c.entrevista.estado.toLowerCase()} con Fireflies` : "Entrevista Prime", on: STAGE_IDX[c.etapa] >= 3 },
                  { t: c.psico ? fmtDate(c.psico.fecha) : "", txt: c.psico ? `Psicométrico Psicotest completado: ${fit.veredicto}` : "Psicométrico", on: STAGE_IDX[c.etapa] >= 4 },
                  { t: "", txt: `Expediente ${dp.ok}/${dp.total} documentos`, on: STAGE_IDX[c.etapa] >= 5 },
                  { t: "", txt: `Entrevista con ${cl.nombre}`, on: STAGE_IDX[c.etapa] >= 6 },
                  { t: c.contratadoEl ? fmtDate(c.contratadoEl) : "", txt: "Contratado", on: STAGE_IDX[c.etapa] >= 7 },
                ].map((s, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "14px 48px 1fr", gap: 10, alignItems: "center", padding: "5px 0", fontSize: 13.5, color: s.on ? T.ink : T.slate, opacity: s.on ? 1 : 0.6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.on ? T.leaf : T.line, display: "inline-block" }} />
                    <span className="pr-tnum" style={{ fontSize: 12, color: T.slate }}>{s.t}</span>
                    <span>{s.txt}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {tab === "whatsapp" && (
            <Card pad={0} title={null}>
              <div style={{ background: "#075E54", color: "#fff", padding: "12px 16px", borderRadius: "12px 12px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}><MessageCircle size={18} /><div><div style={{ fontWeight: 600, fontSize: 14 }}>Vale · Prime HR Innovation</div><div style={{ fontSize: 12, opacity: 0.85 }}>Agente en Whaapy · {wa.estado}</div></div></div>
                <Pill tone="wa" small>WhatsApp Business API</Pill>
              </div>
              <div style={{ background: "#ECE5DD", padding: 14, display: "grid", gap: 8, minHeight: 300 }}>
                {wa.msgs.map((m, i) => (
                  <div key={i} style={{ justifySelf: m.a ? "start" : "end", maxWidth: "82%", background: m.a ? "#fff" : "#DCF8C6", borderRadius: 10, padding: "8px 11px", fontSize: 13.5, lineHeight: 1.45, color: "#111", boxShadow: "0 1px 1px rgba(0,0,0,.08)" }}>{m.t}</div>
                ))}
              </div>
              <div style={{ padding: "10px 14px", fontSize: 12.5, color: T.slate, borderTop: `1px solid ${T.line}` }}>Cada respuesta se valida contra las reglas del perfil en el momento. El reclutador solo interviene cuando el agente marca una excepción.</div>
            </Card>
          )}

          {tab === "entrevista" && (
            c.entrevista ? (
              <div style={{ display: "grid", gap: 14 }}>
                <Card pad={16}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>Entrevista Prime · {c.entrevista.entrevistador}</div>
                      <div style={{ fontSize: 13, color: T.slate, marginTop: 3 }}>{c.entrevista.fecha} · {c.entrevista.plataforma} · {c.entrevista.duracion} · Fireflies {c.entrevista.fireflies}</div>
                    </div>
                    {c.entrevista.score != null ? <Ring value={c.entrevista.score} size={56} stroke={5} label="ENT" /> : <Pill tone="info" small>Análisis en proceso</Pill>}
                  </div>
                  {c.entrevista.resumen && <p style={{ fontSize: 14, lineHeight: 1.55, margin: "12px 0 0" }}>{c.entrevista.resumen}</p>}
                </Card>
                {c.entrevista.hallazgos.length > 0 && (
                  <Card pad={16} title="Evidencia contra el perfil de puesto">
                    {c.entrevista.hallazgos.map((h) => (
                      <div key={h.k} style={{ display: "grid", gridTemplateColumns: "22px 1fr", gap: 8, padding: "8px 0", borderBottom: `1px solid ${T.line}`, fontSize: 13.5 }}>
                        {h.ok ? <Check size={16} color={T.leaf} /> : <AlertTriangle size={16} color={T.amber} />}
                        <div><div style={{ fontWeight: 600 }}>{h.k}</div><div style={{ color: T.slate, marginTop: 2, lineHeight: 1.45 }}>{h.txt}</div></div>
                      </div>
                    ))}
                  </Card>
                )}
                {c.entrevista.transcript.length > 0 && (
                  <Card pad={16} title="Fragmentos de la transcripción">
                    {c.entrevista.transcript.map((t, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 10, fontSize: 13.5, padding: "6px 0", lineHeight: 1.5 }}>
                        <span className="pr-tnum" style={{ color: T.slate, fontSize: 12 }}>{t[0]}</span>
                        <span><strong style={{ color: t[1] === "Andrea" ? T.forest : T.blue }}>{t[1]}:</strong> {t[2]}</span>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            ) : (
              <Card pad={18}>
                <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>Sin entrevista todavía</div>
                <div style={{ fontSize: 13.5, color: T.slate, lineHeight: 1.55, marginBottom: 14 }}>Al agendar, el sistema crea la reunión en Google Meet o Zoom, envía la invitación al candidato por WhatsApp y agrega a Fireflies para grabar y transcribir. Cuando termine, la IA compara la conversación contra el perfil de puesto.</div>
                {!cliente && <Btn primary icon={CalendarClock} onClick={() => act("agendar", c)}>Agendar entrevista Prime</Btn>}
              </Card>
            )
          )}

          {tab === "psico" && (
            c.psico ? (
              <div style={{ display: "grid", gap: 14 }}>
                <Card pad={16}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>Psicotest · aplicado {fmtDate(c.psico.fecha)}</div>
                      <div style={{ fontSize: 13, color: T.slate, marginTop: 3 }}>Cacter, Ciesman, Cibain, Inceval y Coleibor · PDF leído por la IA</div>
                    </div>
                    <Pill tone={fit.veredicto === "Apto" ? "ok" : fit.veredicto === "Apto con reservas" ? "warn" : "bad"}>{fit.veredicto} · {fit.pct}%</Pill>
                  </div>
                </Card>
                <Card pad={16} title="Competencias (Coleibor) contra el mínimo del perfil">
                  {fit.rows.map((r) => (
                    <div key={r.k} style={{ display: "grid", gridTemplateColumns: "1fr 140px 60px", gap: 12, alignItems: "center", fontSize: 13.5, marginBottom: 8 }}>
                      <span>{r.k}</span>
                      <Bar value={r.v} color={r.ok ? T.leaf : T.amber} marker={r.min} />
                      <span className="pr-tnum" style={{ textAlign: "right", fontWeight: 600, color: r.ok ? T.ink : T.amber }}>{r.v}% <span style={{ fontSize: 11, color: T.slate, fontWeight: 500 }}>/{r.min}</span></span>
                    </div>
                  ))}
                  <div style={{ fontSize: 12.5, color: T.slate, marginTop: 4 }}>La marca negra es el mínimo que pide el perfil.</div>
                </Card>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                  <Card pad={16} title="Inteligencia (Ciesman)">
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><span className="pr-tnum" style={{ fontSize: 30, fontWeight: 600, color: T.forest }}>{c.psico.ci}</span><Pill small tone={c.psico.ci >= 100 ? "ok" : "warn"}>CI {c.psico.ciNivel}</Pill></div>
                    {c.psico.ciesmanBajos.length > 0 && <div style={{ fontSize: 13, marginTop: 8, color: T.amber }}>Bajos: {c.psico.ciesmanBajos.join(", ")}</div>}
                  </Card>
                  <Card pad={16} title="Confianza, honestidad y ética (Inceval)">
                    <Row label="Nivel de confianza">{c.psico.inceval.confianza}</Row>
                    <Row label="Honestidad">{c.psico.inceval.honestidad}</Row>
                    <Row label="Ética">{c.psico.inceval.etica}</Row>
                  </Card>
                  <Card pad={16} title="Personalidad (Cibain)">
                    {c.psico.cibainAltas.length > 0 && <div style={{ fontSize: 13.5, marginBottom: 6 }}><span style={{ color: T.leaf, fontWeight: 600 }}>Altas:</span> {c.psico.cibainAltas.join(", ")}</div>}
                    {c.psico.cibainBajas.length > 0 ? <div style={{ fontSize: 13.5 }}><span style={{ color: T.red, fontWeight: 600 }}>Bajas:</span> {c.psico.cibainBajas.join(", ")}</div> : <div style={{ fontSize: 13.5, color: T.slate }}>Sin escalas bajas.</div>}
                  </Card>
                  <Card pad={16} title="Comportamiento bajo presión (Cacter)"><div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{c.psico.cacter}</div></Card>
                </div>
              </div>
            ) : (
              <Card pad={18}>
                <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}>{c.etapa === "psico" ? "Psicométrico enviado, sin completar" : "Sin psicométrico todavía"}</div>
                <div style={{ fontSize: 13.5, color: T.slate, lineHeight: 1.55, marginBottom: 14 }}>El agente envía el enlace de Psicotest por WhatsApp y recuerda al candidato si no lo completa en 24 horas. Al terminar, el PDF entra al expediente y la IA lo compara con el perfil esperado.</div>
                {!cliente && <Btn primary icon={Brain} onClick={() => act("psico", c)}>{c.etapa === "psico" ? "Reenviar recordatorio" : "Enviar psicométrico"}</Btn>}
              </Card>
            )
          )}

          {tab === "expediente" && (
            <div style={{ display: "grid", gap: 14 }}>
              <Card pad={16} title="Documentos" right={<Pill small tone={dp.ok === dp.total ? "ok" : "info"}>{dp.ok}/{dp.total}</Pill>}>
                <Bar value={dp.pct} height={8} />
                <div style={{ height: 12 }} />
                {DOCS.map((d) => {
                  const s = c.docs[d.k] || "pend";
                  return (
                    <div key={d.k} style={{ display: "grid", gridTemplateColumns: "22px 1fr auto", gap: 10, alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${T.line}`, fontSize: 13.5 }}>
                      {s === "ok" ? <Check size={16} color={T.leaf} /> : s === "rev" ? <Clock size={16} color={T.amber} /> : <span style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${T.line}`, display: "inline-block", marginLeft: 1 }} />}
                      <span style={{ color: s === "pend" ? T.slate : T.ink }}>{d.label}</span>
                      {s === "ok" && <Pill small tone="ok">Validado</Pill>}
                      {s === "rev" && (!cliente ? <Btn small onClick={() => act("validar", c, d.k)}>Validar</Btn> : <Pill small tone="warn">En revisión</Pill>)}
                      {s === "pend" && <Pill small>Pendiente</Pill>}
                    </div>
                  );
                })}
              </Card>
              <Card pad={16} title="Datos del expediente">
                <Row label="Nombre completo">{c.nombre}</Row>
                <Row label="Edad">{c.edad} años</Row>
                <Row label="Domicilio">{c.zona}, CDMX</Row>
                <Row label="Escolaridad">{c.escolaridad}</Row>
                <Row label="Vacante">{p.titulo} · {cl.nombre}</Row>
                <Row label="Sueldo acordado">{c.etapa === "contratado" ? p.condiciones.sueldo.split(";")[0] : "Por confirmar en entrevista cliente"}</Row>
                <Row label="Hoja de confirmación">{c.docs.confirmacion === "ok" ? "Firmada" : "Se genera al completar documentos"}</Row>
              </Card>
              {!cliente && dp.ok < dp.total && <Btn icon={Paperclip} onClick={() => act("docs", c)}>Pedir documentos faltantes por WhatsApp</Btn>}
            </div>
          )}
        </div>

        {!cliente && c.etapa !== "descartado" && c.etapa !== "contratado" && (
          <div style={{ background: T.white, borderTop: `1px solid ${T.line}`, padding: "12px 20px", display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
            <Btn danger small icon={X} onClick={() => act("descartar", c)}>Descartar</Btn>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {c.etapa === "cv" && <Btn small icon={CalendarClock} onClick={() => act("agendar", c)}>Agendar entrevista</Btn>}
              {c.etapa === "entrevista_prime" && !c.psico && <Btn small icon={Brain} onClick={() => act("psico", c)}>Enviar psicométrico</Btn>}
              {c.etapa === "expediente" && <Btn small icon={Send} onClick={() => act("enviarCliente", c)}>Enviar a {cl.nombre}</Btn>}
              {nextStage && <Btn primary small icon={ArrowRight} onClick={() => act("avanzar", c)}>{nextStage.id === "contratado" ? "Marcar contratado" : `Avanzar a ${nextStage.label}`}</Btn>}
            </div>
          </div>
        )}
        {cliente && c.etapa === "entrevista_cliente" && (
          <div style={{ background: T.white, borderTop: `1px solid ${T.line}`, padding: "12px 20px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn small danger icon={X} onClick={() => act("descartar", c)}>No continuar</Btn>
            <Btn primary small icon={Check} onClick={() => act("vobo", c)}>Dar Vo.Bo. de contratación</Btn>
          </div>
        )}
      </aside>
    </>
  );
}

/* ═════════════ ENTREVISTAS ═════════════ */
function Entrevistas({ cands, interviews, openCand }) {
  const groups = [["Hoy", (e) => e.fecha === HOY], ["Mañana", (e) => e.fecha === "2026-09-11"], ["Realizadas", (e) => e.fecha < HOY]];
  const estadoTone = { Programada: "info", Grabando: "warn", Transcrita: "warn", Analizada: "ok" };
  return (
    <div>
      <H1 sub="Cada cita crea la reunión, invita al candidato por WhatsApp y suma a Fireflies para transcribir y analizar contra el perfil.">Entrevistas</H1>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 16 }}>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          {groups.map(([g, fn]) => {
            const items = interviews.filter(fn).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
            if (!items.length) return null;
            return (
              <Card key={g} title={g} pad={16}>
                {items.map((e) => {
                  const c = cands.find((x) => x.id === e.candId);
                  const p = profileOf(c);
                  return (
                    <div key={e.id} className="pr-row" onClick={() => openCand(c.id, "entrevista")} style={{ display: "grid", gridTemplateColumns: "82px 1fr auto auto", gap: 14, alignItems: "center", padding: "10px 8px", borderRadius: 8, cursor: "pointer", borderBottom: `1px solid ${T.line}` }}>
                      <div><div className="pr-tnum" style={{ fontWeight: 600, color: T.forest }}>{e.hora}</div><div style={{ fontSize: 12, color: T.slate }}>{fmtDate(e.fecha)}</div></div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nombre}</div>
                        <div style={{ fontSize: 12.5, color: T.slate }}>{p.titulo.split(" (")[0]} · {e.tipo} · {e.entrevistador}</div>
                      </div>
                      <Pill small tone="info"><Video size={12} /> {e.plataforma}</Pill>
                      <Pill small tone={estadoTone[e.estado] || "neutral"}>Fireflies · {e.estado === "Programada" ? "invitado" : e.estado.toLowerCase()}</Pill>
                    </div>
                  );
                })}
              </Card>
            );
          })}
        </div>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Card title="Qué pasa al agendar">
            {[["Google Calendar", "Crea la reunión de Meet o Zoom y bloquea la agenda del reclutador."], ["WhatsApp", "El agente envía la invitación y confirma asistencia un día antes."], ["Fireflies", "Se une a la llamada, graba y transcribe en español."], ["IA de Prime", "Busca evidencia de cada requisito del perfil y puntúa la entrevista."], ["Expediente", "Resumen, hallazgos y transcripción quedan en la ficha del candidato."]].map(([k, v]) => (
              <div key={k} style={{ marginBottom: 10 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{k}</div><div style={{ fontSize: 13, color: T.slate, lineHeight: 1.45 }}>{v}</div></div>
            ))}
          </Card>
          <Card title="Esta semana">
            <Field label="Entrevistas realizadas">{interviews.filter((e) => e.fecha < HOY).length}</Field>
            <div style={{ height: 8 }} />
            <Field label="Programadas">{interviews.filter((e) => e.fecha >= HOY).length}</Field>
            <div style={{ height: 8 }} />
            <Field label="Duración promedio">28 min</Field>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ═════════════ REPORTES ═════════════ */
function EmailFrame({ para, asunto, children, cuando }) {
  return (
    <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "14px 22px", borderBottom: `1px solid ${T.line}`, background: T.paper, fontSize: 13 }}>
        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 6 }}>
          <span style={{ color: T.slate }}>Para</span><span>{para}</span>
          <span style={{ color: T.slate }}>Asunto</span><span style={{ fontWeight: 600 }}>{asunto}</span>
          <span style={{ color: T.slate }}>Envío</span><span>{cuando}</span>
        </div>
      </div>
      <div style={{ padding: "22px 26px", fontSize: 14, lineHeight: 1.6, color: T.ink, maxWidth: 720 }}>{children}</div>
    </div>
  );
}

function ReporteDiarioInterno({ cands, profiles }) {
  const act = profiles.filter((p) => p.estado === "Activa");
  const cnt = (pid, st) => cands.filter((c) => c.perfilId === pid && c.etapa === st).length;
  return (
    <EmailFrame para="equipo@primehrinnovation.com.mx" asunto="Resumen del día · jueves 10 de septiembre" cuando="Diario a las 18:00, automático">
      <p style={{ marginTop: 0 }}>Hola equipo, así cerró el día en las {act.length} vacantes activas:</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, margin: "8px 0 16px" }}>
        <thead><tr style={{ color: T.slate, textAlign: "left" }}>{["Vacante", "Nuevos", "Prefiltro", "CV ok", "Entrev.", "Psico", "Exped.", "Cliente", "Contr."].map((h, i) => <th key={h} style={{ padding: "6px 8px", borderBottom: `1px solid ${T.line}`, fontWeight: 600, textAlign: i ? "right" : "left" }}>{h}</th>)}</tr></thead>
        <tbody>
          {act.map((p) => (
            <tr key={p.id}><td style={{ padding: "7px 8px", borderBottom: `1px solid ${T.line}` }}>{clientOf(p).nombre} · {p.titulo.split(" (")[0]}</td>
              {STAGES.map((s) => <td key={s.id} className="pr-tnum" style={{ padding: "7px 8px", borderBottom: `1px solid ${T.line}`, textAlign: "right", fontWeight: s.id === "contratado" && cnt(p.id, s.id) ? 600 : 400 }}>{cnt(p.id, s.id)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Requieren decisión del reclutador</p>
      <ul style={{ margin: "0 0 16px", paddingLeft: 20 }}>
        <li>Jorge Alberto Mendoza (Cobranza): traslado de 70 min, citado a entrevista mañana 10:00 por decisión de Andrea.</li>
        <li>Fernando Ochoa (Cobranza): expectativa de $14,500; el agente explicó el esquema de comisiones, sin respuesta desde las 15:20.</li>
        <li>Diana Laura Hernández (Cobranza): psicométrico enviado ayer, sin completar; recordatorio programado 9:00.</li>
        <li>Mariana Cortés (Cobranza): expediente 7/10; faltan cartas de recomendación y hoja de confirmación.</li>
      </ul>
      <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Mañana</p>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        <li>10:00 Entrevista Prime · Jorge Alberto Mendoza · Zoom</li>
        <li>13:00 Entrevista cliente · Luis Ángel Ramírez con Supervisor de cobranza de Telasist · Meet</li>
        <li>18:00 Se envía a Telasist la lista de candidatos que avanzaron.</li>
      </ul>
    </EmailFrame>
  );
}

function ReporteDiarioCliente({ cands, profiles, cl }) {
  const ps = profiles.filter((p) => p.clientId === cl.id && p.estado === "Activa");
  const lista = cands.filter((c) => ps.some((p) => p.id === c.perfilId) && STAGE_IDX[c.etapa] >= STAGE_IDX.psico && c.etapa !== "contratado");
  const next = { psico: "Completando psicométrico", expediente: "Integrando expediente", entrevista_cliente: "Listo para entrevista con ustedes" };
  return (
    <EmailFrame para={`${cl.email} (${cl.contacto})`} asunto={`Candidatos que avanzaron hoy · ${cl.nombre}`} cuando={`${cl.reporteDiario}, automático`}>
      <p style={{ marginTop: 0 }}>Hola {cl.contacto.split(" ")[0]}, estos candidatos ya pasaron la entrevista con Prime y siguen en proceso para sus vacantes:</p>
      {ps.map((p) => {
        const items = lista.filter((c) => c.perfilId === p.id);
        if (!items.length) return null;
        return (
          <div key={p.id} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 14.5, paddingBottom: 6, borderBottom: `2px solid ${T.leafSoft}`, marginBottom: 8 }}>{p.titulo} · {items.length} candidato{items.length > 1 ? "s" : ""}</div>
            {items.map((c) => {
              const fit = psicoFit(c); const dp = docsProgress(c);
              return (
                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 12, padding: "8px 0", borderBottom: `1px solid ${T.line}` }}>
                  <Ring value={scoreCV(c)} size={44} stroke={4} />
                  <div style={{ fontSize: 13.5 }}>
                    <div style={{ fontWeight: 600 }}>{c.nombre} <span style={{ fontWeight: 400, color: T.slate }}>· {c.edad} años · {c.expMeses} meses de experiencia</span></div>
                    <div style={{ color: T.slate, marginTop: 2 }}>
                      {c.entrevista?.score != null ? `Entrevista ${c.entrevista.score}/100` : "Entrevista pendiente"} · {fit ? `Psicométrico: ${fit.veredicto}` : "Psicométrico pendiente"} · Expediente {dp.ok}/{dp.total}
                    </div>
                    <div style={{ marginTop: 3 }}><Pill small tone={c.etapa === "entrevista_cliente" ? "ok" : "info"}>{next[c.etapa]}</Pill></div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <p style={{ margin: 0, color: T.slate, fontSize: 13 }}>Puedes ver el expediente completo de cada uno en el portal: prime.mx/portal/telasist</p>
    </EmailFrame>
  );
}

function ReporteSemanal({ cands, profiles, cl, compact }) {
  const ps = profiles.filter((p) => p.clientId === cl.id && p.estado === "Activa");
  const cs = cands.filter((c) => ps.some((p) => p.id === c.perfilId));
  const contratados = cs.filter((c) => c.etapa === "contratado");
  const funnel = STAGES.map((s) => ({ name: s.short, n: cs.filter((c) => STAGE_IDX[c.etapa] >= STAGE_IDX[s.id]).length }));
  const canal = ["Pandape", "Facebook", "LinkedIn", "Bolsa Prime"].map((k) => ({ canal: k, candidatos: cs.filter((c) => c.canal === k).length, avanzaron: cs.filter((c) => c.canal === k && STAGE_IDX[c.etapa] >= STAGE_IDX.entrevista_prime).length }));
  const edadProm = contratados.length ? Math.round(contratados.reduce((a, c) => a + c.edad, 0) / contratados.length) : 0;
  const expProm = contratados.length ? Math.round(contratados.reduce((a, c) => a + c.expMeses, 0) / contratados.length) : 0;
  const tip = { borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5 };
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {!compact && (
        <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, padding: "14px 22px", fontSize: 13 }}>
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 6 }}>
            <span style={{ color: T.slate }}>Para</span><span>{cl.email} ({cl.contacto})</span>
            <span style={{ color: T.slate }}>Asunto</span><span style={{ fontWeight: 600 }}>Reporte semanal de reclutamiento · semana 37 · {cl.nombre}</span>
            <span style={{ color: T.slate }}>Envío</span><span>{cl.reporteSemanal}, automático, con PDF adjunto</span>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Stat label="Candidatos nuevos" value={cs.filter((c) => diasDesde(c.fecha) <= 7).length} hint="7 al 10 de septiembre" />
        <Stat label="Entrevistas Prime" value={cs.filter((c) => c.entrevista).length} hint="Realizadas y analizadas" />
        <Stat label="Listos para ustedes" value={cs.filter((c) => c.etapa === "entrevista_cliente").length} hint="Con expediente y psicométrico" />
        <Stat label="Contratados" value={contratados.length} hint={`${ps.reduce((a, p) => a + p.vacantes, 0)} vacantes abiertas`} />
        <Stat label="Días a contratación" value={9} hint="Promedio, de postulación a firma" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <Card title="Embudo acumulado">
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke={T.line} />
                <XAxis dataKey="name" tick={{ fontSize: 11.5, fill: T.slate }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11.5, fill: T.slate }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: T.mint }} contentStyle={tip} />
                <Bar dataKey="n" name="Candidatos" radius={[6, 6, 0, 0]}>{funnel.map((_, i) => <Cell key={i} fill={i === funnel.length - 1 ? T.forest : T.leaf} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Canal de origen">
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={canal} margin={{ left: -20, right: 8, top: 8 }} barGap={2}>
                <CartesianGrid vertical={false} stroke={T.line} />
                <XAxis dataKey="canal" tick={{ fontSize: 11.5, fill: T.slate }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11.5, fill: T.slate }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: T.mint }} contentStyle={tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="candidatos" name="Postulados" fill="#A9D8BC" radius={[6, 6, 0, 0]} />
                <Bar dataKey="avanzaron" name="Pasaron entrevista Prime" fill={T.forest} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <Card title="Perfil de quien se contrató">
          <div style={{ display: "grid", gap: 8 }}>
            <Field label="Edad promedio">{edadProm} años</Field>
            <Field label="Experiencia promedio">{expProm} meses</Field>
            <Field label="Escolaridad">Bachillerato ({contratados.filter((c) => c.escolaridad === "Bachillerato").length} de {contratados.length})</Field>
            <Field label="Canal más efectivo">Bolsa Prime y LinkedIn</Field>
            <Field label="Score CV promedio">{contratados.length ? Math.round(contratados.reduce((a, c) => a + scoreCV(c), 0) / contratados.length) : 0}</Field>
          </div>
        </Card>
        <Card title="Estado por vacante">
          {ps.map((p) => {
            const pc = cs.filter((c) => c.perfilId === p.id); const cont = pc.filter((c) => c.etapa === "contratado").length;
            return (
              <div key={p.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 }}><span style={{ fontWeight: 600 }}>{p.titulo.split(" (")[0]}</span><span className="pr-tnum" style={{ color: T.slate }}>{cont}/{p.vacantes} cubiertas · {pc.filter((c) => !["descartado", "contratado"].includes(c.etapa)).length} en proceso</span></div>
                <Bar value={cont} max={p.vacantes} />
              </div>
            );
          })}
        </Card>
        <Card title="Siguientes pasos">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.65 }}>
            <li>Entrevista con su supervisor de cobranza: Luis Ángel Ramírez, viernes 13:00.</li>
            <li>Héctor Guzmán espera fecha de entrevista para cabina; expediente completo.</li>
            <li>Mariana Cortés completa expediente este viernes; psicométrico con reservas, sugerimos pregunta dirigida sobre priorización de cartera.</li>
            <li>Telemarketing: 2 candidatos en entrevista Prime; esperamos enviarles 2 perfiles la próxima semana.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ReporteBI() {
  const tip = { borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 12.5 };
  const conv = BI_CANAL.map((c) => ({ ...c, conversion: Math.round((c.contratados / c.candidatos) * 1000) / 10 }));
  const ret = BI_RETENCION.map((r) => ({ ...r, pct: Math.round((r.permanecen90 / r.contratados) * 100) }));
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ fontSize: 13.5, color: T.slate }}>Histórico Telasist, junio a agosto de 2026: 375 postulantes, 29 contratados. Correlaciona canal, puntuación y psicométrico con lo que realmente se contrató y permaneció.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <Card title="Conversión a contratación por canal">
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conv} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke={T.line} />
                <XAxis dataKey="canal" tick={{ fontSize: 11.5, fill: T.slate }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11.5, fill: T.slate }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip cursor={{ fill: T.mint }} contentStyle={tip} formatter={(v) => `${v}%`} />
                <Bar dataKey="conversion" name="Conversión" fill={T.leaf} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 8 }}>
            <thead><tr style={{ color: T.slate, textAlign: "left" }}>{["Canal", "Postulados", "Pasan prefiltro", "Contratados", "Días"].map((h, i) => <th key={h} style={{ padding: "5px 6px", borderBottom: `1px solid ${T.line}`, fontWeight: 600, textAlign: i ? "right" : "left" }}>{h}</th>)}</tr></thead>
            <tbody>{BI_CANAL.map((r) => <tr key={r.canal}><td style={{ padding: "5px 6px" }}>{r.canal}</td><td className="pr-tnum" style={{ padding: "5px 6px", textAlign: "right" }}>{r.candidatos}</td><td className="pr-tnum" style={{ padding: "5px 6px", textAlign: "right" }}>{r.prefiltroOK}%</td><td className="pr-tnum" style={{ padding: "5px 6px", textAlign: "right" }}>{r.contratados}</td><td className="pr-tnum" style={{ padding: "5px 6px", textAlign: "right" }}>{r.dias}</td></tr>)}</tbody>
          </table>
        </Card>
        <Card title="Permanencia a 90 días según score de CV">
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ret} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke={T.line} />
                <XAxis dataKey="rango" tick={{ fontSize: 11.5, fill: T.slate }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11.5, fill: T.slate }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                <Tooltip cursor={{ fill: T.mint }} contentStyle={tip} formatter={(v) => `${v}%`} />
                <Bar dataKey="pct" name="Permanecen 90 días" radius={[6, 6, 0, 0]}>{ret.map((r, i) => <Cell key={i} fill={r.pct >= 80 ? T.forest : r.pct >= 60 ? T.leaf : T.amber} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 13, color: T.slate, marginTop: 8, lineHeight: 1.5 }}>Los contratados con score de 80 o más permanecen 92%; los de menos de 70, solo 33%. El umbral actual de 70 deja pasar perfiles que rotan.</div>
        </Card>
        <Card title="Semanas: volumen contra resultado">
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={BI_SEMANAS} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke={T.line} />
                <XAxis dataKey="semana" tick={{ fontSize: 11.5, fill: T.slate }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11.5, fill: T.slate }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="nuevos" name="Postulados" stroke="#A9D8BC" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="entrevistas" name="Entrevistas" stroke={T.leaf} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="contratados" name="Contratados" stroke={T.forest} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Por qué se descartan en prefiltro">
          {BI_MOTIVOS.map((m) => (
            <div key={m.motivo} style={{ display: "grid", gridTemplateColumns: "1fr 120px 36px", gap: 12, alignItems: "center", fontSize: 13.5, marginBottom: 9 }}>
              <span>{m.motivo}</span><Bar value={m.n} max={40} color={T.amber} /><span className="pr-tnum" style={{ textAlign: "right", fontWeight: 600 }}>{m.n}</span>
            </div>
          ))}
          <div style={{ fontSize: 13, color: T.slate, marginTop: 6, lineHeight: 1.5 }}>132 descartes automáticos en el trimestre; el agente los resolvió sin tiempo del reclutador.</div>
        </Card>
      </div>
      <Card title="Áreas de mejora detectadas" right={<Pill small tone="ok"><Sparkles size={12} /> Generado por la IA cada lunes</Pill>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {[
            ["Publicación de Cobranza", "38 descartes por sábados y 31 por traslado. Poner el horario y la zona en el primer renglón del anuncio en Pandape reduce postulaciones que no van a pasar."],
            ["Mezcla de canales", "Pandape trae 57% del volumen con 6.5% de conversión; LinkedIn y Bolsa Prime traen 17% del volumen y 38% de los contratados. Conviene mover presupuesto de Facebook a LinkedIn para perfiles con experiencia."],
            ["Umbral del perfil", "Subir el umbral de Cobranza de 70 a 75 habría evitado 4 de las 6 bajas tempranas del trimestre sin perder ninguna contratación que permaneció."],
            ["Psicométrico", "Los contratados que rotaron antes de 90 días tenían Tolerancia a la presión menor a 60 en Coleibor. Sugerimos volverlo criterio de bloqueo para Cobranza y Cabina."],
            ["Formato del perfil", "Los perfiles con expectativa salarial máxima definida descartan 22% menos en entrevista cliente. Hacer obligatorio ese campo en el levantamiento."],
            ["Tiempo de proceso", "De postulación a contratación: 9 días con LinkedIn, 13 con Facebook. El cuello está en completar el psicométrico (1.8 días promedio); el recordatorio a las 12 horas lo baja a 1.1."],
          ].map(([k, v]) => (
            <div key={k} style={{ borderTop: `2px solid ${T.leafSoft}`, paddingTop: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{k}</div>
              <div style={{ fontSize: 13.5, color: T.slate, lineHeight: 1.5 }}>{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Reportes({ cands, profiles, role }) {
  const [tab, setTab] = useState("interno");
  const cl = CLIENTS[0];
  const tabs = [["interno", "Resumen diario interno"], ["cliente", "Diario a Telasist"], ["semanal", "Semanal a Telasist"], ["bi", "Inteligencia interna"]].filter(([k]) => role !== "reclutador" || k !== "bi");
  return (
    <div>
      <H1 sub="Los tres correos salen solos. La inteligencia interna cruza canal, puntuación y psicométrico con contrataciones y permanencia.">Reportes</H1>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: `1px solid ${T.line}`, overflowX: "auto" }}>
        {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === k ? T.leaf : "transparent"}`, padding: "8px 12px", fontFamily: T.font, fontSize: 14, fontWeight: 600, color: tab === k ? T.forest : T.slate, cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap" }}>{l}</button>)}
      </div>
      {tab === "interno" && <ReporteDiarioInterno cands={cands} profiles={profiles} />}
      {tab === "cliente" && <ReporteDiarioCliente cands={cands} profiles={profiles} cl={cl} />}
      {tab === "semanal" && <ReporteSemanal cands={cands} profiles={profiles} cl={cl} />}
      {tab === "bi" && <ReporteBI />}
    </div>
  );
}

/* ═════════════ PORTAL DEL CLIENTE ═════════════ */
function Portal({ cands, profiles, openCand, interviews }) {
  const cl = CLIENTS[0];
  const [tab, setTab] = useState("vacantes");
  const ps = profiles.filter((p) => p.clientId === cl.id && p.estado === "Activa");
  const vis = cands.filter((c) => ps.some((p) => p.id === c.perfilId) && STAGE_IDX[c.etapa] >= STAGE_IDX.psico);
  return (
    <div>
      <div style={{ background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: T.forest, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>T</div>
          <div><div style={{ fontWeight: 600, fontSize: 17 }}>{cl.nombre} · Portal de reclutamiento</div><div style={{ fontSize: 13, color: T.slate }}>Acceso de {cl.contacto}, {cl.puesto}. Solo lectura, con Vo.Bo. en entrevista cliente.</div></div>
        </div>
        <Pill tone="ok" small><ShieldCheck size={12} /> Datos de candidatos protegidos conforme a la LFPDPPP</Pill>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: `1px solid ${T.line}` }}>
        {[["vacantes", "Mis vacantes"], ["candidatos", `Candidatos (${vis.length})`], ["semanal", "Reporte semanal"]].map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} style={{ background: "none", border: "none", borderBottom: `2px solid ${tab === k ? T.leaf : "transparent"}`, padding: "8px 12px", fontFamily: T.font, fontSize: 14, fontWeight: 600, color: tab === k ? T.forest : T.slate, cursor: "pointer", marginBottom: -1 }}>{l}</button>)}
      </div>
      {tab === "vacantes" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
          {ps.map((p) => {
            const pc = cands.filter((c) => c.perfilId === p.id); const cont = pc.filter((c) => c.etapa === "contratado").length;
            const prox = interviews.filter((e) => e.tipo === "Entrevista cliente" && pc.some((c) => c.id === e.candId));
            return (
              <Card key={p.id} title={p.titulo} right={<Pill small tone="ok">{cont}/{p.vacantes} cubiertas</Pill>}>
                <Bar value={cont} max={p.vacantes} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14, fontSize: 13 }}>
                  <div><div className="pr-tnum" style={{ fontWeight: 600, fontSize: 20 }}>{pc.filter((c) => !["descartado", "contratado"].includes(c.etapa)).length}</div><div style={{ color: T.slate }}>en proceso</div></div>
                  <div><div className="pr-tnum" style={{ fontWeight: 600, fontSize: 20 }}>{pc.filter((c) => c.etapa === "entrevista_cliente").length}</div><div style={{ color: T.slate }}>listos para ustedes</div></div>
                  <div><div className="pr-tnum" style={{ fontWeight: 600, fontSize: 20 }}>{prox.length}</div><div style={{ color: T.slate }}>entrevistas agendadas</div></div>
                </div>
                {prox.map((e) => <div key={e.id} style={{ marginTop: 10, fontSize: 13, background: T.mint, borderRadius: 8, padding: "8px 10px" }}><Clock size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{fmtDate(e.fecha)} {e.hora} · {cands.find((c) => c.id === e.candId).nombre} · {e.plataforma}</div>)}
              </Card>
            );
          })}
        </div>
      )}
      {tab === "candidatos" && (
        <Card pad={0}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr style={{ color: T.slate, fontSize: 12.5, textAlign: "left" }}>{["Candidato", "Vacante", "Score CV", "Entrevista Prime", "Psicométrico", "Expediente", "Etapa"].map((h) => <th key={h} style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, fontWeight: 600 }}>{h}</th>)}</tr></thead>
            <tbody>
              {vis.sort((a, b) => STAGE_IDX[b.etapa] - STAGE_IDX[a.etapa]).map((c) => {
                const fit = psicoFit(c); const dp = docsProgress(c);
                return (
                  <tr key={c.id} className="pr-row" onClick={() => openCand(c.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${T.line}` }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{c.nombre}<div style={{ fontSize: 12, color: T.slate, fontWeight: 400 }}>{c.edad} años · {c.expMeses} meses de experiencia</div></td>
                    <td style={{ padding: "10px 14px", color: T.slate }}>{profileOf(c).titulo.split(" (")[0]}</td>
                    <td className="pr-tnum" style={{ padding: "10px 14px", fontWeight: 600 }}>{scoreCV(c)}</td>
                    <td className="pr-tnum" style={{ padding: "10px 14px" }}>{c.entrevista?.score != null ? c.entrevista.score : <span style={{ color: T.slate }}>Pendiente</span>}</td>
                    <td style={{ padding: "10px 14px" }}>{fit ? <Pill small tone={fit.veredicto === "Apto" ? "ok" : fit.veredicto === "Apto con reservas" ? "warn" : "bad"}>{fit.veredicto}</Pill> : <span style={{ color: T.slate }}>Pendiente</span>}</td>
                    <td className="pr-tnum" style={{ padding: "10px 14px" }}>{dp.ok}/{dp.total}</td>
                    <td style={{ padding: "10px 14px" }}><StageChip etapa={c.etapa} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {tab === "semanal" && <ReporteSemanal cands={cands} profiles={profiles} cl={cl} compact />}
    </div>
  );
}

/* ═════════════ APP ═════════════ */
const ROLES = {
  admin: { nombre: "Andrea Lugo", rol: "Administradora · Prime", tabs: ["tablero", "clientes", "perfiles", "candidatos", "entrevistas", "reportes", "portal"] },
  reclutador: { nombre: "Roberto Ávila", rol: "Reclutador · Prime", tabs: ["tablero", "perfiles", "candidatos", "entrevistas", "reportes"] },
  cliente: { nombre: "Verónica Salinas", rol: "Telasist · Cliente", tabs: ["portal"] },
};
const NAV = {
  tablero: ["Tablero", LayoutDashboard], clientes: ["Clientes", Building2], perfiles: ["Perfiles de puesto", ClipboardList],
  candidatos: ["Candidatos", Users], entrevistas: ["Entrevistas", CalendarClock], reportes: ["Reportes", BarChart3], portal: ["Portal del cliente", Globe],
};

function PrimeDemo({ onBack }) {
  const [role, setRole] = useState("admin");
  const [tab, setTab] = useState("tablero");
  const [cands, setCands] = useState(CANDIDATES);
  const [profiles, setProfiles] = useState(PROFILES);
  const [interviews, setInterviews] = useState(INTERVIEWS);
  const [selClient, setSelClient] = useState(null);
  const [selProfile, setSelProfile] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [drawerKey, setDrawerKey] = useState(0);
  const [levant, setLevant] = useState(null); // undefined = cerrado, otro = clientId|null
  const [filtroPerfil, setFiltroPerfil] = useState("todos");
  const [toast, setToast] = useState("");
  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 3200); };

  const openCand = (id) => { setDrawer(id); setDrawerKey((k) => k + 1); };
  const openProfile = (id) => { setSelProfile(id); setTab("perfiles"); };
  const go = (t) => { setTab(t); setSelClient(null); setSelProfile(null); setLevant(null); };
  const changeRole = (r) => { setRole(r); setTab(ROLES[r].tabs[0]); setSelClient(null); setSelProfile(null); setDrawer(null); setLevant(null); };
  const update = (id, fn) => setCands((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));

  const act = (type, c, extra) => {
    const next = STAGES[STAGE_IDX[c.etapa] + 1];
    if (type === "avanzar" && next) { update(c.id, (x) => ({ ...x, etapa: next.id, contratadoEl: next.id === "contratado" ? HOY : x.contratadoEl })); notify(next.id === "contratado" ? `${c.nombre.split(" ")[0]} marcado como contratado. Telasist recibe la confirmación hoy a las 18:00.` : `${c.nombre.split(" ")[0]} pasó a ${next.label.toLowerCase()}`); }
    if (type === "descartar") { update(c.id, (x) => ({ ...x, etapa: "descartado", motivo: x.motivo || "Decisión del reclutador" })); notify("Candidato descartado. El agente le avisa por WhatsApp."); setDrawer(null); }
    if (type === "agendar") {
      setInterviews((es) => [...es, { id: `e${es.length + 1}`, candId: c.id, fecha: "2026-09-11", hora: "12:00", tipo: "Entrevista Prime", plataforma: "Google Meet", estado: "Programada", fireflies: "Invitado a la reunión", entrevistador: `${ROLES[role].nombre} (Prime)` }]);
      if (c.etapa === "cv") update(c.id, (x) => ({ ...x, etapa: "entrevista_prime" }));
      notify("Reunión de Meet creada para mañana 12:00, Fireflies invitado y confirmación enviada por WhatsApp.");
    }
    if (type === "psico") { if (c.etapa === "entrevista_prime") update(c.id, (x) => ({ ...x, etapa: "psico" })); notify("Enlace de Psicotest enviado por WhatsApp. Recordatorio automático en 12 horas."); }
    if (type === "docs") notify("El agente pidió los documentos faltantes por WhatsApp.");
    if (type === "validar") { update(c.id, (x) => ({ ...x, docs: { ...x.docs, [extra]: "ok" } })); notify("Documento validado y guardado en el expediente."); }
    if (type === "enviarCliente") { update(c.id, (x) => ({ ...x, etapa: "entrevista_cliente" })); notify(`Enviado a Telasist con expediente, psicométrico y análisis de entrevista.`); }
    if (type === "vobo") { update(c.id, (x) => ({ ...x, etapa: "contratado", contratadoEl: HOY })); notify("Vo.Bo. registrado. Prime recibe la notificación y genera el contrato."); setDrawer(null); }
  };

  const generarPerfil = (f) => {
    const clId = CLIENTS.find((k) => k.nombre === f.empresa)?.id || "orange";
    const existing = profiles.find((p) => p.clientId === clId && p.titulo === f.titulo);
    const gen = {
      estado: "Activa", titulo: f.titulo, vacantes: parseInt(f.vacantes) || 1, zona: f.zona, objetivo: f.objetivo,
      especificaciones: { edad: f.edad, sexo: f.sexo, estadoCivil: f.estadoCivil, hijos: f.hijos, residencia: f.residencia },
      requisitos: { escolaridad: f.escolaridad, experiencia: f.experiencia, conocimientos: f.conocimientos, idiomas: "No requeridos", sistemas: f.conocimientos.split(";")[0] },
      actividades: f.actividades.split("\n").filter(Boolean),
      condiciones: { sueldo: f.sueldo || "Por confirmar con el cliente", prestaciones: f.prestaciones, horario: [f.dias, f.horario].filter(Boolean).join(" ") || "Por confirmar con el cliente", modalidad: f.modalidad || "Por confirmar", viajar: "No aplica", personalACargo: f.personal, herramientas: f.herramientas || "Por confirmar" },
      competenciasFuncionales: f.competencias.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4).map((c) => ({ c, n: "Avanzado" })),
      competenciasLiderazgo: [], competenciasLaborales: undefined, relaciones: [], reportaA: "Por definir con el cliente",
      proceso: ["Publicación de la vacante", "Filtrado de CVs con IA", "Prefiltro por WhatsApp", "Entrevista Prime", "Psicométrico", "Expediente", "Entrevista con el cliente", "Firma de contrato"],
      reglas: { edadMin: 25, edadMax: 40, trasladoMax: 75, expMin: 24, expectativaMax: 25000, horario: f.horario || "por confirmar" },
      pesos: [{ k: "experiencia", label: "Experiencia en diseño industrial", w: 30 }, { k: "escolaridad", label: "Escolaridad", w: 15 }, { k: "disponibilidad", label: "Edad, zona y disponibilidad", w: 15 }, { k: "habilidades", label: "Software y procesos", w: 25 }, { k: "competencias", label: "Competencias del puesto", w: 15 }],
      umbral: 72,
      preguntas: ["¿Qué edad tienes?", "¿Dónde vives y cuánto tardas en llegar a Portales Sur?", "¿Cuántos años tienes diseñando exhibidores, stands o POP?", "¿Qué programas dominas: AutoCAD, SolidWorks, KeyShot, Illustrator?", "¿Cuál es tu expectativa salarial mensual?", "¿Tienes portafolio con renders y planos de producción?", "¿Cuentas con INE, RFC y NSS?"],
      psicoEsperado: [{ k: "Análisis de problemas", min: 60 }, { k: "Enfoque a resultados", min: 60 }, { k: "Trabajo en equipo", min: 55 }, { k: "Toma de decisiones", min: 55 }],
    };
    let id;
    if (existing) { id = existing.id; setProfiles((ps) => ps.map((p) => (p.id === id ? { ...p, ...gen } : p))); }
    else { id = `p${profiles.length + 1}`; setProfiles((ps) => [...ps, { ...PROFILES[3], ...gen, id, clientId: clId, fecha: HOY, elaboradoPor: `${ROLES[role].nombre} (Prime)`, unidad: f.titulo }]); }
    setLevant(null); setSelProfile(id); setTab("perfiles");
    notify("Perfil generado: descriptivo, reglas de prefiltro, preguntas del agente y pesos de evaluación.");
  };

  const drawerCand = cands.find((c) => c.id === drawer);
  const R = ROLES[role];

  return (
    <div className="pr-root" style={{ fontFamily: T.font, color: T.ink, background: T.paper, minHeight: "100vh", display: "flex" }}>
      <GlobalStyle />
      <nav style={{ width: 232, background: `linear-gradient(180deg, ${T.forest} 0%, ${T.forest2} 100%)`, padding: "18px 12px", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", boxSizing: "border-box" }}>
        <div style={{ padding: "4px 8px 18px", display: "flex", alignItems: "center", gap: 10 }}>
          <img src={PRIME_LOGO} alt="Prime HR Innovation" style={{ height: 34, width: "auto", display: "block" }} onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "block"; }} />
          <div style={{ display: "none", color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Prime HR<br />Innovation</div>
        </div>
        <div style={{ display: "grid", gap: 2 }}>
          {R.tabs.map((k) => { const [l, Icon] = NAV[k]; return <button key={k} type="button" className={`pr-nav-btn${tab === k ? " on" : ""}`} onClick={() => go(k)}><Icon size={17} strokeWidth={2} />{l}</button>; })}
        </div>
        <div style={{ marginTop: "auto", padding: "12px 8px 0", color: "rgba(255,255,255,.55)", fontSize: 11.5, lineHeight: 1.5 }}>
          Sistema de reclutamiento<br />Demo preparada por VADAI · sep 2026
        </div>
      </nav>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ background: T.white, borderBottom: `1px solid ${T.line}`, padding: "10px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {onBack && <Btn small ghost icon={ArrowLeft} onClick={onBack}>Volver a la propuesta</Btn>}
            <div style={{ fontSize: 13, color: T.slate }}>Jueves 10 de septiembre de 2026</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar name={R.nombre} size={30} />
            <div style={{ fontSize: 13, lineHeight: 1.25 }}><div style={{ fontWeight: 600 }}>{R.nombre}</div><div style={{ color: T.slate, fontSize: 12 }}>{R.rol}</div></div>
            <select value={role} onChange={(e) => changeRole(e.target.value)} aria-label="Cambiar sesión de demo" style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "6px 10px", fontFamily: T.font, fontSize: 13, background: T.paper, color: T.ink, marginLeft: 8 }}>
              <option value="admin">Ver como Administrador</option>
              <option value="reclutador">Ver como Reclutador</option>
              <option value="cliente">Ver como cliente Telasist</option>
            </select>
          </div>
        </header>

        <main className="pr-scroll" style={{ padding: "24px 24px 40px", flex: 1, overflow: "auto" }}>
          {levant !== null ? (
            <Levantamiento clientId={levant} onCancel={() => setLevant(null)} onGenerate={generarPerfil} />
          ) : (
            <>
              {tab === "tablero" && <Tablero cands={cands} profiles={profiles} go={go} openCand={openCand} nombre={R.nombre.split(" ")[0]} />}
              {tab === "clientes" && <Clientes cands={cands} profiles={profiles} selected={selClient} setSelected={setSelClient} go={go} openProfile={openProfile} startLevantamiento={(id) => setLevant(id)} />}
              {tab === "perfiles" && <Perfiles cands={cands} profiles={profiles} selected={selProfile} setSelected={setSelProfile} openCand={openCand} startLevantamiento={(id) => setLevant(id)} />}
              {tab === "candidatos" && <Candidatos cands={cands} profiles={profiles} openCand={openCand} filtroPerfil={filtroPerfil} setFiltroPerfil={setFiltroPerfil} />}
              {tab === "entrevistas" && <Entrevistas cands={cands} interviews={interviews} openCand={openCand} />}
              {tab === "reportes" && <Reportes cands={cands} profiles={profiles} role={role} />}
              {tab === "portal" && <Portal cands={cands} profiles={profiles} openCand={openCand} interviews={interviews} />}
            </>
          )}
        </main>
      </div>

      {drawerCand && <CandDrawer key={drawerKey} c={drawerCand} onClose={() => setDrawer(null)} act={act} role={role} />}
      <Toast msg={toast} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROPUESTA COMERCIAL · VADAI → Prime HR Innovation
   Folio VAD-COT-2026-PRM01 · 11 de septiembre de 2026
   ═══════════════════════════════════════════════════════════════ */
const P = {
  forest: "#0E4632", forest2: "#145A41", leaf: "#1E8A57", leafSoft: "#DDF2E6", lime: "#8FD45D", mint: "#EEF7F1",
  paper: "#FFFFFF", ink: "#152019", slate: "#5D6D63", line: "#D8E4DC", onDark: "#FFFFFF", onDarkMuted: "#BFD9CB",
  display: '"Source Serif 4", "Georgia", "Times New Roman", serif',
  body: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
};
const FOLIO = "VAD-COT-2026-PRM01";
const FECHA = "11 de septiembre de 2026";
const PRECIO_LISTA = 100000;
const PRECIO = 80000;
const MENSUAL = 3500;
const IVA = 0.16;
const fmt = (n) => "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function PropStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
      .vp-root { -webkit-font-smoothing: antialiased; }
      .vp-root *:focus-visible { outline: 3px solid ${P.lime}; outline-offset: 3px; border-radius: 4px; }
      .vp-tnum { font-variant-numeric: tabular-nums; }
      .vp-table th, .vp-table td { padding: 14px 12px; text-align: left; vertical-align: top; }
      .vp-table th { font-size: 13px; font-weight: 600; color: ${P.slate}; border-bottom: 2px solid ${P.forest}; }
      .vp-table td { border-bottom: 1px solid ${P.line}; }
      .vp-table tr:last-child td { border-bottom: none; }
      .vp-table .num { text-align: right; white-space: nowrap; }
      @media (prefers-reduced-motion: reduce) { .vp-root * { transition: none !important; } }
      @media print { .vp-noprint { display: none !important; } .vp-root section { break-inside: avoid; } }
    `}</style>
  );
}

function PSection({ children, bg, style }) {
  return (
    <section style={{ background: bg || P.paper, padding: "clamp(44px, 6vw, 80px) clamp(20px, 5vw, 48px)", ...style }}>
      <div style={{ maxWidth: 940, margin: "0 auto", position: "relative" }}>{children}</div>
    </section>
  );
}
function PH2({ children, light }) {
  return <h2 style={{ fontFamily: P.display, fontWeight: 600, fontSize: "clamp(26px, 3.2vw, 36px)", lineHeight: 1.12, letterSpacing: "-0.01em", color: light ? P.onDark : P.forest, margin: "0 0 14px", maxWidth: "26ch" }}>{children}</h2>;
}
function PLead({ children, light }) {
  return <p style={{ fontSize: "clamp(16px, 1.4vw, 18px)", lineHeight: 1.6, color: light ? P.onDarkMuted : P.slate, margin: "0 0 32px", maxWidth: "64ch" }}>{children}</p>;
}
function PItem({ children, color, dash }) {
  const Icon = dash ? Minus : Check;
  return (
    <li style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10, fontSize: 16, lineHeight: 1.55, color: P.ink }}>
      <Icon size={18} color={color || P.leaf} strokeWidth={2.75} style={{ flexShrink: 0, marginTop: 4 }} />
      <span>{children}</span>
    </li>
  );
}
function PUl({ children, style }) { return <ul style={{ listStyle: "none", padding: 0, margin: 0, ...style }}>{children}</ul>; }
function PCallout({ children }) {
  return <div style={{ background: P.leafSoft, borderLeft: `4px solid ${P.leaf}`, borderRadius: 6, padding: "12px 14px", fontSize: 14.5, lineHeight: 1.55, color: P.forest }}>{children}</div>;
}
function DemoButton({ onClick, big }) {
  return (
    <button type="button" onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: P.lime, color: P.forest, border: "none", borderRadius: 10, padding: big ? "14px 22px" : "10px 16px", fontFamily: P.body, fontWeight: 700, fontSize: big ? 16.5 : 14.5, cursor: "pointer", boxShadow: "0 6px 18px rgba(143,212,93,.35)" }}>
      <Sparkles size={big ? 20 : 16} strokeWidth={2.5} />
      Abrir la demo interactiva
    </button>
  );
}
function Seal({ icon: Icon, title, sub }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", border: "1px solid rgba(255,255,255,.22)", borderRadius: 10, padding: "14px 16px", color: P.onDark }}>
      <Icon size={20} color={P.lime} strokeWidth={2.25} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: P.onDarkMuted, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
      </div>
    </div>
  );
}
function Modulo({ icon: Icon, title, children }) {
  return (
    <div style={{ border: `1px solid ${P.line}`, borderTop: `5px solid ${P.leaf}`, borderRadius: 10, padding: "20px 22px 16px", background: P.paper, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: P.mint, display: "inline-flex", alignItems: "center", justifyContent: "center", color: P.leaf }}><Icon size={20} strokeWidth={2.25} /></span>
        <h3 style={{ fontFamily: P.display, fontWeight: 600, fontSize: 20, lineHeight: 1.2, color: P.ink, margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Propuesta({ openDemo }) {
  const iva = PRECIO * IVA;
  const total = PRECIO + iva;
  const pct = Math.round((1 - PRECIO / PRECIO_LISTA) * 100);
  return (
    <div className="vp-root" style={{ fontFamily: P.body, color: P.ink, background: P.paper, minHeight: "100vh" }}>
      <PropStyle />

      {/* ───────── HERO ───────── */}
      <PSection bg={`linear-gradient(160deg, ${P.forest} 0%, ${P.forest2} 100%)`} style={{ paddingTop: "clamp(28px, 4vw, 44px)", paddingBottom: "clamp(44px, 6vw, 72px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: "clamp(44px, 7vw, 84px)" }}>
          <img src={PRIME_LOGO} alt="Prime HR Innovation" style={{ height: 46, width: "auto", display: "block" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div style={{ fontSize: 13.5, color: P.onDarkMuted, textAlign: "right", lineHeight: 1.5 }}>
            <div style={{ color: P.onDark, fontWeight: 600 }}>Propuesta preparada por VADAI</div>
            <div>Folio {FOLIO}</div>
            <div>{FECHA}</div>
          </div>
        </div>
        <h1 style={{ fontFamily: P.display, fontWeight: 600, fontSize: "clamp(36px, 5.2vw, 60px)", lineHeight: 1.05, letterSpacing: "-0.015em", color: P.onDark, margin: "0 0 22px", maxWidth: "18ch" }}>
          Sistema de reclutamiento con inteligencia artificial para Prime
        </h1>
        <div aria-hidden="true" style={{ height: 4, width: 72, borderRadius: 2, background: P.lime, marginBottom: 26 }} />
        <p style={{ fontSize: 17, fontWeight: 600, color: P.onDark, margin: "0 0 12px" }}>Preparada para el equipo de Prime HR Innovation</p>
        <p style={{ fontSize: "clamp(16.5px, 1.5vw, 19px)", lineHeight: 1.6, color: P.onDarkMuted, margin: "0 0 30px", maxWidth: "58ch" }}>
          Una sola plataforma para que cada candidato que llega de Pandape, Facebook o LinkedIn sea prefiltrado, evaluado, entrevistado y documentado sin que el equipo lo persiga a mano. Ya la construimos con datos de Telasist y con su propio descriptivo de puesto: pueden recorrerla ahora mismo.
        </p>
        <div className="vp-noprint"><DemoButton big onClick={openDemo} /></div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: 0, marginTop: "clamp(36px, 5vw, 56px)", borderTop: "1px solid rgba(255,255,255,.18)" }}>
          {[
            ["Agente de WhatsApp", "Prefiltra cada postulante en minutos con Whaapy"],
            ["Entrevistas con Fireflies", "Meet o Zoom automático, transcripción y análisis"],
            ["Psicométrico y expediente", "Lectura de Psicotest y documentos por WhatsApp"],
            ["Reportes que salen solos", "Diario interno, diario al cliente y semanal"],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: "18px 18px 4px 0", color: P.onDark }}>
              <div style={{ fontFamily: P.display, fontWeight: 600, fontSize: 19, lineHeight: 1.2 }}>{k}</div>
              <div style={{ fontSize: 14, color: P.onDarkMuted, marginTop: 5, lineHeight: 1.45 }}>{v}</div>
            </div>
          ))}
        </div>
      </PSection>

      {/* ───────── HOY VS CON EL SISTEMA ───────── */}
      <PSection>
        <PH2>Lo que hoy se hace a mano, mañana lo hace el sistema</PH2>
        <PLead>
          Prime ya tiene el proceso resuelto: levantamiento, descriptivo de puesto, filtrado, entrevistas, psicométrico, expediente y Vo.Bo. del cliente. Lo que falta es que el proceso corra solo entre un paso y otro. Cada punto de la izquierda lo revisamos con ustedes; cada punto de la derecha está en la demo.
        </PLead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "clamp(18px, 3vw, 36px)" }}>
          <div style={{ borderTop: `2px solid ${P.line}`, paddingTop: 14 }}>
            <div style={{ fontFamily: P.display, fontWeight: 600, fontSize: 20, color: P.slate, marginBottom: 12 }}>Hoy</div>
            <PUl>
              {[
                "El reclutador escribe o llama a cada postulante para saber si cumple edad, zona, horario y expectativa.",
                "Los CVs se revisan uno por uno contra la D.P.",
                "Las entrevistas quedan en notas; nadie vuelve a escucharlas.",
                "El PDF de Psicotest se interpreta a mano y se archiva.",
                "Los documentos del expediente llegan por WhatsApp personal y se guardan en carpetas.",
                "El reporte al cliente se arma en Excel cada semana.",
              ].map((t) => <PItem key={t} color={P.slate} dash>{t}</PItem>)}
            </PUl>
          </div>
          <div style={{ borderTop: `2px solid ${P.leaf}`, paddingTop: 14 }}>
            <div style={{ fontFamily: P.display, fontWeight: 600, fontSize: 20, color: P.forest, marginBottom: 12 }}>Con el sistema</div>
            <PUl>
              {[
                "El agente de WhatsApp hace las preguntas del perfil, valida cada respuesta y descarta o avanza al candidato.",
                "La IA puntúa el CV de 0 a 100 contra los pesos del perfil y marca quién pasa a entrevista.",
                "Fireflies transcribe la entrevista y la IA extrae evidencia de cada requisito del puesto.",
                "El psicométrico se compara con los mínimos del perfil y devuelve un veredicto con alertas.",
                "El agente pide los documentos, los valida y arma el expediente listo para contratación.",
                "Tres correos salen solos: resumen diario interno, candidatos que avanzaron al cliente y reporte semanal.",
              ].map((t) => <PItem key={t}>{t}</PItem>)}
            </PUl>
          </div>
        </div>
      </PSection>

      {/* ───────── ALCANCE ───────── */}
      <PSection bg={P.mint}>
        <PH2>Alcance de esta propuesta</PH2>
        <PLead>Ocho módulos, tres roles (administrador de Prime, reclutador y cliente externo) y las integraciones que ya conocen. Todo lo que describimos aquí está funcionando en la demo.</PLead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(400px, 100%), 1fr))", gap: 18 }}>
          <Modulo icon={Building2} title="Clientes y perfiles de puesto">
            <PUl>
              <PItem>Alta de clientes con contactos, domicilio y calendario de reportes.</PItem>
              <PItem>Levantamiento de perfil con la misma estructura del formato en Excel (secciones I a VII).</PItem>
              <PItem>La IA redacta el descriptivo de puesto en el formato D.P. de Prime, las reglas de prefiltro, las preguntas del agente y los pesos de evaluación.</PItem>
            </PUl>
          </Modulo>
          <Modulo icon={MessageCircle} title="Agente de WhatsApp en Whaapy">
            <PUl>
              <PItem>Contacta a cada postulante que llega de Pandape, Facebook, LinkedIn o la bolsa de Prime, con su canal de origen registrado.</PItem>
              <PItem>Hace las preguntas del perfil en conversación natural y valida edad, zona, experiencia, disponibilidad y expectativa.</PItem>
              <PItem>Descarta con mensaje de cortesía, avanza al candidato o escala la excepción al reclutador.</PItem>
            </PUl>
          </Modulo>
          <Modulo icon={FileText} title="Evaluación de CV contra el perfil">
            <PUl>
              <PItem>Lee el CV y las respuestas del prefiltro; califica cada criterio y pondera con los pesos del puesto.</PItem>
              <PItem>Umbral configurable por vacante para pasar a entrevista Prime.</PItem>
              <PItem>Pipeline visual por etapas con filtros por vacante y canal.</PItem>
            </PUl>
          </Modulo>
          <Modulo icon={Video} title="Entrevistas con Fireflies">
            <PUl>
              <PItem>Al agendar, crea la reunión en Google Meet o Zoom, invita al candidato por WhatsApp y suma a Fireflies.</PItem>
              <PItem>Transcripción en español y análisis contra el perfil: hallazgos con cita textual y puntuación de entrevista.</PItem>
              <PItem>Agenda de entrevistas Prime y entrevistas con el cliente.</PItem>
            </PUl>
          </Modulo>
          <Modulo icon={Brain} title="Psicométrico Psicotest">
            <PUl>
              <PItem>El agente envía el enlace y recuerda al candidato si no lo completa.</PItem>
              <PItem>La IA lee el PDF (Cacter, Ciesman, Cibain, Inceval y Coleibor) y lo compara con los mínimos del perfil.</PItem>
              <PItem>Veredicto: apto, apto con reservas o no recomendado, con alertas por escala.</PItem>
            </PUl>
          </Modulo>
          <Modulo icon={ShieldCheck} title="Expediente digital">
            <PUl>
              <PItem>Los diez documentos del expediente se piden y reciben por WhatsApp; la IA valida legibilidad y datos.</PItem>
              <PItem>Hoja de confirmación del candidato generada con los datos capturados.</PItem>
              <PItem>Expediente listo para contratación, con historial completo del proceso.</PItem>
            </PUl>
          </Modulo>
          <Modulo icon={Mail} title="Reportes e inteligencia interna">
            <PUl>
              <PItem>Resumen diario interno por vacante con las decisiones pendientes del reclutador.</PItem>
              <PItem>Correo diario al cliente con los candidatos que avanzaron y reporte semanal con embudo, canal y perfil contratado.</PItem>
              <PItem>Inteligencia interna: conversión por canal, permanencia según puntuación, motivos de descarte y áreas de mejora generadas por la IA.</PItem>
            </PUl>
          </Modulo>
          <Modulo icon={Globe} title="Portal del cliente">
            <PUl>
              <PItem>Acceso de solo lectura a sus vacantes, candidatos que ya pasaron entrevista Prime y reporte semanal.</PItem>
              <PItem>Vo.Bo. de contratación desde el portal, con notificación a Prime.</PItem>
              <PItem>Datos de candidatos protegidos conforme a la LFPDPPP.</PItem>
            </PUl>
          </Modulo>
        </div>

        <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 28 }}>
          <div>
            <h3 style={{ fontFamily: P.display, fontWeight: 600, fontSize: 20, margin: "0 0 12px", color: P.forest }}>Lo que no incluye</h3>
            <PUl>
              <PItem color={P.slate}>La publicación en Pandape, Facebook y LinkedIn: sigue siendo manual, como hoy. El sistema registra el canal de origen.</PItem>
              <PItem color={P.slate}>Licencias y consumos de terceros: conversaciones de WhatsApp Business API, Fireflies, Psicotest, Zoom o Google Workspace.</PItem>
              <PItem color={P.slate}>Firma electrónica del contrato y nómina: quedan como siguiente etapa.</PItem>
            </PUl>
          </div>
          <div>
            <h3 style={{ fontFamily: P.display, fontWeight: 600, fontSize: 20, margin: "0 0 12px", color: P.forest }}>Lo que necesitamos de Prime</h3>
            <PUl>
              <PItem>Número de WhatsApp para el agente y acceso a la cuenta de Fireflies y Google Workspace.</PItem>
              <PItem>Formatos de levantamiento y D.P., y tres o cuatro psicométricos de ejemplo para calibrar la lectura.</PItem>
              <PItem>Una persona de referencia y a Telasist como primer cliente en productivo.</PItem>
            </PUl>
          </div>
        </div>
      </PSection>

      {/* ───────── PROCESO ───────── */}
      <PSection>
        <PH2>Cómo vamos a trabajar</PH2>
        <PLead>Diez semanas en cuatro fases. Cada fase se entrega funcionando y ustedes la usan con Telasist antes de que empiece la siguiente.</PLead>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, maxWidth: 740 }}>
          {[
            ["Clientes, perfiles y levantamiento", "Semanas 1 y 2", "Alta de clientes, levantamiento con la estructura del Excel y generación del descriptivo con IA. Cargamos las vacantes de Telasist."],
            ["Candidatos, agente de WhatsApp y evaluación de CV", "Semanas 3 a 5", "Pipeline por etapas, agente en Whaapy con las preguntas del perfil, puntuación del CV y umbral por vacante."],
            ["Entrevistas, psicométrico y expediente", "Semanas 6 a 8", "Integración con Google Calendar, Meet o Zoom y Fireflies; lectura de Psicotest; captura y validación de documentos por WhatsApp."],
            ["Reportes, inteligencia interna y portal", "Semanas 9 y 10", "Los tres correos automáticos, el tablero de inteligencia interna, el portal del cliente, capacitación al equipo y salida a productivo."],
          ].map(([k, w, v], i, arr) => (
            <li key={k} style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 16, position: "relative", paddingBottom: i === arr.length - 1 ? 0 : 26 }}>
              {i !== arr.length - 1 && <span aria-hidden="true" style={{ position: "absolute", left: 21, top: 44, bottom: 0, width: 2, background: P.line }} />}
              <span className="vp-tnum" style={{ width: 44, height: 44, borderRadius: "50%", background: P.forest, color: P.onDark, fontFamily: P.display, fontWeight: 700, fontSize: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>{i + 1}</span>
              <div style={{ paddingTop: 6 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <div style={{ fontFamily: P.display, fontWeight: 600, fontSize: 19, color: P.forest, lineHeight: 1.25 }}>{k}</div>
                  <div style={{ fontSize: 13, color: P.slate, fontWeight: 600 }}>{w}</div>
                </div>
                <div style={{ fontSize: 15.5, lineHeight: 1.6, color: P.slate, maxWidth: "62ch", marginTop: 6 }}>{v}</div>
              </div>
            </li>
          ))}
        </ol>
        <div style={{ marginTop: 28, maxWidth: "70ch" }}>
          <PCallout><strong>Plataforma.</strong> Next.js y Supabase en Vercel, con la API de Anthropic para la IA, Whaapy para WhatsApp y Fireflies para entrevistas. Misma base que usamos en las plataformas que operamos para otros clientes.</PCallout>
        </div>
      </PSection>

      {/* ───────── DEMO ───────── */}
      <PSection bg={`linear-gradient(160deg, ${P.forest2} 0%, ${P.forest} 100%)`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 32, alignItems: "center" }}>
          <div>
            <PH2 light>Recórranla antes de decidir</PH2>
            <PLead light>La demo tiene a Telasist con tres vacantes, 29 candidatos en distintas etapas, el descriptivo real de Ejecutivo de Cobranza y un psicométrico de Psicotest cargado. Cambien de sesión arriba a la derecha para verla como reclutador o como cliente.</PLead>
            <div className="vp-noprint"><DemoButton big onClick={openDemo} /></div>
          </div>
          <PUl>
            {[
              "Abran a Mariana Cortés en Candidatos: puntuación del CV, prefiltro, conversación del agente, entrevista con Fireflies, psicométrico y expediente.",
              "En Perfiles de puesto, pestaña Evaluación automática: pesos, umbral, preguntas del agente y mínimos psicométricos.",
              "Nuevo levantamiento: llenen el formato y generen el perfil.",
              "Reportes: los tres correos y la inteligencia interna.",
            ].map((t) => <PItem key={t} color={P.lime}><span style={{ color: P.onDark }}>{t}</span></PItem>)}
          </PUl>
        </div>
      </PSection>

      {/* ───────── INVERSIÓN ───────── */}
      <PSection>
        <PH2>Inversión</PH2>
        <PLead>Cifras en pesos mexicanos, más IVA. Un pago por el desarrollo y una mensualidad para que el sistema siga operando, actualizado y con soporte.</PLead>

        <div style={{ overflowX: "auto", border: `1px solid ${P.line}`, borderRadius: 10 }}>
          <table className="vp-table" style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 15.5 }}>
            <thead>
              <tr><th>Concepto</th><th className="num">Precio normal</th><th className="num">Precio Prime</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div style={{ fontWeight: 600 }}>Desarrollo e implementación del sistema</div>
                  <div style={{ fontSize: 13.5, color: P.slate, marginTop: 3 }}>Ocho módulos, tres roles, integraciones con Whaapy, Fireflies, Google Calendar y Psicotest, capacitación y salida a productivo</div>
                </td>
                <td className="num vp-tnum" style={{ color: P.slate, textDecoration: "line-through" }}>{fmt(PRECIO_LISTA)}</td>
                <td className="num vp-tnum" style={{ fontWeight: 700, color: P.leaf, fontSize: 17 }}>{fmt(PRECIO)}</td>
              </tr>
              <tr>
                <td>
                  <div style={{ fontWeight: 600 }}>Servicio mensual</div>
                  <div style={{ fontSize: 13.5, color: P.slate, marginTop: 3 }}>Desde la salida a productivo: hospedaje, monitoreo del agente y las automatizaciones, soporte y ajustes menores</div>
                </td>
                <td className="num vp-tnum" style={{ color: P.slate }}>—</td>
                <td className="num vp-tnum" style={{ fontWeight: 700, color: P.leaf, fontSize: 17 }}>{fmt(MENSUAL)} <span style={{ fontSize: 13, color: P.slate, fontWeight: 500 }}>al mes</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 20, maxWidth: "70ch" }}>
          <PCallout><strong>{pct}% de descuento por su inscripción al curso de IA de VADAI.</strong> El precio normal de un sistema con este alcance es {fmt(PRECIO_LISTA)}. Lo dejamos en {fmt(PRECIO)} para el equipo de Prime.</PCallout>
        </div>

        <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 24, alignItems: "start" }}>
          <div style={{ background: `linear-gradient(160deg, ${P.forest} 0%, ${P.forest2} 100%)`, color: P.onDark, borderRadius: 12, padding: "24px 26px" }}>
            <div style={{ display: "grid", gap: 10, fontSize: 15.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: P.onDarkMuted }}><span>Precio normal</span><span className="vp-tnum" style={{ textDecoration: "line-through" }}>{fmt(PRECIO_LISTA)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Desarrollo e implementación</span><span className="vp-tnum" style={{ fontWeight: 600 }}>{fmt(PRECIO)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: P.onDarkMuted }}><span>IVA 16%</span><span className="vp-tnum">{fmt(iva)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, borderTop: "1px solid rgba(255,255,255,.22)", paddingTop: 14, marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>Total con IVA</span>
                <span className="vp-tnum" style={{ fontFamily: P.display, fontWeight: 700, fontSize: 32, lineHeight: 1 }}>{fmt(total)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginTop: 10, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.12)" }}>
                <span style={{ color: P.onDarkMuted }}>Mensualidad con IVA</span>
                <span className="vp-tnum" style={{ fontWeight: 600, fontSize: 18 }}>{fmt(MENSUAL * (1 + IVA))} <span style={{ fontSize: 13, color: P.onDarkMuted, fontWeight: 500 }}>al mes</span></span>
              </div>
              <div style={{ fontSize: 13.5, color: P.lime, marginTop: 2 }}>{pct}% por debajo del precio normal</div>
            </div>
          </div>
          <div style={{ fontSize: 15.5, lineHeight: 1.65, color: P.ink }}>
            <h3 style={{ fontFamily: P.display, fontWeight: 600, fontSize: 20, margin: "0 0 12px", color: P.forest }}>Forma de pago y condiciones</h3>
            <PUl>
              <PItem><span className="vp-tnum">50% al arrancar ({fmt(PRECIO / 2)} más IVA) y 50% a la salida a productivo ({fmt(PRECIO / 2)} más IVA).</span></PItem>
              <PItem>La mensualidad de {fmt(MENSUAL)} más IVA inicia el mes en que el sistema sale a productivo.</PItem>
              <PItem>Los consumos de WhatsApp Business API, Fireflies, Psicotest y videollamadas se pagan directamente al proveedor.</PItem>
              <PItem>Vigencia de la propuesta: 30 días naturales a partir de su fecha de emisión.</PItem>
              <PItem>Trabajo fuera de este alcance se cotiza por separado con tarifa preferente.</PItem>
              <PItem>Factura Hecho Está, S.C. (VADAI), RFC HES210825CM7.</PItem>
            </PUl>
          </div>
        </div>
      </PSection>

      {/* ───────── DESPUÉS ───────── */}
      <PSection bg={P.mint}>
        <PH2>Y después de esto</PH2>
        <PLead>Con el sistema operando para Telasist y el equipo capacitado, hay tres caminos naturales. Los cotizamos con el mismo formato cuando llegue el momento.</PLead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "clamp(20px, 3vw, 40px)" }}>
          {[
            ["Segunda vertiente de Prime", "El mismo equipo, la misma plataforma y los mismos accesos para la otra línea de negocio, sin volver a empezar."],
            ["Contratación y firma", "Generación del contrato desde el expediente, firma electrónica y alta en nómina o en Odoo."],
            ["Más clientes en el portal", "Cada nuevo cliente de Prime entra con su portal, sus reportes y su inteligencia interna desde el primer día."],
          ].map(([k, v]) => (
            <div key={k} style={{ borderTop: `2px solid ${P.leaf}`, paddingTop: 14 }}>
              <div style={{ fontFamily: P.display, fontWeight: 600, fontSize: 20, color: P.forest, marginBottom: 8 }}>{k}</div>
              <div style={{ fontSize: 15.5, lineHeight: 1.6, color: P.slate }}>{v}</div>
            </div>
          ))}
        </div>
      </PSection>

      {/* ───────── CIERRE / VADAI ───────── */}
      <PSection bg={`linear-gradient(160deg, ${P.forest2} 0%, ${P.forest} 100%)`}>
        <PH2 light>Sigamos construyendo</PH2>
        <PLead light>Para avanzar, respóndannos con su visto bueno y agendamos el arranque. Nos da mucho gusto trabajar con el equipo de Prime.</PLead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 20, marginBottom: 40 }}>
          {[["Roberto Martínez Licón", "Founder y Director Comercial"], ["Alejandro Tremo", "Founder y CTO"]].map(([n, r]) => (
            <div key={n} style={{ color: P.onDark }}>
              <div style={{ fontFamily: P.display, fontWeight: 600, fontSize: 20 }}>{n}</div>
              <div style={{ fontSize: 14.5, color: P.onDarkMuted, marginTop: 3 }}>{r}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ fontFamily: P.display, fontWeight: 700, fontSize: 24, letterSpacing: "0.04em", color: P.onDark }}>VADAI</span>
          <span style={{ fontSize: 14, color: P.onDarkMuted }}>Software, automatización e inteligencia artificial</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))", gap: 12 }}>
          <Seal icon={BadgeCheck} title="Odoo Official Partner" sub="Implementación, Studio y automatización" />
          <Seal icon={Cpu} title="AI Expert" sub="Agentes, copilotos y automatización con IA" />
          <Seal icon={MessageSquare} title="Meta Official Partner" sub="WhatsApp Business API oficial" />
          <Seal icon={Boxes} title="Softwares VADAI" sub="Whaapy, Bobax y Levantia" />
        </div>
        <div style={{ marginTop: 36, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.18)", fontSize: 13, lineHeight: 1.6, color: P.onDarkMuted }}>
          Hecho Está, S.C. opera comercialmente como VADAI. RFC HES210825CM7. Folio {FOLIO}. Propuesta emitida el {FECHA}. Precios en pesos mexicanos, más IVA. El logotipo de Prime HR Innovation se usa únicamente para identificar al destinatario de esta propuesta. Los nombres y datos de candidatos en la demo son ficticios.
        </div>
      </PSection>
    </div>
  );
}

/* ═════════════ RAÍZ: PROPUESTA ↔ DEMO ═════════════ */
export default function PropuestaPrime() {
  const [vista, setVista] = useState("propuesta");
  if (vista === "demo") return <PrimeDemo onBack={() => setVista("propuesta")} />;
  return <Propuesta openDemo={() => { setVista("demo"); if (typeof window !== "undefined") window.scrollTo(0, 0); }} />;
}