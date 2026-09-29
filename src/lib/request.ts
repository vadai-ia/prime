/** IP del cliente para audit_log (columna inet). Cadena vacía si el encabezado no trae una IP bien formada. */
export function clientIp(req: Request): string {
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(first) ? first : "";
}
