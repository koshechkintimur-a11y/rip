'use client';

/**
 * Клиентское сжатие фото перед загрузкой: canvas → JPEG max 1800px, качество 0.85.
 * Позволяет постить фото с телефонов (8-20MB) без утяжеления ленты —
 * на сервер уходит ~300-700KB.
 * GIF/видео не трогаем.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  // маленькие файлы пропускаем как есть
  if (file.size <= 1_500_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const MAX = 1800;
    let { width, height } = bitmap;
    if (width > MAX || height > MAX) {
      const ratio = Math.min(MAX / width, MAX / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file; // не смогли сжать — отдаём как есть (сервер примет до 20MB)
  }
}
