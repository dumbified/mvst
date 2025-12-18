import { getSupabase } from "./supabaseClient";

export type UploadedFileInfo = {
  bucket: string;
  path: string;
  publicUrl?: string;
};

const sanitizeSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, "_");

export async function uploadFileToSupabase(
  bucket: string,
  file: File,
  folder?: string,
  makePublic: boolean = true
): Promise<UploadedFileInfo> {
  const supabase = getSupabase();
  const folderPrefix = folder ? `${sanitizeSegment(folder)}/` : "";
  const fileName = `${Date.now()}-${sanitizeSegment(file.name)}`;
  const objectPath = `${folderPrefix}${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, file, { upsert: false });

  if (error) {
    throw error;
  }

  let publicUrl: string | undefined;
  if (makePublic) {
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);
    publicUrl = publicData.publicUrl;
  }

  return { bucket, path: data.path, publicUrl };
}


