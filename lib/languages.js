/*
 * ============================================================
 * LANGUAGES PEOPLE WRITE AND SPEAK IN CAMEROON
 * ============================================================
 *
 * For captions, voice notes and "languages I speak" on farm
 * profiles. Codes are ISO 639-3 where one exists, so other
 * apps (and search engines) understand them.
 */

export const CAPTION_LANGUAGES = [
    { code: "fra", fr: "Français", en: "French", native: "Français" },
    { code: "eng", fr: "Anglais", en: "English", native: "English" },
    { code: "wes", fr: "Pidgin", en: "Pidgin", native: "Pidgin" },
    { code: "fub", fr: "Fulfulde", en: "Fulfulde", native: "Fulfulde" },
    { code: "ewo", fr: "Ewondo", en: "Ewondo", native: "Ewondo" },
    { code: "dua", fr: "Duala", en: "Duala", native: "Duálá" },
    { code: "bas", fr: "Basaa", en: "Basaa", native: "Ɓasaá" },
    { code: "bum", fr: "Bulu", en: "Bulu", native: "Bulu" },
    { code: "bbj", fr: "Ghomálá'", en: "Ghomálá'", native: "Ghɔmálá'" },
    { code: "byv", fr: "Medumba", en: "Medumba", native: "Mə̀dʉ̂mbɑ̀" },
    { code: "ybb", fr: "Yemba", en: "Yemba", native: "Yémba" },
    { code: "fmp", fr: "Fe'fe'", en: "Fe'fe'", native: "Fe'efe'e" },
    { code: "mua", fr: "Moundang", en: "Mundang", native: "Mundang" },
    { code: "shu", fr: "Arabe choa", en: "Chadian Arabic", native: "Arabi" },
    { code: "mis", fr: "Autre langue", en: "Another language", native: "…" },
];

export function findLanguage(code) {
    return CAPTION_LANGUAGES.find((item) => item.code === code) || null;
}

export function languageName(code, language) {
    const item = findLanguage(code);

    if (!item) {
        return "";
    }

    return language === "en" ? item.en : item.fr;
}

export function cleanLanguages(list) {
    if (!Array.isArray(list)) {
        return [];
    }

    return [...new Set(list.map(String))].filter((code) => findLanguage(code)).slice(0, 8);
}
