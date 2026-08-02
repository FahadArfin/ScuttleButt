export const MAX_AVATAR_DATA_URL_LENGTH = 2_000_000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The image could not be read.'));
    };
    image.src = url;
  });
}

/** Resize and encode profile pictures to a conservative 2 MB data URL. */
export async function optimizeAvatar(file: File): Promise<string> {
  const image = await loadImage(file);
  const maxDimension = 1200;
  let scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is not available in this browser.');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.74, 0.62, 0.5, 0.38]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.length <= MAX_AVATAR_DATA_URL_LENGTH) return result;
    }
    scale *= 0.72;
  }
  throw new Error('That image could not be resized below 2 MB.');
}
