/*
 * ============================================================
 * TAYEB COUNTRIES
 * ============================================================
 *
 * Everything that changes from one African country to the
 * next: phone format, currency, time zone, mobile money and
 * cities. Shared by the browser and the server.
 *
 * dial:     country calling code
 * nsn:      [min, max] digits of the national number (without
 *           the country code or a leading 0)
 * currency: ISO code used for prices
 * utc:      hours ahead of UTC (for "today" and harvest dates)
 * money:    mobile money and payment brands people know
 * cities:   main cities with approximate centre coordinates,
 *           used for matching and "about X km"
 */

export const COUNTRIES = [
    {
        code: "CM", en: "Cameroon", fr: "Cameroun", flag: "🇨🇲", dial: "237", nsn: [9, 9],
        currency: "XAF", language: "fr", utc: 1, money: ["MTN MoMo", "Orange Money"],
        cities: [
            ["Douala", 4.0511, 9.7679], ["Yaoundé", 3.848, 11.5021], ["Bafoussam", 5.4778, 10.4176],
            ["Bamenda", 5.9631, 10.1591], ["Garoua", 9.3017, 13.3921], ["Maroua", 10.5956, 14.3247],
            ["Ngaoundéré", 7.3167, 13.5833], ["Bertoua", 4.5772, 13.6846], ["Ebolowa", 2.9, 11.15],
            ["Kribi", 2.95, 9.91], ["Limbe", 4.0167, 9.2], ["Buea", 4.1527, 9.241],
            ["Kumba", 4.6363, 9.4469], ["Tiko", 4.075, 9.36], ["Edéa", 3.8, 10.1333],
            ["Nkongsamba", 4.9547, 9.9404], ["Loum", 4.7167, 9.7333], ["Mbanga", 4.5, 9.5667],
            ["Dschang", 5.45, 10.0667], ["Mbouda", 5.6333, 10.25], ["Bafang", 5.15, 10.1833],
            ["Bangangté", 5.15, 10.5167], ["Foumban", 5.7167, 10.9], ["Foumbot", 5.5167, 10.6333],
            ["Kumbo", 6.2, 10.6667], ["Mamfe", 5.7667, 9.2833], ["Mbalmayo", 3.5167, 11.5],
            ["Obala", 4.1667, 11.5333], ["Bafia", 4.75, 11.2333], ["Eséka", 3.65, 10.7667],
            ["Sangmélima", 2.9333, 11.9833], ["Abong-Mbang", 3.9833, 13.1833], ["Batouri", 4.4333, 14.3667],
            ["Yokadouma", 3.5167, 15.05], ["Meiganga", 6.5167, 14.3], ["Tibati", 6.4667, 12.6333],
            ["Guider", 9.9333, 13.95], ["Mokolo", 10.7333, 13.8], ["Yagoua", 10.3333, 15.2333],
            ["Kousséri", 12.0769, 15.0306],
        ],
    },
    {
        code: "NG", en: "Nigeria", fr: "Nigeria", flag: "🇳🇬", dial: "234", nsn: [10, 10],
        currency: "NGN", language: "en", utc: 1, money: ["OPay", "PalmPay", "Moniepoint", "bank transfer"],
        cities: [
            ["Lagos", 6.5244, 3.3792], ["Abuja", 9.0765, 7.3986], ["Kano", 12.0022, 8.592],
            ["Ibadan", 7.3775, 3.947], ["Port Harcourt", 4.8156, 7.0498], ["Benin City", 6.335, 5.6037],
            ["Kaduna", 10.5105, 7.4165], ["Jos", 9.8965, 8.8583], ["Enugu", 6.4584, 7.5464],
            ["Onitsha", 6.1413, 6.8029], ["Aba", 5.1066, 7.3667], ["Ilorin", 8.4966, 4.5426],
            ["Maiduguri", 11.8311, 13.151], ["Calabar", 4.9757, 8.3417], ["Owerri", 5.4836, 7.0333],
            ["Abeokuta", 7.1475, 3.3619], ["Makurdi", 7.7322, 8.5391], ["Sokoto", 13.0059, 5.2476],
        ],
    },
    {
        code: "GH", en: "Ghana", fr: "Ghana", flag: "🇬🇭", dial: "233", nsn: [9, 9],
        currency: "GHS", language: "en", utc: 0, money: ["MTN MoMo", "Telecel Cash", "AirtelTigo Money"],
        cities: [
            ["Accra", 5.6037, -0.187], ["Kumasi", 6.6885, -1.6244], ["Tamale", 9.4008, -0.8393],
            ["Takoradi", 4.8845, -1.7554], ["Cape Coast", 5.1053, -1.2466], ["Tema", 5.6698, -0.0166],
            ["Sunyani", 7.3349, -2.3123], ["Ho", 6.6008, 0.4713], ["Koforidua", 6.094, -0.2591],
            ["Techiman", 7.5909, -1.939], ["Bolgatanga", 10.7856, -0.8514], ["Wa", 10.0601, -2.5099],
        ],
    },
    {
        code: "CI", en: "Côte d'Ivoire", fr: "Côte d'Ivoire", flag: "🇨🇮", dial: "225", nsn: [10, 10],
        currency: "XOF", language: "fr", utc: 0, money: ["Orange Money", "MTN MoMo", "Wave", "Moov Money"],
        cities: [
            ["Abidjan", 5.36, -4.0083], ["Bouaké", 7.6906, -5.0391], ["Yamoussoukro", 6.8276, -5.2893],
            ["Daloa", 6.8774, -6.4502], ["San-Pédro", 4.7485, -6.6363], ["Korhogo", 9.458, -5.6296],
            ["Man", 7.4125, -7.5538], ["Gagnoa", 6.1319, -5.9506], ["Abengourou", 6.7297, -3.4964],
            ["Divo", 5.8372, -5.3572], ["Soubré", 5.7856, -6.6083],
        ],
    },
    {
        code: "SN", en: "Senegal", fr: "Sénégal", flag: "🇸🇳", dial: "221", nsn: [9, 9],
        currency: "XOF", language: "fr", utc: 0, money: ["Wave", "Orange Money", "Free Money"],
        cities: [
            ["Dakar", 14.7167, -17.4677], ["Thiès", 14.791, -16.9359], ["Touba", 14.85, -15.8833],
            ["Saint-Louis", 16.0179, -16.4896], ["Kaolack", 14.152, -16.0726], ["Ziguinchor", 12.5681, -16.2719],
            ["Mbour", 14.42, -16.964], ["Tambacounda", 13.7707, -13.6673], ["Louga", 15.6144, -16.2286],
            ["Kolda", 12.8939, -14.9406],
        ],
    },
    {
        code: "KE", en: "Kenya", fr: "Kenya", flag: "🇰🇪", dial: "254", nsn: [9, 9],
        currency: "KES", language: "en", utc: 3, money: ["M-Pesa", "Airtel Money"],
        cities: [
            ["Nairobi", -1.2921, 36.8219], ["Mombasa", -4.0435, 39.6682], ["Kisumu", -0.0917, 34.768],
            ["Nakuru", -0.3031, 36.08], ["Eldoret", 0.5143, 35.2698], ["Thika", -1.0332, 37.0693],
            ["Meru", 0.047, 37.6498], ["Kisii", -0.6773, 34.7796], ["Nyeri", -0.4201, 36.9476],
            ["Machakos", -1.5177, 37.2634], ["Kitale", 1.0157, 35.0062],
        ],
    },
    {
        code: "GA", en: "Gabon", fr: "Gabon", flag: "🇬🇦", dial: "241", nsn: [7, 9],
        currency: "XAF", language: "fr", utc: 1, money: ["Airtel Money", "Moov Money"],
        cities: [
            ["Libreville", 0.4162, 9.4673], ["Port-Gentil", -0.7193, 8.7815], ["Franceville", -1.6333, 13.5833],
            ["Oyem", 1.5995, 11.5793], ["Moanda", -1.5667, 13.2], ["Lambaréné", -0.7, 10.2333],
        ],
    },
    {
        code: "CG", en: "Congo", fr: "Congo", flag: "🇨🇬", dial: "242", nsn: [9, 9],
        currency: "XAF", language: "fr", utc: 1, money: ["MTN MoMo", "Airtel Money"],
        cities: [
            ["Brazzaville", -4.2634, 15.2429], ["Pointe-Noire", -4.7692, 11.8664], ["Dolisie", -4.1989, 12.6666],
            ["Nkayi", -4.1833, 13.2833], ["Ouesso", 1.6136, 16.0517], ["Owando", -0.4819, 15.8999],
        ],
    },
    {
        code: "CD", en: "DR Congo", fr: "RD Congo", flag: "🇨🇩", dial: "243", nsn: [9, 9],
        currency: "CDF", language: "fr", utc: 1, money: ["M-Pesa", "Orange Money", "Airtel Money"],
        cities: [
            ["Kinshasa", -4.4419, 15.2663], ["Lubumbashi", -11.6609, 27.4794], ["Mbuji-Mayi", -6.136, 23.5898],
            ["Kananga", -5.8962, 22.4166], ["Kisangani", 0.5153, 25.191], ["Bukavu", -2.5083, 28.8608],
            ["Goma", -1.6792, 29.2228], ["Matadi", -5.8167, 13.45], ["Kolwezi", -10.7148, 25.4667],
        ],
    },
    {
        code: "BJ", en: "Benin", fr: "Bénin", flag: "🇧🇯", dial: "229", nsn: [8, 10],
        currency: "XOF", language: "fr", utc: 1, money: ["MTN MoMo", "Moov Money", "Celtiis Cash"],
        cities: [
            ["Cotonou", 6.3703, 2.3912], ["Porto-Novo", 6.4969, 2.6283], ["Parakou", 9.3372, 2.6303],
            ["Abomey-Calavi", 6.4485, 2.3557], ["Djougou", 9.7085, 1.666], ["Bohicon", 7.1782, 2.0667],
            ["Natitingou", 10.3042, 1.3796], ["Lokossa", 6.6386, 1.7167],
        ],
    },
    {
        code: "TG", en: "Togo", fr: "Togo", flag: "🇹🇬", dial: "228", nsn: [8, 8],
        currency: "XOF", language: "fr", utc: 0, money: ["Mixx by Yas", "Flooz"],
        cities: [
            ["Lomé", 6.1319, 1.2228], ["Sokodé", 8.9833, 1.1333], ["Kara", 9.5511, 1.1861],
            ["Kpalimé", 6.9, 0.6333], ["Atakpamé", 7.5333, 1.1333], ["Dapaong", 10.8622, 0.2056],
            ["Tsévié", 6.4261, 1.2133],
        ],
    },
    {
        code: "BF", en: "Burkina Faso", fr: "Burkina Faso", flag: "🇧🇫", dial: "226", nsn: [8, 8],
        currency: "XOF", language: "fr", utc: 0, money: ["Orange Money", "Moov Money"],
        cities: [
            ["Ouagadougou", 12.3714, -1.5197], ["Bobo-Dioulasso", 11.1771, -4.2979], ["Koudougou", 12.2526, -2.3627],
            ["Banfora", 10.6333, -4.7667], ["Ouahigouya", 13.5828, -2.4216], ["Kaya", 13.0917, -1.0844],
            ["Fada N'Gourma", 12.0614, 0.3586],
        ],
    },
    {
        code: "ML", en: "Mali", fr: "Mali", flag: "🇲🇱", dial: "223", nsn: [8, 8],
        currency: "XOF", language: "fr", utc: 0, money: ["Orange Money", "Moov Money"],
        cities: [
            ["Bamako", 12.6392, -8.0029], ["Sikasso", 11.3176, -5.6665], ["Ségou", 13.4317, -6.2157],
            ["Mopti", 14.4843, -4.183], ["Kayes", 14.4469, -11.4445], ["Koutiala", 12.3917, -5.4642],
            ["Gao", 16.2717, -0.0447],
        ],
    },
    {
        code: "NE", en: "Niger", fr: "Niger", flag: "🇳🇪", dial: "227", nsn: [8, 8],
        currency: "XOF", language: "fr", utc: 1, money: ["Airtel Money", "Moov Money"],
        cities: [
            ["Niamey", 13.5116, 2.1254], ["Zinder", 13.8053, 8.9881], ["Maradi", 13.5, 7.1017],
            ["Tahoua", 14.8888, 5.2692], ["Agadez", 16.9742, 7.9865], ["Dosso", 13.049, 3.1937],
        ],
    },
    {
        code: "GN", en: "Guinea", fr: "Guinée", flag: "🇬🇳", dial: "224", nsn: [9, 9],
        currency: "GNF", language: "fr", utc: 0, money: ["Orange Money", "MTN MoMo"],
        cities: [
            ["Conakry", 9.6412, -13.5784], ["Nzérékoré", 7.7562, -8.8179], ["Kankan", 10.3854, -9.3057],
            ["Kindia", 10.0569, -12.8658], ["Labé", 11.3182, -12.2833], ["Mamou", 10.3755, -12.0915],
        ],
    },
    {
        code: "TD", en: "Chad", fr: "Tchad", flag: "🇹🇩", dial: "235", nsn: [8, 8],
        currency: "XAF", language: "fr", utc: 1, money: ["Airtel Money", "Moov Money"],
        cities: [
            ["N'Djamena", 12.1348, 15.0557], ["Moundou", 8.5667, 16.0833], ["Sarh", 9.1429, 18.3923],
            ["Abéché", 13.8292, 20.8324], ["Kélo", 9.3086, 15.8066],
        ],
    },
    {
        code: "CF", en: "Central African Republic", fr: "Centrafrique", flag: "🇨🇫", dial: "236", nsn: [8, 8],
        currency: "XAF", language: "fr", utc: 1, money: ["Orange Money", "Moov Money"],
        cities: [
            ["Bangui", 4.3947, 18.5582], ["Bimbo", 4.2567, 18.4158], ["Berbérati", 4.2612, 15.7922],
            ["Bambari", 5.768, 20.6757], ["Bouar", 5.9341, 15.5961],
        ],
    },
    {
        code: "RW", en: "Rwanda", fr: "Rwanda", flag: "🇷🇼", dial: "250", nsn: [9, 9],
        currency: "RWF", language: "en", utc: 2, money: ["MTN MoMo", "Airtel Money"],
        cities: [
            ["Kigali", -1.9441, 30.0619], ["Huye", -2.5967, 29.7394], ["Musanze", -1.4998, 29.6347],
            ["Rubavu", -1.6939, 29.2569], ["Rwamagana", -1.9487, 30.4347], ["Muhanga", -2.0845, 29.7566],
        ],
    },
    {
        code: "UG", en: "Uganda", fr: "Ouganda", flag: "🇺🇬", dial: "256", nsn: [9, 9],
        currency: "UGX", language: "en", utc: 3, money: ["MTN MoMo", "Airtel Money"],
        cities: [
            ["Kampala", 0.3476, 32.5825], ["Gulu", 2.7724, 32.2881], ["Mbarara", -0.6072, 30.6545],
            ["Jinja", 0.4244, 33.2042], ["Mbale", 1.0827, 34.175], ["Lira", 2.2499, 32.8999],
            ["Masaka", -0.341, 31.7341], ["Fort Portal", 0.6617, 30.2748],
        ],
    },
    {
        code: "TZ", en: "Tanzania", fr: "Tanzanie", flag: "🇹🇿", dial: "255", nsn: [9, 9],
        currency: "TZS", language: "en", utc: 3, money: ["M-Pesa", "Mixx by Yas", "Airtel Money"],
        cities: [
            ["Dar es Salaam", -6.7924, 39.2083], ["Dodoma", -6.163, 35.7516], ["Arusha", -3.3869, 36.683],
            ["Mwanza", -2.5164, 32.9175], ["Mbeya", -8.9094, 33.4608], ["Morogoro", -6.8278, 37.6591],
            ["Tanga", -5.0689, 39.0988], ["Moshi", -3.3348, 37.3404],
        ],
    },
];

export const DEFAULT_COUNTRY = "CM";

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));

export function findCountry(code) {
    return BY_CODE.get(String(code || "").toUpperCase()) || null;
}

export function countryOrDefault(code) {
    return findCountry(code) || BY_CODE.get(DEFAULT_COUNTRY);
}

export function countryName(code, language) {
    const country = findCountry(code);

    if (!country) {
        return "";
    }

    return language === "fr" ? country.fr : country.en;
}

/*
 * Countries sorted by name in the reader's language, with
 * Cameroon (where Tayeb started) first.
 */
export function sortedCountries(language) {
    return [...COUNTRIES].sort((a, b) => {
        if (a.code === DEFAULT_COUNTRY) return -1;
        if (b.code === DEFAULT_COUNTRY) return 1;

        return countryName(a.code, language).localeCompare(countryName(b.code, language), language);
    });
}

/*
 * Today's date (YYYY-MM-DD) in a country's time zone.
 */
export function todayIn(code) {
    const country = countryOrDefault(code);

    return new Date(Date.now() + country.utc * 3600000).toISOString().slice(0, 10);
}

/*
 * "MTN MoMo or Orange Money" / "MTN MoMo ou Orange Money".
 */
export function moneyBrands(code, language) {
    const brands = countryOrDefault(code).money;

    if (brands.length <= 1) {
        return brands.join("");
    }

    const joiner = language === "fr" ? " ou " : " or ";

    return `${brands.slice(0, -1).join(", ")}${joiner}${brands[brands.length - 1]}`;
}
