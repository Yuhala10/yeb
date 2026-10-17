/*
 * Shrinks a phone photo before upload: the longest side
 * becomes at most `maxSide` pixels, saved as JPEG. A 6 MB
 * camera photo usually ends up around 150–300 KB, which
 * matters on mobile data.
 *
 * Returns a data URL ("data:image/jpeg;base64,...").
 */
export function compressImage(file, { maxSide = 1280, quality = 0.82 } = {}) {
    return new Promise((resolve, reject) => {
        if (!file || !String(file.type).startsWith("image/")) {
            reject(new Error("Choose a photo."));
            return;
        }

        const url = URL.createObjectURL(file);

        const image = new Image();

        image.onload = () => {
            try {
                const scale = Math.min(1, maxSide / Math.max(image.width, image.height));

                const canvas = document.createElement("canvas");

                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));

                const context = canvas.getContext("2d");

                // White behind transparent PNGs instead of black.
                context.fillStyle = "#ffffff";
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);

                resolve(canvas.toDataURL("image/jpeg", quality));
            } catch (error) {
                reject(error);
            } finally {
                URL.revokeObjectURL(url);
            }
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("This photo can't be opened. Try another one."));
        };

        image.src = url;
    });
}
