import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

const LanguageContext = createContext(null);

const translations = {
    en: {
        common: {
            appName: "Tayeb",
            tagline: "Move. Manage. Deliver.",

            english: "English",
            french: "Français",

            save: "Save",
            cancel: "Cancel",
            close: "Close",
            back: "Back",
            continue: "Continue",
            confirm: "Confirm",
            done: "Done",
            loading: "Loading...",
            search: "Search",
            submit: "Submit",
            update: "Update",
            delete: "Delete",
            edit: "Edit",
            view: "View",

            yes: "Yes",
            no: "No",

            today: "Today",
            now: "Now",

            price: "Price",
            phone: "Phone",
            phoneNumber: "Phone number",
            name: "Name",
            fullName: "Full name",

            location: "Location",
            address: "Address",
            status: "Status",
            details: "Details",

            available: "Available",
            unavailable: "Unavailable",
            online: "Online",
            offline: "Offline",

            verified: "Verified",

            driver: "Driver",
            shipper: "Shipper",

            cargo: "Cargo",
            delivery: "Delivery",
            deliveries: "Deliveries",

            rating: "Rating",
            ratings: "Ratings",

            vehicle: "Vehicle",
            vehicleType: "Vehicle type",
            plateNumber: "Plate number",

            message: "Message",
            messages: "Messages",

            notifications: "Notifications",
            settings: "Settings",
            profile: "Profile",

            logout: "Log out",

            error: "Something went wrong.",
            tryAgain: "Try again",
            noResults: "Nothing found.",
            noData: "No data available.",

            quantity: "Quantity",
            description: "Description",

            pickup: "Pickup",
            destination: "Destination",
            origin: "Pickup location",

            receiver: "Receiver",
            receiverName: "Receiver name",
            receiverPhone: "Receiver phone",

            note: "Note",
            optional: "Optional",

            currency: "Currency",

            offer: "Offer",
            offers: "Offers",

            select: "Select",
            selected: "Selected",

            change: "Change",

            date: "Date",
            time: "Time",

            hours: "hours",
            minutes: "minutes",

            confirmAction: "Confirm action",
        },

        landing: {
            navHow: "How it works",
            navShippers: "For shippers",
            navDrivers: "For drivers",
            navLogin: "Log in",

            smallTitle:
                "Simple delivery. Better connections.",

            heroTitle:
                "Move your cargo.",

            heroTitle2:
                "Move with confidence.",

            heroText:
                "Find the right driver, agree on the price, and manage your delivery from start to finish.",

            sendCargo:
                "SEND CARGO",

            driveEarn:
                "DRIVE & EARN",

            howLabel:
                "HOW IT WORKS",

            howTitle:
                "Moving cargo should be simple.",

            howText:
                "Tayeb brings the sender and driver together in one smooth experience.",

            stepOneTitle:
                "Tell us what you need to move",

            stepOneText:
                "Enter your cargo, where it is going, and the price you have in mind.",

            stepTwoTitle:
                "Choose the right driver",

            stepTwoText:
                "See driver prices, ratings, vehicles, and delivery history before you choose.",

            stepThreeTitle:
                "Follow your delivery",

            stepThreeText:
                "Know what is happening from pickup until your cargo arrives.",

            shipperLabel:
                "FOR SHIPPERS",

            shipperTitle:
                "Your cargo. Your choice.",

            shipperText:
                "Post your cargo and receive prices from available drivers. Compare the offers and choose the driver that works best for you.",

            driverLabel:
                "FOR DRIVERS",

            driverTitle:
                "More cargo. More opportunities.",

            driverText:
                "Find available cargo, send your price, get selected, and complete deliveries. Build your reputation with every successful delivery.",

            trustLabel:
                "TRUST",

            trustTitle:
                "Know who you're doing business with.",

            trustText:
                "See the information you need before working with another person.",

            simpleTitle:
                "Everything stays clear.",

            simpleText:
                "Clear prices. Clear driver information. Clear delivery updates. No complicated words. No confusion.",

            finalTitle:
                "Ready to move?",

            finalText:
                "Whether you have cargo to send or a vehicle ready to work, Tayeb makes the next step simple.",

            footerText:
                "Move. Manage. Deliver.",

            privacy:
                "Privacy",

            terms:
                "Terms",
        },

        login: {
            welcome:
                "Welcome to Tayeb",

            subtitle:
                "Choose how you want to use Tayeb.",

            shipper:
                "I want to send cargo",

            driver:
                "I want to drive",

            fullName:
                "Full name",

            phoneNumber:
                "Phone number",

            chooseRole:
                "Choose your role",

            continue:
                "Continue",

            alreadyHaveAccount:
                "Enter your details to continue.",

            invalidName:
                "Please enter your full name.",

            invalidPhone:
                "Please enter a valid phone number.",

            accountReady:
                "Your account is ready.",

            loggingIn:
                "Setting up your account...",
        },

        shipper: {
            greeting:
                "Hello",

            dashboard:
                "Shipper dashboard",

            sendCargo:
                "Send cargo",

            myShipments:
                "My shipments",

            activeShipments:
                "Active shipments",

            completedShipments:
                "Completed deliveries",

            shipmentHistory:
                "Delivery history",

            postCargo:
                "Send a cargo",

            cargoDetails:
                "Cargo details",

            whatAreYouSending:
                "What are you sending?",

            cargoDescription:
                "Tell the driver what needs to be carried.",

            pickupLocation:
                "Where should it be picked up?",

            deliveryLocation:
                "Where should it be delivered?",

            yourPrice:
                "Your price",

            priceHint:
                "Enter the amount without worrying about the currency.",

            chooseDriver:
                "Choose a driver",

            driverOffers:
                "Driver offers",

            noOffers:
                "No driver offers yet.",

            waitingForOffers:
                "Waiting for drivers to send their prices.",

            offerPrice:
                "Offer price",

            driverMessage:
                "Driver message",

            driverRating:
                "Driver rating",

            completed:
                "Completed",

            acceptOffer:
                "Accept offer",

            suggestPrice:
                "Suggest another price",

            suggestedPrice:
                "Your suggested price",

            sendPrice:
                "Send price",

            selectedDriver:
                "Selected driver",

            driverInformation:
                "Driver information",

            shipmentPosted:
                "Your cargo has been posted.",

            offerAccepted:
                "Driver selected successfully.",

            counterSent:
                "Your new price has been sent to the driver.",

            pickup:
                "Pickup",

            onTheWay:
                "On the way",

            arrived:
                "Arrived",

            delivered:
                "Delivered",

            cancelShipment:
                "Cancel shipment",
        },

        driver: {
            greeting:
                "Hello",

            dashboard:
                "Driver dashboard",

            availableJobs:
                "Available cargo",

            myJobs:
                "My deliveries",

            currentDelivery:
                "Current delivery",

            completedDeliveries:
                "Completed deliveries",

            availability:
                "My availability",

            availableNow:
                "Available now",

            busyNow:
                "Busy now",

            turnOn:
                "Turn on availability",

            turnOff:
                "Turn off availability",

            cargoAvailable:
                "Cargo available",

            noCargo:
                "No suitable cargo right now.",

            checkAgain:
                "Check again later.",

            sendOffer:
                "Send your price",

            yourPrice:
                "Your price",

            priceHint:
                "Enter the amount. You do not need to type the currency.",

            arrivalTime:
                "When can you arrive?",

            note:
                "Message",

            optional:
                "Optional",

            sendOfferButton:
                "Send offer",

            updateOffer:
                "Update offer",

            suggestPrice:
                "Suggest another price",

            selected:
                "You were selected",

            notSelected:
                "Another driver was selected",

            pickup:
                "Pickup",

            startDelivery:
                "Start delivery",

            onTheWay:
                "On the way",

            arrived:
                "I have arrived",

            completeDelivery:
                "Complete delivery",

            shipperInformation:
                "Shipper information",

            offerSent:
                "Your price has been sent.",

            counterReceived:
                "The shipper suggested another price.",

            accepted:
                "Your offer was accepted.",
        },

        notifications: {
            title:
                "Notifications",

            noNotifications:
                "No notifications yet.",

            markRead:
                "Mark as read",

            markAllRead:
                "Mark all as read",

            newCargo:
                "New cargo available",

            newOffer:
                "New offer from a driver",

            newPrice:
                "New price suggestion",

            selected:
                "You were selected",

            notSelected:
                "Another driver was selected",

            shipmentStarted:
                "Delivery has started",

            driverArrived:
                "Driver has arrived",

            deliveryCompleted:
                "Delivery completed",

            shipmentUpdated:
                "Cargo updated",
        },

        status: {
            open:
                "Open",

            pending:
                "Pending",

            offered:
                "Offer received",

            countered:
                "New price suggested",

            accepted:
                "Accepted",

            matched:
                "Driver selected",

            departed:
                "On the way",

            arrived:
                "Arrived",

            completed:
                "Completed",

            cancelled:
                "Cancelled",
        },

        errors: {
            somethingWrong:
                "Something went wrong. Please try again.",

            connection:
                "We cannot connect right now. Please check your internet connection.",

            required:
                "Please fill in all required fields.",

            invalidPrice:
                "Please enter a valid price.",

            invalidPhone:
                "Please enter a valid phone number.",

            notFound:
                "We could not find what you are looking for.",

            notAllowed:
                "You are not allowed to do this.",
        },

        profile: {
            title:
                "Profile",

            edit:
                "Edit profile",

            photo:
                "Profile photo",

            vehicleType:
                "Vehicle type",

            plateNumber:
                "Plate number",

            rating:
                "Rating",

            completedDeliveries:
                "Completed deliveries",

            availability:
                "Availability",

            saveChanges:
                "Save changes",

            changesSaved:
                "Your changes have been saved.",
        },

        settings: {
            title:
                "Settings",

            language:
                "Language",

            account:
                "Account",

            deleteAccount:
                "Delete account",

            deleteAccountWarning:
                "This action cannot be undone.",
        },

        admin: {
            dashboard:
                "Admin dashboard",

            users:
                "Users",

            drivers:
                "Drivers",

            shippers:
                "Shippers",

            shipments:
                "Shipments",

            offers:
                "Offers",

            matches:
                "Matches",

            recentActivity:
                "Recent activity",

            availableDrivers:
                "Available drivers",

            activeDeliveries:
                "Active deliveries",

            completedDeliveries:
                "Completed deliveries",

            totalUsers:
                "Total users",

            totalShipments:
                "Total shipments",

            totalOffers:
                "Total offers",

            accessDenied:
                "Access denied.",
        },

        confirmations: {
            acceptOffer:
                "Accept this driver's offer?",

            cancelShipment:
                "Do you really want to cancel this shipment?",

            logout:
                "Do you really want to log out?",
        },
    },

    fr: {
        common: {
            appName:
                "Tayeb",

            tagline:
                "Déplacez. Gérez. Livrez.",

            english:
                "English",

            french:
                "Français",

            save:
                "Enregistrer",

            cancel:
                "Annuler",

            close:
                "Fermer",

            back:
                "Retour",

            continue:
                "Continuer",

            confirm:
                "Confirmer",

            done:
                "Terminé",

            loading:
                "Chargement...",

            search:
                "Rechercher",

            submit:
                "Envoyer",

            update:
                "Modifier",

            delete:
                "Supprimer",

            edit:
                "Modifier",

            view:
                "Voir",

            yes:
                "Oui",

            no:
                "Non",

            today:
                "Aujourd'hui",

            now:
                "Maintenant",

            price:
                "Prix",

            phone:
                "Téléphone",

            phoneNumber:
                "Numéro de téléphone",

            name:
                "Nom",

            fullName:
                "Nom complet",

            location:
                "Lieu",

            address:
                "Adresse",

            status:
                "Statut",

            details:
                "Détails",

            available:
                "Disponible",

            unavailable:
                "Indisponible",

            online:
                "En ligne",

            offline:
                "Hors ligne",

            verified:
                "Vérifié",

            driver:
                "Chauffeur",

            shipper:
                "Expéditeur",

            cargo:
                "Cargaison",

            delivery:
                "Livraison",

            deliveries:
                "Livraisons",

            rating:
                "Note",

            ratings:
                "Notes",

            vehicle:
                "Véhicule",

            vehicleType:
                "Type de véhicule",

            plateNumber:
                "Numéro de plaque",

            message:
                "Message",

            messages:
                "Messages",

            notifications:
                "Notifications",

            settings:
                "Paramètres",

            profile:
                "Profil",

            logout:
                "Se déconnecter",

            error:
                "Une erreur est survenue.",

            tryAgain:
                "Réessayer",

            noResults:
                "Aucun résultat.",

            noData:
                "Aucune donnée disponible.",

            quantity:
                "Quantité",

            description:
                "Description",

            pickup:
                "Ramassage",

            destination:
                "Destination",

            origin:
                "Lieu de ramassage",

            receiver:
                "Destinataire",

            receiverName:
                "Nom du destinataire",

            receiverPhone:
                "Téléphone du destinataire",

            note:
                "Note",

            optional:
                "Facultatif",

            currency:
                "Monnaie",

            offer:
                "Offre",

            offers:
                "Offres",

            select:
                "Choisir",

            selected:
                "Sélectionné",

            change:
                "Modifier",

            date:
                "Date",

            time:
                "Heure",

            hours:
                "heures",

            minutes:
                "minutes",

            confirmAction:
                "Confirmer l'action",
        },

        landing: {
            navHow:
                "Comment ça marche",

            navShippers:
                "Pour les expéditeurs",

            navDrivers:
                "Pour les chauffeurs",

            navLogin:
                "Se connecter",

            smallTitle:
                "Livraison simple. Meilleures connexions.",

            heroTitle:
                "Déplacez votre cargaison.",

            heroTitle2:
                "Déplacez en toute confiance.",

            heroText:
                "Trouvez le bon chauffeur, convenez du prix et gérez votre livraison du début à la fin.",

            sendCargo:
                "ENVOYER UNE CARGAISON",

            driveEarn:
                "CONDUIRE ET GAGNER",

            howLabel:
                "COMMENT ÇA MARCHE",

            howTitle:
                "Le transport doit rester simple.",

            howText:
                "Tayeb réunit l'expéditeur et le chauffeur dans une expérience simple et fluide.",

            stepOneTitle:
                "Dites-nous ce que vous voulez envoyer",

            stepOneText:
                "Indiquez votre cargaison, sa destination et le prix que vous avez en tête.",

            stepTwoTitle:
                "Choisissez le bon chauffeur",

            stepTwoText:
                "Consultez les prix, les notes, les véhicules et l'expérience des chauffeurs avant de choisir.",

            stepThreeTitle:
                "Suivez votre livraison",

            stepThreeText:
                "Sachez ce qui se passe du ramassage jusqu'à l'arrivée de votre cargaison.",

            shipperLabel:
                "POUR LES EXPÉDITEURS",

            shipperTitle:
                "Votre cargaison. Votre choix.",

            shipperText:
                "Publiez votre cargaison et recevez les prix des chauffeurs disponibles. Comparez les offres et choisissez le chauffeur qui vous convient.",

            driverLabel:
                "POUR LES CHAUFFEURS",

            driverTitle:
                "Plus de cargaisons. Plus d'opportunités.",

            driverText:
                "Trouvez des cargaisons disponibles, envoyez votre prix, soyez sélectionné et effectuez vos livraisons. Construisez votre réputation à chaque livraison réussie.",

            trustLabel:
                "CONFIANCE",

            trustTitle:
                "Sachez avec qui vous travaillez.",

            trustText:
                "Voyez les informations dont vous avez besoin avant de travailler avec quelqu'un.",

            simpleTitle:
                "Tout reste clair.",

            simpleText:
                "Des prix clairs. Des informations claires sur le chauffeur. Des mises à jour claires. Aucun mot compliqué. Aucune confusion.",

            finalTitle:
                "Prêt à bouger ?",

            finalText:
                "Que vous ayez une cargaison à envoyer ou un véhicule prêt à travailler, Tayeb rend la prochaine étape simple.",

            footerText:
                "Déplacez. Gérez. Livrez.",

            privacy:
                "Confidentialité",

            terms:
                "Conditions",
        },

        login: {
            welcome:
                "Bienvenue sur Tayeb",

            subtitle:
                "Choisissez comment vous souhaitez utiliser Tayeb.",

            shipper:
                "Je veux envoyer une cargaison",

            driver:
                "Je veux conduire",

            fullName:
                "Nom complet",

            phoneNumber:
                "Numéro de téléphone",

            chooseRole:
                "Choisissez votre rôle",

            continue:
                "Continuer",

            alreadyHaveAccount:
                "Entrez vos informations pour continuer.",

            invalidName:
                "Veuillez entrer votre nom complet.",

            invalidPhone:
                "Veuillez entrer un numéro de téléphone valide.",

            accountReady:
                "Votre compte est prêt.",

            loggingIn:
                "Préparation de votre compte...",
        },

        shipper: {
            greeting:
                "Bonjour",

            dashboard:
                "Tableau de bord expéditeur",

            sendCargo:
                "Envoyer une cargaison",

            myShipments:
                "Mes cargaisons",

            activeShipments:
                "Cargaisons en cours",

            completedShipments:
                "Livraisons terminées",

            shipmentHistory:
                "Historique des livraisons",

            postCargo:
                "Envoyer une cargaison",

            cargoDetails:
                "Détails de la cargaison",

            whatAreYouSending:
                "Qu'envoyez-vous ?",

            cargoDescription:
                "Indiquez au chauffeur ce qui doit être transporté.",

            pickupLocation:
                "Où doit-elle être récupérée ?",

            deliveryLocation:
                "Où doit-elle être livrée ?",

            yourPrice:
                "Votre prix",

            priceHint:
                "Entrez le montant sans vous soucier de la monnaie.",

            chooseDriver:
                "Choisir un chauffeur",

            driverOffers:
                "Offres des chauffeurs",

            noOffers:
                "Aucune offre de chauffeur pour le moment.",

            waitingForOffers:
                "En attente des prix des chauffeurs.",

            offerPrice:
                "Prix proposé",

            driverMessage:
                "Message du chauffeur",

            driverRating:
                "Note du chauffeur",

            completed:
                "Terminé",

            acceptOffer:
                "Accepter l'offre",

            suggestPrice:
                "Proposer un autre prix",

            suggestedPrice:
                "Votre prix proposé",

            sendPrice:
                "Envoyer le prix",

            selectedDriver:
                "Chauffeur sélectionné",

            driverInformation:
                "Informations sur le chauffeur",

            shipmentPosted:
                "Votre cargaison a été publiée.",

            offerAccepted:
                "Chauffeur sélectionné avec succès.",

            counterSent:
                "Votre nouveau prix a été envoyé au chauffeur.",

            pickup:
                "Ramassage",

            onTheWay:
                "En route",

            arrived:
                "Arrivé",

            delivered:
                "Livré",

            cancelShipment:
                "Annuler la cargaison",
        },

        driver: {
            greeting:
                "Bonjour",

            dashboard:
                "Tableau de bord chauffeur",

            availableJobs:
                "Cargaisons disponibles",

            myJobs:
                "Mes livraisons",

            currentDelivery:
                "Livraison en cours",

            completedDeliveries:
                "Livraisons terminées",

            availability:
                "Ma disponibilité",

            availableNow:
                "Disponible maintenant",

            busyNow:
                "Occupé maintenant",

            turnOn:
                "Activer ma disponibilité",

            turnOff:
                "Désactiver ma disponibilité",

            cargoAvailable:
                "Cargaisons disponibles",

            noCargo:
                "Aucune cargaison adaptée pour le moment.",

            checkAgain:
                "Revenez vérifier plus tard.",

            sendOffer:
                "Envoyer votre prix",

            yourPrice:
                "Votre prix",

            priceHint:
                "Entrez le montant. Vous n'avez pas besoin d'écrire la monnaie.",

            arrivalTime:
                "Quand pouvez-vous arriver ?",

            note:
                "Message",

            optional:
                "Facultatif",

            sendOfferButton:
                "Envoyer l'offre",

            updateOffer:
                "Modifier l'offre",

            suggestPrice:
                "Proposer un autre prix",

            selected:
                "Vous avez été sélectionné",

            notSelected:
                "Un autre chauffeur a été sélectionné",

            pickup:
                "Ramassage",

            startDelivery:
                "Commencer la livraison",

            onTheWay:
                "En route",

            arrived:
                "Je suis arrivé",

            completeDelivery:
                "Terminer la livraison",

            shipperInformation:
                "Informations sur l'expéditeur",

            offerSent:
                "Votre prix a été envoyé.",

            counterReceived:
                "L'expéditeur a proposé un autre prix.",

            accepted:
                "Votre offre a été acceptée.",
        },

        notifications: {
            title:
                "Notifications",

            noNotifications:
                "Aucune notification pour le moment.",

            markRead:
                "Marquer comme lu",

            markAllRead:
                "Tout marquer comme lu",

            newCargo:
                "Nouvelle cargaison disponible",

            newOffer:
                "Nouvelle offre d'un chauffeur",

            newPrice:
                "Nouvelle proposition de prix",

            selected:
                "Vous avez été sélectionné",

            notSelected:
                "Un autre chauffeur a été sélectionné",

            shipmentStarted:
                "La livraison a commencé",

            driverArrived:
                "Le chauffeur est arrivé",

            deliveryCompleted:
                "Livraison terminée",

            shipmentUpdated:
                "Cargaison mise à jour",
        },

        status: {
            open:
                "Ouvert",

            pending:
                "En attente",

            offered:
                "Offre reçue",

            countered:
                "Nouveau prix proposé",

            accepted:
                "Accepté",

            matched:
                "Chauffeur sélectionné",

            departed:
                "En route",

            arrived:
                "Arrivé",

            completed:
                "Terminé",

            cancelled:
                "Annulé",
        },

        errors: {
            somethingWrong:
                "Une erreur est survenue. Veuillez réessayer.",

            connection:
                "Nous ne pouvons pas nous connecter pour le moment. Vérifiez votre connexion internet.",

            required:
                "Veuillez remplir tous les champs obligatoires.",

            invalidPrice:
                "Veuillez entrer un prix valide.",

            invalidPhone:
                "Veuillez entrer un numéro de téléphone valide.",

            notFound:
                "Nous n'avons pas trouvé ce que vous cherchez.",

            notAllowed:
                "Vous n'êtes pas autorisé à faire cela.",
        },

        profile: {
            title:
                "Profil",

            edit:
                "Modifier le profil",

            photo:
                "Photo de profil",

            vehicleType:
                "Type de véhicule",

            plateNumber:
                "Numéro de plaque",

            rating:
                "Note",

            completedDeliveries:
                "Livraisons terminées",

            availability:
                "Disponibilité",

            saveChanges:
                "Enregistrer les modifications",

            changesSaved:
                "Vos modifications ont été enregistrées.",
        },

        settings: {
            title:
                "Paramètres",

            language:
                "Langue",

            account:
                "Compte",

            deleteAccount:
                "Supprimer le compte",

            deleteAccountWarning:
                "Cette action est irréversible.",
        },

        admin: {
            dashboard:
                "Tableau de bord administrateur",

            users:
                "Utilisateurs",

            drivers:
                "Chauffeurs",

            shippers:
                "Expéditeurs",

            shipments:
                "Cargaisons",

            offers:
                "Offres",

            matches:
                "Correspondances",

            recentActivity:
                "Activité récente",

            availableDrivers:
                "Chauffeurs disponibles",

            activeDeliveries:
                "Livraisons en cours",

            completedDeliveries:
                "Livraisons terminées",

            totalUsers:
                "Nombre total d'utilisateurs",

            totalShipments:
                "Nombre total de cargaisons",

            totalOffers:
                "Nombre total d'offres",

            accessDenied:
                "Accès refusé.",
        },

        confirmations: {
            acceptOffer:
                "Accepter l'offre de ce chauffeur ?",

            cancelShipment:
                "Voulez-vous vraiment annuler cette cargaison ?",

            logout:
                "Voulez-vous vraiment vous déconnecter ?",
        },
    },
};

function getNestedValue(
    object,
    path
) {
    return path
        .split(".")
        .reduce(
            (current, key) =>
                current?.[key],
            object
        );
}

function flattenTranslations(
    object,
    prefix = ""
) {
    const result = {};

    Object.entries(
        object
    ).forEach(
        ([key, value]) => {
            const fullKey =
                prefix
                    ? `${prefix}.${key}`
                    : key;

            if (
                typeof value ===
                "object" &&
                value !== null
            ) {
                Object.assign(
                    result,
                    flattenTranslations(
                        value,
                        fullKey
                    )
                );
            } else {
                result[
                    fullKey
                ] = value;
            }
        }
    );

    return result;
}

export function LanguageProvider({
    children,
}) {
    const [
        language,
        setLanguageState,
    ] = useState("en");

    useEffect(() => {
        if (
            typeof window ===
            "undefined"
        ) {
            return;
        }

        const savedLanguage =
            localStorage.getItem(
                "tayebLanguage"
            );

        if (
            savedLanguage ===
            "en" ||
            savedLanguage ===
            "fr"
        ) {
            setLanguageState(
                savedLanguage
            );
        }
    }, []);

    function setLanguage(
        nextLanguage
    ) {
        if (
            nextLanguage !==
            "en" &&
            nextLanguage !==
            "fr"
        ) {
            return;
        }

        setLanguageState(
            nextLanguage
        );

        if (
            typeof window !==
            "undefined"
        ) {
            localStorage.setItem(
                "tayebLanguage",
                nextLanguage
            );
        }

        if (
            typeof document !==
            "undefined"
        ) {
            document.documentElement.lang =
                nextLanguage;
        }
    }

    useEffect(() => {
        if (
            typeof document !==
            "undefined"
        ) {
            document.documentElement.lang =
                language;
        }
    }, [language]);

    const value =
        useMemo(() => {
            const activeTranslations =
                translations[
                language
                ];

            const fallbackTranslations =
                translations.en;

            function t(
                key,
                fallback = ""
            ) {
                const value =
                    getNestedValue(
                        activeTranslations,
                        key
                    );

                if (
                    value !==
                    undefined &&
                    value !== null
                ) {
                    return value;
                }

                const fallbackValue =
                    getNestedValue(
                        fallbackTranslations,
                        key
                    );

                if (
                    fallbackValue !==
                    undefined &&
                    fallbackValue !==
                    null
                ) {
                    return fallbackValue;
                }

                return (
                    fallback ||
                    key
                );
            }

            return {
                language,

                setLanguage,

                isEnglish:
                    language ===
                    "en",

                isFrench:
                    language ===
                    "fr",

                t,

                translations:
                    activeTranslations,

                flatTranslations:
                    flattenTranslations(
                        activeTranslations
                    ),
            };
        }, [language]);

    return (
        <LanguageContext.Provider
            value={value}
        >
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context =
        useContext(
            LanguageContext
        );

    if (!context) {
        throw new Error(
            "useLanguage must be used inside LanguageProvider."
        );
    }

    return context;
}

export default LanguageContext;