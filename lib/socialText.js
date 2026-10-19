import { useLanguage } from "./LanguageContext";

/*
 * ============================================================
 * TAYEB MARCHÉ — SOCIAL WORDING (FR / EN)
 * ============================================================
 *
 * Feed, farm pages, likes, saves, follows, captions and
 * voice notes. s("key", { n: 3 }) fills {n}.
 */

const TEXT = {
    en: {
        forYou: "For you",
        following: "Following",
        nearMe: "Near me",
        saved: "Saved",
        feedView: "Feed",
        gridView: "Grid",

        follow: "Follow",
        followingButton: "Following",
        followers: "{n} followers",
        oneFollower: "1 follower",
        posts: "{n} posts",
        onePost: "1 post",
        salesCount: "{n} sales",
        like: "Like",
        unlike: "Unlike",
        likes: "{n} likes",
        oneLike: "1 like",
        save: "Save",
        unsave: "Remove from saved",
        share: "Share",
        more: "more",
        order: "Order",
        soldOut: "Sold out",
        inLanguage: "In {lang}",
        available: "{quantity} {unit} available",
        harvestedAgo: "Posted {when}",
        memberSince: "On Tayeb since {date}",
        noPosts: "No posts yet.",
        seeFarm: "See the farm",

        voiceNote: "Voice note",
        listen: "Listen",
        pause: "Pause",
        record: "Record a voice note",
        recordHint: "Say it in your language: what it is, how fresh, how much. Up to 1 minute.",
        recording: "Recording… {s}",
        stop: "Stop",
        redo: "Record again",
        remove: "Remove",
        micBlocked: "The microphone is blocked. Allow it in your browser settings.",
        micMissing: "This phone can't record here. Write the caption instead.",
        voiceSaving: "Sending the voice note…",

        captionLabel: "Caption",
        captionHint: "Write it the way you speak, in any language.",
        captionPlaceholder: "Tomate don ripe fine fine, fresh from the farm this morning…",
        captionLang: "Language of the caption",

        myPage: "My farm page",
        viewMyPage: "See my page",
        editProfile: "Edit my page",
        farmName: "Farm name",
        farmNamePlaceholder: "e.g. Ferme Ngono",
        handle: "Page address",
        handleHint: "Letters, numbers and dashes.",
        bio: "About the farm",
        bioPlaceholder: "What you grow, since when, how you work…",
        languagesSpoken: "Languages I speak",
        profilePhoto: "Profile photo",
        coverPhoto: "Cover photo",
        change: "Change",
        addPhoto: "Add",
        saveProfile: "Save my page",
        profileSaved: "Your page is saved.",
        photoSaved: "Photo saved.",
        sharePage: "Share my page on WhatsApp",
        sharePageText: "Discover my farm on Tayeb Marché 🌱 {link}",
        shareListingText: "{product} · {price} on Tayeb Marché 🌱 {link}",
        copied: "Link copied.",

        badgePhone: "Phone verified",
        badgeId: "ID verified",
        badgeVisited: "Farm visited by Tayeb",
        badgeTop: "Top seller",

        followingEmpty: "Follow farms to see their new harvests here.",
        followingEmptyTitle: "Nothing yet",
        savedEmpty: "Tap 🔖 on a post to find it here later.",
        savedEmptyTitle: "No saved posts",
        loginToFollow: "Log in to follow farms and save products.",
        login: "Log in",
        loading: "Loading…",

        err_HANDLE_INVALID: "Use 3 to 30 letters, numbers or dashes.",
        err_HANDLE_TAKEN: "This page address is already taken.",
        err_VOICE_TOO_LONG: "The voice note is too long. Keep it under a minute.",
        err_VOICE_TYPE: "Record the voice note again.",
        err_PHOTO_TOO_LARGE: "This photo is too large. Try another one.",
        err_PHOTO_TYPE: "Send a JPG, PNG or WebP photo.",
        err_FOLLOW_SELF: "You can't follow your own farm.",
        err_SOCIAL_NOT_READY: "This opens very soon.",
        err_RATE_LIMITED: "Too many attempts. Please wait a little.",
        err_OFFLINE: "No internet connection. Check your network and try again.",
    },

    fr: {
        forYou: "Pour vous",
        following: "Abonnements",
        nearMe: "Près de moi",
        saved: "Enregistrés",
        feedView: "Fil",
        gridView: "Grille",

        follow: "Suivre",
        followingButton: "Abonné",
        followers: "{n} abonnés",
        oneFollower: "1 abonné",
        posts: "{n} publications",
        onePost: "1 publication",
        salesCount: "{n} ventes",
        like: "J'aime",
        unlike: "Je n'aime plus",
        likes: "{n} j'aime",
        oneLike: "1 j'aime",
        save: "Enregistrer",
        unsave: "Retirer des enregistrés",
        share: "Partager",
        more: "plus",
        order: "Commander",
        soldOut: "Épuisé",
        inLanguage: "En {lang}",
        available: "{quantity} {unit} disponibles",
        harvestedAgo: "Publié {when}",
        memberSince: "Sur Tayeb depuis {date}",
        noPosts: "Pas encore de publication.",
        seeFarm: "Voir la ferme",

        voiceNote: "Note vocale",
        listen: "Écouter",
        pause: "Pause",
        record: "Enregistrer une note vocale",
        recordHint: "Dites-le dans votre langue : ce que c'est, la fraîcheur, la quantité. 1 minute au plus.",
        recording: "Enregistrement… {s}",
        stop: "Arrêter",
        redo: "Recommencer",
        remove: "Supprimer",
        micBlocked: "Le micro est bloqué. Autorisez-le dans les réglages du navigateur.",
        micMissing: "Ce téléphone ne peut pas enregistrer ici. Écrivez la légende à la place.",
        voiceSaving: "Envoi de la note vocale…",

        captionLabel: "Légende",
        captionHint: "Écrivez comme vous parlez, dans n'importe quelle langue.",
        captionPlaceholder: "Tomates bien mûres, cueillies ce matin à la ferme…",
        captionLang: "Langue de la légende",

        myPage: "Ma page ferme",
        viewMyPage: "Voir ma page",
        editProfile: "Modifier ma page",
        farmName: "Nom de la ferme",
        farmNamePlaceholder: "ex. Ferme Ngono",
        handle: "Adresse de la page",
        handleHint: "Lettres, chiffres et tirets.",
        bio: "Présentation de la ferme",
        bioPlaceholder: "Ce que vous cultivez, depuis quand, comment vous travaillez…",
        languagesSpoken: "Langues que je parle",
        profilePhoto: "Photo de profil",
        coverPhoto: "Photo de couverture",
        change: "Changer",
        addPhoto: "Ajouter",
        saveProfile: "Enregistrer ma page",
        profileSaved: "Votre page est enregistrée.",
        photoSaved: "Photo enregistrée.",
        sharePage: "Partager ma page sur WhatsApp",
        sharePageText: "Découvrez ma ferme sur Tayeb Marché 🌱 {link}",
        shareListingText: "{product} · {price} sur Tayeb Marché 🌱 {link}",
        copied: "Lien copié.",

        badgePhone: "Numéro vérifié",
        badgeId: "Identité vérifiée",
        badgeVisited: "Ferme visitée par Tayeb",
        badgeTop: "Top vendeur",

        followingEmpty: "Suivez des fermes pour voir leurs nouvelles récoltes ici.",
        followingEmptyTitle: "Rien pour l'instant",
        savedEmpty: "Touchez 🔖 sur une publication pour la retrouver ici.",
        savedEmptyTitle: "Aucune publication enregistrée",
        loginToFollow: "Connectez-vous pour suivre des fermes et enregistrer des produits.",
        login: "Se connecter",
        loading: "Chargement…",

        err_HANDLE_INVALID: "Utilisez 3 à 30 lettres, chiffres ou tirets.",
        err_HANDLE_TAKEN: "Cette adresse de page est déjà prise.",
        err_VOICE_TOO_LONG: "La note vocale est trop longue. Moins d'une minute.",
        err_VOICE_TYPE: "Enregistrez la note vocale à nouveau.",
        err_PHOTO_TOO_LARGE: "Cette photo est trop lourde. Essayez-en une autre.",
        err_PHOTO_TYPE: "Envoyez une photo JPG, PNG ou WebP.",
        err_FOLLOW_SELF: "Vous ne pouvez pas suivre votre propre ferme.",
        err_SOCIAL_NOT_READY: "Ceci ouvre très bientôt.",
        err_RATE_LIMITED: "Trop de tentatives. Patientez un peu.",
        err_OFFLINE: "Pas de connexion internet. Vérifiez votre réseau et réessayez.",
    },
};

export function socialText(language, key, vars) {
    const lang = language === "en" ? "en" : "fr";

    let text = TEXT[lang][key] ?? TEXT.en[key] ?? key;

    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.split(`{${name}}`).join(String(value ?? ""));
        }
    }

    return text;
}

export function useSocialText() {
    const { language } = useLanguage();

    return (key, vars) => socialText(language, key, vars);
}

export function socialError(language, error) {
    const code = error?.code;

    if (code && TEXT.en[`err_${code}`]) {
        return socialText(language, `err_${code}`);
    }

    return error?.message || socialText(language, "loading");
}

// "12 j'aime" / "1 like"
export function countLabel(language, key, n) {
    if (n === 1) {
        return socialText(language, `one${key[0].toUpperCase()}${key.slice(1, -1)}`);
    }

    return socialText(language, key, { n: Number(n || 0).toLocaleString(language === "en" ? "en-US" : "fr-FR") });
}
