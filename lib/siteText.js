import { useMemo } from "react";

import { useLanguage } from "./LanguageContext";

/*
 * ============================================================
 * TAYEB — SITE WORDING (EN / FR)
 * ============================================================
 *
 * Home page, header, footer and the About page.
 * s("key", { count: 3 }) fills {count}.
 */

const TEXT = {
    en: {
        // Brand and SEO
        seoTitle: "Tayeb — Buy from farms, send goods, deliver across Cameroon",
        seoDescription: "Tayeb connects farmers, buyers and transporters across Cameroon. Buy produce straight from farms, send any load, and get it delivered by the nearest driver, with live tracking, delivery codes and Mobile Money.",
        tagline: "Cameroon's farm market and delivery, in one app.",

        // Header
        navMarket: "Market",
        navSend: "Send goods",
        navDrive: "Drive",
        navSell: "Sell",
        login: "Log in",
        dashboard: "My space",

        // Hero
        heroBadge: "Live across Cameroon · {count} towns",
        heroTitle1: "From the farm",
        heroTitle2: "to your door,",
        heroTitle3: "across Cameroon.",
        heroText: "Tayeb connects the people who grow, the people who buy and the people who drive. Order produce at farm prices, send any load, and follow it all the way.",
        searchPlaceholder: "What are you looking for? Tomatoes, maize, bobolo…",
        searchButton: "Search",
        actionBuy: "Buy produce",
        actionBuyText: "Straight from farmers",
        actionSell: "Sell my harvest",
        actionSellText: "Free, buyers come to you",
        actionSend: "Deliver now",
        actionSendText: "The nearest driver, a fixed price",
        actionDrive: "Drive & earn",
        actionDriveText: "Go online, take the jobs near you",
        liveNow: "Live on the market",
        ticker: "{product} · {city} · {price}",

        // Featured
        featuredTitle: "Fresh on the market",
        featuredText: "Real listings from farmers, updated all the time.",
        seeAll: "See all produce",
        emptyFeatured: "The first farmers are setting up their stalls. Be the first to list your harvest.",

        // Categories
        categoriesTitle: "Shop by category",

        // How it works
        howTitle: "One platform, four ways to win",
        howBuyers: "Buyers",
        howFarmers: "Farmers",
        howShippers: "Shippers",
        howDrivers: "Drivers",
        buyers1: "Find produce by name, even local names like bobolo or ndolè.",
        buyers2: "Order the quantity you need and choose Tayeb delivery or pickup.",
        buyers3: "Pay the farmer by mobile money when the goods arrive.",
        farmers1: "Post your harvest with up to 8 photos, in one minute.",
        farmers2: "Buyers from the cities order. You confirm in one tap.",
        farmers3: "A Tayeb driver collects from your farm.",
        shippers1: "Post your load: what, where, and your price.",
        shippers2: "Drivers send their prices. You choose the best.",
        shippers3: "Follow the truck live and confirm with the delivery code.",
        drivers1: "See loads near you, ranked for you.",
        drivers2: "Return loads from where you deliver: no empty trip back.",
        drivers3: "Get paid for every delivery you finish.",

        // Why Tayeb
        whyTitle: "Built for how Cameroon really trades",
        whyText: "Every detail is designed for real markets, real roads and real phones.",
        why1Title: "Delivery code",
        why1Text: "The receiver gives the driver a 4-digit code. No code, no \"delivered\".",
        why2Title: "Live tracking",
        why2Text: "See where your goods are on the map, with the distance left.",
        why3Title: "Fair prices",
        why3Text: "Price guides from real deals on the same route or product. Never invented.",
        why4Title: "No empty trips",
        why4Text: "Drivers see return loads from the city they are delivering to.",
        why5Title: "Mobile money",
        why5Text: "Pay the way Cameroon pays: MTN MoMo, Orange Money or cash.",
        why6Title: "Secure by design",
        why6Text: "PIN-protected accounts, private phone numbers, locked-down data.",
        why7Title: "Light on data",
        why7Text: "Photos are shrunk on your phone before upload. Works on any smartphone.",
        why8Title: "Your language",
        why8Text: "French and English, with local names for produce.",

        // Countries
        countriesTitle: "Across Cameroon",
        countriesText: "From Douala and Yaoundé to Bafoussam, Garoua and Maroua: FCFA prices, Mobile Money and the towns you know. The rest of Africa comes next.",

        // Founder teaser and quotes
        quoteTitle: "Africa, forward",
        visionTitle: "Our mission",
        visionText: "Build the digital infrastructure that connects Africa's agricultural supply with commercial demand, and makes moving goods simple, fair and safe.",

        // FAQ
        faqTitle: "Questions people ask",
        faq1q: "Is Tayeb free?",
        faq1a: "Yes. Posting loads, listing produce and ordering are free today.",
        faq2q: "How do I pay?",
        faq2a: "Buyers pay farmers directly by mobile money or cash, as agreed in the order. Shippers pay drivers the price they agreed in the app.",
        faq3q: "How do I know my goods arrived?",
        faq3a: "Every delivery has a 4-digit code. The receiver gives it to the driver only when the goods are in their hands.",
        faq4q: "Where does Tayeb work?",
        faq4a: "Tayeb works across Cameroon, in all ten regions. Other African countries come next.",
        faq5q: "Is my phone number shared?",
        faq5a: "No. Your number is shown only to the person you agree a deal with, after it's confirmed.",
        faq6q: "Do I need to install an app?",
        faq6a: "No. Tayeb works in your phone's browser, and you can add it to your home screen like an app.",

        // CTA
        ctaTitle: "Ready to move?",
        ctaText: "Join the farmers, buyers and drivers building Cameroon's new market.",
        ctaStart: "Get started free",

        // Footer
        footerAbout: "Cameroon's farm market and delivery, in one app.",
        footerMarket: "Market",
        footerCompany: "Tayeb",
        footerStory: "Our story",
        footerFeedback: "Feedback",
        footerSupport: "WhatsApp support",
        footerCountries: "Towns",
        footerRights: "Tayeb. Built in Cameroon, for Africa.",

        // Install
        installTitle: "Add Tayeb to your home screen",
        installText: "Opens like an app, uses little data.",
        installButton: "Install",
        installLater: "Later",

        // Share
        share: "Share",
        shareWhatsApp: "WhatsApp",
        shareFacebook: "Facebook",
        shareTelegram: "Telegram",
        shareSms: "SMS",
        shareCopy: "Copy link",
        shareCopied: "Link copied",

        // About
        aboutSeoTitle: "Our story — Tayeb, founded by Yuhala Darren",
        aboutSeoDescription: "Why Tayeb exists: Yuhala Darren, from Polytech Yaoundé, is building the digital infrastructure that connects Africa's farms, buyers and transporters.",
        aboutEyebrow: "OUR STORY",
        aboutTitle: "Fixing how Africa feeds and moves itself.",
        aboutIntro: "Across Africa, good food rots in the fields while markets in the cities pay too much for too little. Trucks drive back empty. Farmers sell to the first trader who comes, without knowing the price in the next city. Nobody is to blame alone: the connections are simply missing.",
        problemTitle: "What is broken",
        problem1: "Farmers can't reach buyers beyond their village, so they take the first price.",
        problem2: "Produce spoils while it waits for a buyer or a truck.",
        problem3: "Trucks run empty on the way back, and transport costs climb.",
        problem4: "Buyers can't find reliable supply or trust deliveries.",
        founderEyebrow: "THE FOUNDER",
        founderRole: "Founder of Tayeb",
        founderStory1: "I'm {name}, {nationality}, from {school}. I see these problems around me every day, and I decided to take them on as an engineering challenge.",
        founderStory2: "Tayeb is my answer: one platform where a farmer can list a harvest from her phone, a restaurant in another city can order it, and a driver nearby can carry it, with a code that proves it arrived.",
        founderStory3: "I started in Cameroon. The goal is the whole continent. This is not just an app; it is infrastructure that Africa deserves, built here, by us.",
        founderSignature: "— {name}",
        valuesTitle: "What we stand for",
        value1: "Fairness for the people who grow our food.",
        value2: "Trust you can check: codes, tracking, ratings.",
        value3: "Simplicity: if it needs a manual, we failed.",
        value4: "Security and privacy by default.",
        joinTitle: "Build it with us",
        joinText: "Farmers, buyers, drivers, partners and investors: let's talk.",
        contactFounder: "Message the founder",
    },

    fr: {
        seoTitle: "Tayeb — Achetez à la ferme, envoyez, livrez partout au Cameroun",
        seoDescription: "Tayeb relie agriculteurs, acheteurs et transporteurs partout au Cameroun. Achetez directement à la ferme, envoyez toute marchandise et faites livrer par le chauffeur le plus proche, avec suivi en direct, code de livraison et Mobile Money.",
        tagline: "Le marché agricole et la livraison du Cameroun, dans une seule app.",

        navMarket: "Marché",
        navSend: "Envoyer",
        navDrive: "Conduire",
        navSell: "Vendre",
        login: "Se connecter",
        dashboard: "Mon espace",

        heroBadge: "Partout au Cameroun · {count} villes",
        heroTitle1: "De la ferme",
        heroTitle2: "à votre porte,",
        heroTitle3: "partout au Cameroun.",
        heroText: "Tayeb relie ceux qui cultivent, ceux qui achètent et ceux qui transportent. Commandez au prix de la ferme, envoyez toute marchandise, et suivez-la jusqu'au bout.",
        searchPlaceholder: "Que cherchez-vous ? Tomates, maïs, bobolo…",
        searchButton: "Chercher",
        actionBuy: "Acheter",
        actionBuyText: "Directement aux agriculteurs",
        actionSell: "Vendre ma récolte",
        actionSellText: "Gratuit, les acheteurs viennent à vous",
        actionSend: "Livrer maintenant",
        actionSendText: "Le chauffeur le plus proche, prix fixe",
        actionDrive: "Conduire et gagner",
        actionDriveText: "Passez en ligne, prenez les courses proches",
        liveNow: "En direct du marché",
        ticker: "{product} · {city} · {price}",

        featuredTitle: "Frais sur le marché",
        featuredText: "De vraies offres d'agriculteurs, mises à jour en continu.",
        seeAll: "Voir tous les produits",
        emptyFeatured: "Les premiers agriculteurs installent leurs étals. Soyez le premier à publier votre récolte.",

        categoriesTitle: "Par catégorie",

        howTitle: "Une plateforme, quatre façons de gagner",
        howBuyers: "Acheteurs",
        howFarmers: "Agriculteurs",
        howShippers: "Expéditeurs",
        howDrivers: "Chauffeurs",
        buyers1: "Trouvez les produits par leur nom, même local : bobolo, ndolè…",
        buyers2: "Commandez la quantité voulue, en livraison Tayeb ou à emporter.",
        buyers3: "Payez l'agriculteur par mobile money à l'arrivée.",
        farmers1: "Publiez votre récolte avec jusqu'à 8 photos, en une minute.",
        farmers2: "Les acheteurs des villes commandent. Vous confirmez d'un geste.",
        farmers3: "Un chauffeur Tayeb vient chercher à la ferme.",
        shippers1: "Publiez votre envoi : quoi, où, et votre prix.",
        shippers2: "Les chauffeurs proposent leurs prix. Vous choisissez.",
        shippers3: "Suivez le camion en direct et confirmez avec le code de livraison.",
        drivers1: "Voyez les chargements près de vous, classés pour vous.",
        drivers2: "Chargements retour depuis là où vous livrez : fini le retour à vide.",
        drivers3: "Soyez payé pour chaque livraison terminée.",

        whyTitle: "Pensé pour le commerce camerounais réel",
        whyText: "Chaque détail est conçu pour de vrais marchés, de vraies routes et de vrais téléphones.",
        why1Title: "Code de livraison",
        why1Text: "Le destinataire donne un code à 4 chiffres au chauffeur. Sans code, pas de « livré ».",
        why2Title: "Suivi en direct",
        why2Text: "Voyez où est votre marchandise sur la carte, avec la distance restante.",
        why3Title: "Prix justes",
        why3Text: "Des repères de prix tirés de vraies transactions. Jamais inventés.",
        why4Title: "Zéro retour à vide",
        why4Text: "Les chauffeurs voient les chargements retour depuis leur ville de livraison.",
        why5Title: "Mobile money",
        why5Text: "Payez comme au Cameroun : MTN MoMo, Orange Money ou espèces.",
        why6Title: "Sécurisé par conception",
        why6Text: "Comptes protégés par PIN, numéros privés, données verrouillées.",
        why7Title: "Léger en données",
        why7Text: "Les photos sont allégées sur votre téléphone avant l'envoi. Marche sur tout smartphone.",
        why8Title: "Votre langue",
        why8Text: "Français et anglais, avec les noms locaux des produits.",

        countriesTitle: "Partout au Cameroun",
        countriesText: "De Douala et Yaoundé à Bafoussam, Garoua et Maroua : prix en FCFA, Mobile Money et les villes que vous connaissez. Le reste de l'Afrique suivra.",

        quoteTitle: "L'Afrique, en avant",
        visionTitle: "Notre mission",
        visionText: "Construire l'infrastructure numérique qui relie l'offre agricole africaine à la demande commerciale, et rendre le transport des marchandises simple, juste et sûr.",

        faqTitle: "Questions fréquentes",
        faq1q: "Tayeb est-il gratuit ?",
        faq1a: "Oui. Publier un envoi, vendre sa récolte et commander sont gratuits aujourd'hui.",
        faq2q: "Comment payer ?",
        faq2a: "Les acheteurs paient l'agriculteur directement par mobile money ou en espèces, comme prévu dans la commande. Les expéditeurs paient au chauffeur le prix convenu dans l'app.",
        faq3q: "Comment savoir que ma marchandise est arrivée ?",
        faq3a: "Chaque livraison a un code à 4 chiffres. Le destinataire le donne au chauffeur seulement quand la marchandise est entre ses mains.",
        faq4q: "Où Tayeb fonctionne-t-il ?",
        faq4a: "Tayeb fonctionne partout au Cameroun, dans les dix régions. Les autres pays africains suivront.",
        faq5q: "Mon numéro est-il partagé ?",
        faq5a: "Non. Votre numéro n'est montré qu'à la personne avec qui vous concluez, une fois l'accord confirmé.",
        faq6q: "Faut-il installer une application ?",
        faq6a: "Non. Tayeb fonctionne dans le navigateur de votre téléphone, et vous pouvez l'ajouter à l'écran d'accueil comme une app.",

        ctaTitle: "Prêt à avancer ?",
        ctaText: "Rejoignez les agriculteurs, acheteurs et chauffeurs qui bâtissent le nouveau marché camerounais.",
        ctaStart: "Commencer gratuitement",

        footerAbout: "Le marché agricole et la livraison du Cameroun, dans une seule app.",
        footerMarket: "Marché",
        footerCompany: "Tayeb",
        footerStory: "Notre histoire",
        footerFeedback: "Avis",
        footerSupport: "Assistance WhatsApp",
        footerCountries: "Villes",
        footerRights: "Tayeb. Conçu au Cameroun, pour l'Afrique.",

        installTitle: "Ajoutez Tayeb à votre écran d'accueil",
        installText: "S'ouvre comme une app, consomme peu de données.",
        installButton: "Installer",
        installLater: "Plus tard",

        share: "Partager",
        shareWhatsApp: "WhatsApp",
        shareFacebook: "Facebook",
        shareTelegram: "Telegram",
        shareSms: "SMS",
        shareCopy: "Copier le lien",
        shareCopied: "Lien copié",

        aboutSeoTitle: "Notre histoire — Tayeb, fondé par Yuhala Darren",
        aboutSeoDescription: "Pourquoi Tayeb existe : Yuhala Darren, de Polytech Yaoundé, construit l'infrastructure numérique qui relie les fermes, les acheteurs et les transporteurs d'Afrique.",
        aboutEyebrow: "NOTRE HISTOIRE",
        aboutTitle: "Réparer la façon dont l'Afrique se nourrit et se déplace.",
        aboutIntro: "Partout en Afrique, de bons produits pourrissent dans les champs pendant que les marchés des villes paient trop cher pour trop peu. Les camions rentrent à vide. Les agriculteurs vendent au premier commerçant qui passe, sans connaître le prix de la ville voisine. Personne n'est seul responsable : ce sont les connexions qui manquent.",
        problemTitle: "Ce qui ne marche pas",
        problem1: "Les agriculteurs n'atteignent pas les acheteurs au-delà de leur village, alors ils prennent le premier prix.",
        problem2: "Les produits s'abîment en attendant un acheteur ou un camion.",
        problem3: "Les camions rentrent à vide et le coût du transport grimpe.",
        problem4: "Les acheteurs ne trouvent pas d'offre fiable ni de livraison de confiance.",
        founderEyebrow: "LE FONDATEUR",
        founderRole: "Fondateur de Tayeb",
        founderStory1: "Je suis {name}, {nationality}, de {school}. Je vois ces problèmes autour de moi chaque jour, et j'ai décidé de les relever comme un défi d'ingénieur.",
        founderStory2: "Tayeb est ma réponse : une plateforme où une agricultrice publie sa récolte depuis son téléphone, où un restaurant d'une autre ville la commande, et où un chauffeur proche la transporte, avec un code qui prouve qu'elle est arrivée.",
        founderStory3: "J'ai commencé au Cameroun. L'objectif, c'est tout le continent. Ce n'est pas qu'une application : c'est l'infrastructure que l'Afrique mérite, construite ici, par nous.",
        founderSignature: "— {name}",
        valuesTitle: "Nos valeurs",
        value1: "L'équité pour ceux qui cultivent notre nourriture.",
        value2: "Une confiance vérifiable : codes, suivi, notes.",
        value3: "La simplicité : s'il faut un mode d'emploi, nous avons échoué.",
        value4: "Sécurité et vie privée par défaut.",
        joinTitle: "Construisons-le ensemble",
        joinText: "Agriculteurs, acheteurs, chauffeurs, partenaires et investisseurs : parlons-en.",
        contactFounder: "Écrire au fondateur",
    },
};

export function siteText(language, key, vars) {
    let text = (TEXT[language] || TEXT.en)[key] ?? TEXT.en[key] ?? key;

    if (vars) {
        for (const [name, value] of Object.entries(vars)) {
            text = text.split(`{${name}}`).join(String(value ?? ""));
        }
    }

    return text;
}

export function useSiteText() {
    const { language } = useLanguage();

    return useMemo(() => (key, vars) => siteText(language, key, vars), [language]);
}
