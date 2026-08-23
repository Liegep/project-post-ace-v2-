import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompressor";

function getFileExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.trim().toLowerCase();
  if (fromName) return fromName;

  const fromType = file.type.split("/").pop()?.trim().toLowerCase();
  if (fromType) return fromType === "jpeg" ? "jpg" : fromType;

  return "bin";
}

export async function uploadClientLogo(file: File): Promise<string> {
  const compressed = await compressImage(file);
  const ext = getFileExtension(compressed);
  const path = `logos/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("media").upload(path, compressed, {
    cacheControl: "3600",
    contentType: compressed.type || file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message || "Não foi possível enviar o logo.");
  }

  const { data } = supabase.storage.from("media").getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("O upload foi concluído, mas a URL pública do logo não foi gerada.");
  }

  return data.publicUrl;
}
