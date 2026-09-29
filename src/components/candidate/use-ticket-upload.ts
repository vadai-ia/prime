"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UploadTicket } from "@/lib/uploads";

type Result = { error?: string; ok?: boolean } | undefined;
export type UploadState = { status: "idle" | "uploading" | "saving" } | { status: "error"; message: string };

/**
 * Subida en tres pasos (src/lib/uploads.ts): el servidor da el boleto, el navegador sube directo
 * a Storage y el servidor registra. El archivo nunca pasa por el servidor de Next.
 */
export function useTicketUpload(bucket: string) {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [, startTransition] = useTransition();

  function upload(file: File | undefined, start: (meta: { size: number; type: string }) => Promise<UploadTicket>, finish: (path: string) => Promise<Result>) {
    if (!file || state.status === "uploading" || state.status === "saving") return;
    setState({ status: "uploading" });
    startTransition(async () => {
      const ticket = await start({ size: file.size, type: file.type });
      if ("error" in ticket) return setState({ status: "error", message: ticket.error });

      const { error } = await createClient().storage.from(bucket).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
      if (error) return setState({ status: "error", message: `No se pudo subir el archivo: ${error.message}` });

      setState({ status: "saving" });
      const result = await finish(ticket.path);
      setState(result?.error ? { status: "error", message: result.error } : { status: "idle" });
    });
  }

  return { state, busy: state.status === "uploading" || state.status === "saving", upload };
}
