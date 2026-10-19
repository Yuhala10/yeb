import { EngineError } from "./core";

/*
 * ============================================================
 * UPLOADED FILES: PHOTOS AND VOICE NOTES
 * ============================================================
 *
 * Everything people upload arrives as a data URL and is
 * checked by its real bytes, not by what the phone says it
 * is, before it can reach the public storage buckets.
 *
 * Photos are re-encoded on the server when the image library
 * is available: that removes hidden data (like the GPS point
 * where the photo was taken, i.e. the farm or the home) and
 * anything that isn't a picture.
 */

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const MAX_AUDIO_BYTES = 1536 * 1024;

let sharpModule;

async function getSharp() {
    if (sharpModule === undefined) {
        try {
            sharpModule = (await import("sharp")).default;
        } catch {
            sharpModule = null;
        }
    }

    return sharpModule;
}

/* =========================================================
   PHOTOS
========================================================= */

export function hasImageSignature(bytes, type) {
    if (type === "jpeg") {
        return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }

    if (type === "png") {
        return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }

    if (type === "webp") {
        return bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    }

    return false;
}

/*
 * A JPEG without its EXIF/XMP/IPTC blocks (where phones write
 * the GPS position, the phone model and the date). The picture
 * itself is untouched.
 */
export function stripJpeg(bytes) {
    const kept = [bytes.subarray(0, 2)];

    let at = 2;

    while (at + 4 <= bytes.length && bytes[at] === 0xff) {
        const marker = bytes[at + 1];

        // Start of the image data: the rest is pixels.
        if (marker === 0xda) {
            kept.push(bytes.subarray(at));
            return Buffer.concat(kept);
        }

        const length = bytes.readUInt16BE(at + 2);

        if (length < 2 || at + 2 + length > bytes.length) {
            throw new EngineError("This photo can't be opened. Try another one.", 400, "PHOTO_TYPE");
        }

        // APP1 (EXIF, XMP), APP13 (IPTC) and comments are dropped.
        if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe) {
            kept.push(bytes.subarray(at, at + 2 + length));
        }

        at += 2 + length;
    }

    throw new EngineError("This photo can't be opened. Try another one.", 400, "PHOTO_TYPE");
}

// A PNG without its text, EXIF and time chunks.
export function stripPng(bytes) {
    const kept = [bytes.subarray(0, 8)];

    let at = 8;

    while (at + 12 <= bytes.length) {
        const length = bytes.readUInt32BE(at);
        const type = bytes.toString("ascii", at + 4, at + 8);
        const end = at + 12 + length;

        if (end > bytes.length) {
            throw new EngineError("This photo can't be opened. Try another one.", 400, "PHOTO_TYPE");
        }

        if (!["tEXt", "zTXt", "iTXt", "eXIf", "tIME"].includes(type)) {
            kept.push(bytes.subarray(at, end));
        }

        at = end;

        if (type === "IEND") {
            return Buffer.concat(kept);
        }
    }

    throw new EngineError("This photo can't be opened. Try another one.", 400, "PHOTO_TYPE");
}

/*
 * { buffer, contentType, extension } from a photo data URL,
 * re-encoded as JPEG without metadata when possible.
 *   maxSide: longest side in pixels
 *   square:  crop to a centred square (profile photos)
 *   wide:    crop to 3:1 (cover photos)
 */
export async function readPhoto(image, { maxSide = 1600, square = false, wide = false } = {}) {
    const match = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(image || ""));

    if (!match) {
        throw new EngineError("Send a JPG, PNG or WebP photo.", 400, "PHOTO_TYPE");
    }

    const buffer = Buffer.from(match[3], "base64");

    if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) {
        throw new EngineError("This photo is too large. Try another one.", 400, "PHOTO_TOO_LARGE");
    }

    if (!hasImageSignature(buffer, match[2])) {
        throw new EngineError("Send a JPG, PNG or WebP photo.", 400, "PHOTO_TYPE");
    }

    const sharp = await getSharp();

    // Without the image library: remove the hidden data by hand.
    if (!sharp) {
        if (match[2] === "webp") {
            throw new EngineError("Send a JPG or PNG photo.", 400, "PHOTO_TYPE");
        }

        const clean = match[2] === "jpeg" ? stripJpeg(buffer) : stripPng(buffer);

        return { buffer: clean, contentType: match[1], extension: match[2] === "jpeg" ? "jpg" : "png" };
    }

    try {
        let pipeline = sharp(buffer, { limitInputPixels: 40_000_000 }).rotate();

        if (square) {
            pipeline = pipeline.resize(maxSide, maxSide, { fit: "cover", position: "attention" });
        } else if (wide) {
            pipeline = pipeline.resize(maxSide, Math.round(maxSide / 3), { fit: "cover", position: "attention" });
        } else {
            pipeline = pipeline.resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true });
        }

        const output = await pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();

        return { buffer: output, contentType: "image/jpeg", extension: "jpg" };
    } catch {
        // Not a real picture after all.
        throw new EngineError("This photo can't be opened. Try another one.", 400, "PHOTO_TYPE");
    }
}

/* =========================================================
   VOICE NOTES
========================================================= */

const AUDIO_TYPES = {
    webm: { contentType: "audio/webm", extension: "webm" },
    ogg: { contentType: "audio/ogg", extension: "ogg" },
    mp4: { contentType: "audio/mp4", extension: "m4a" },
    mpeg: { contentType: "audio/mpeg", extension: "mp3" },
};

function audioKind(bytes) {
    if (bytes.length < 12) {
        return null;
    }

    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
        return "webm";
    }

    if (bytes.toString("ascii", 0, 4) === "OggS") {
        return "ogg";
    }

    if (bytes.toString("ascii", 4, 8) === "ftyp") {
        return "mp4";
    }

    if (bytes.toString("ascii", 0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
        return "mpeg";
    }

    return null;
}

/*
 * A recorded voice note (data URL from the phone's recorder):
 * WebM/Opus (Android Chrome), MP4/AAC (iPhone), Ogg or MP3.
 */
export function readVoice(audio) {
    const match = /^data:(audio\/[a-z0-9.+-]+)(?:;[a-z0-9=.+-]+)*;base64,([A-Za-z0-9+/=]+)$/i.exec(String(audio || ""));

    if (!match) {
        throw new EngineError("Record the voice note again.", 400, "VOICE_TYPE");
    }

    const buffer = Buffer.from(match[2], "base64");

    if (buffer.length === 0 || buffer.length > MAX_AUDIO_BYTES) {
        throw new EngineError("The voice note is too long. Keep it under a minute.", 400, "VOICE_TOO_LONG");
    }

    const kind = audioKind(buffer);

    if (!kind) {
        throw new EngineError("Record the voice note again.", 400, "VOICE_TYPE");
    }

    return { buffer, ...AUDIO_TYPES[kind] };
}
