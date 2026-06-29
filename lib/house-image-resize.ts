export const HOUSE_IMAGE_MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
export const HOUSE_IMAGE_RESIZE_MAX_EDGE = 1920;
export const HOUSE_IMAGE_WEBP_QUALITY = 0.82;

const supportedHouseResizeInputTypes = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface ResizedHouseImage {
  file: File;
  height: number;
  originalSize: number;
  resizedSize: number;
  width: number;
}

function outputFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "house-image";
  return `${baseName}.webp`;
}

function scaledDimensions(width: number, height: number) {
  const maxEdge = Math.max(width, height);
  if (maxEdge <= HOUSE_IMAGE_RESIZE_MAX_EDGE) return { height, width };

  const scale = HOUSE_IMAGE_RESIZE_MAX_EDGE / maxEdge;
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

function canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to resize image"));
          return;
        }

        resolve(blob);
      },
      "image/webp",
      HOUSE_IMAGE_WEBP_QUALITY,
    );
  });
}

export async function resizeHouseImageFile(file: File): Promise<ResizedHouseImage> {
  if (file.type === "image/gif") throw new Error("Unsupported image type");
  if (!supportedHouseResizeInputTypes.has(file.type)) throw new Error("Unsupported image type");
  if (file.size > HOUSE_IMAGE_MAX_ORIGINAL_BYTES) throw new Error("House image is too large");

  const bitmap = await createImageBitmap(file);
  const { height, width } = scaledDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Failed to resize image");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvasToWebpBlob(canvas);
  const outputName = outputFileName(file.name);
  const resizedFile = new File([blob], outputName, {
    lastModified: Date.now(),
    type: "image/webp",
  });

  return {
    file: resizedFile,
    height,
    originalSize: file.size,
    resizedSize: resizedFile.size,
    width,
  };
}
