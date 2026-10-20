import { useState } from "react";

import Seo from "../components/Site/Seo";
import SiteFooter from "../components/Site/SiteFooter";
import SiteHeader from "../components/Site/SiteHeader";
import Icon from "../components/Site/Icon";
import { apiPost } from "../lib/api";
import { appError } from "../lib/appText";
import { FOUNDER } from "../lib/founder";
import { useLanguage } from "../lib/LanguageContext";
import { siteOrigin } from "../lib/seo";
import { useSession } from "../lib/useSession";

/*
 * Help and feedback: a suggestion, a problem or a dispute
 * goes to the Tayeb team (saved, and visible in the console),
 * with WhatsApp for anything urgent.
 */

export function getServerSideProps({ req }) {
    return { props: { origin: siteOrigin(req) } };
}

const TYPES = [
    ["SUGGESTION", "sparkle"],
    ["PROBLEM", "alert"],
    ["DISPUTE", "users"],
];

const TEXT = {
    en: {
        title: "How can we help?",
        sub: "Tell us what to improve, report a problem, or ask us to help settle a disagreement. A real person reads every message.",
        SUGGESTION: "An idea",
        PROBLEM: "A problem",
        DISPUTE: "A disagreement",
        message: "Your message",
        placeholder: "What happened, or what would make Tayeb better for you?",
        phone: "Your phone or WhatsApp (optional)",
        phoneHelp: "So we can answer you.",
        send: "Send",
        sending: "Sending…",
        empty: "Write your message first.",
        sentTitle: "Thank you, we got it.",
        sentText: "We read every message. If you left a number, we'll get back to you.",
        another: "Send another message",
        urgent: "Urgent? Message us on WhatsApp",
        seoTitle: "Help and feedback | Tayeb",
        seoDescription: "Contact the Tayeb team: ideas, problems with a delivery or an order, disputes. WhatsApp support too.",
    },
    fr: {
        title: "Comment pouvons-nous aider ?",
        sub: "Dites-nous quoi améliorer, signalez un problème ou demandez-nous d'aider à régler un désaccord. Une vraie personne lit chaque message.",
        SUGGESTION: "Une idée",
        PROBLEM: "Un problème",
        DISPUTE: "Un désaccord",
        message: "Votre message",
        placeholder: "Que s'est-il passé, ou qu'est-ce qui rendrait Tayeb meilleur pour vous ?",
        phone: "Votre téléphone ou WhatsApp (facultatif)",
        phoneHelp: "Pour pouvoir vous répondre.",
        send: "Envoyer",
        sending: "Envoi…",
        empty: "Écrivez d'abord votre message.",
        sentTitle: "Merci, c'est bien reçu.",
        sentText: "Nous lisons chaque message. Si vous avez laissé un numéro, nous vous répondrons.",
        another: "Envoyer un autre message",
        urgent: "Urgent ? Écrivez-nous sur WhatsApp",
        seoTitle: "Aide et avis | Tayeb",
        seoDescription: "Contactez l'équipe Tayeb : idées, problème de livraison ou de commande, litiges. Support WhatsApp aussi.",
    },
};

export default function FeedbackPage({ origin }) {
    const { language } = useLanguage();

    const { user, loading } = useSession();

    const t = TEXT[language === "en" ? "en" : "fr"];

    const [type, setType] = useState("SUGGESTION");

    const [message, setMessage] = useState("");

    const [phone, setPhone] = useState("");

    const [sending, setSending] = useState(false);

    const [sent, setSent] = useState(false);

    const [error, setError] = useState("");

    async function submit(event) {
        event.preventDefault();

        if (!message.trim()) {
            setError(t.empty);
            return;
        }

        setSending(true);
        setError("");

        try {
            await apiPost("/api/feedback", { type, message: message.trim(), phone: phone.trim() });
            setSent(true);
            setMessage("");
        } catch (failure) {
            setError(appError(language, failure));
        } finally {
            setSending(false);
        }
    }

    const whatsapp = `https://wa.me/${FOUNDER.whatsapp}?text=${encodeURIComponent(
        language === "fr" ? "Bonjour Tayeb, j'ai besoin d'aide." : "Hello Tayeb, I need help."
    )}`;

    return (
        <>
            <Seo origin={origin} path="/feedback" title={t.seoTitle} description={t.seoDescription} />

            <div className="ts-page">

                <SiteHeader user={user} loading={loading} variant="dark" />

                <section className="ts-hero" style={{ paddingBottom: 80 }}>
                    <div className="ts-wrap" style={{ maxWidth: 760 }}>
                        <span className="ts-badge"><Icon name="chat" /> Tayeb</span>
                        <h1 style={{ fontSize: "clamp(34px, 6vw, 58px)" }}>{t.title}</h1>
                        <p className="ts-hero-text">{t.sub}</p>
                    </div>
                </section>

                <div className="ts-wrap" style={{ maxWidth: 760, marginTop: -46, paddingBottom: 70, position: "relative", zIndex: 2 }}>

                    {sent ? (
                        <div className="ap-card" style={{ textAlign: "center", justifyItems: "center", padding: 34 }}>
                            <div className="ap-empty-icon" aria-hidden="true"><Icon name="check" size={26} /></div>
                            <h2 className="ap-card-title" style={{ fontSize: 24 }}>{t.sentTitle}</h2>
                            <p style={{ margin: 0, color: "var(--ts-muted)" }}>{t.sentText}</p>
                            <div className="ap-actions" style={{ justifyContent: "center" }}>
                                <button type="button" className="ts-btn ts-btn-light" onClick={() => setSent(false)}>{t.another}</button>
                                <a className="ts-btn ts-btn-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer"><Icon name="chat" /> {t.urgent}</a>
                            </div>
                        </div>
                    ) : (
                        <form className="ap-card ap-form" onSubmit={submit} style={{ padding: "clamp(20px, 4vw, 30px)" }}>

                            <div className="ap-choices" role="radiogroup">
                                {TYPES.map(([key, icon]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        role="radio"
                                        aria-checked={type === key}
                                        className={`ap-choice ${type === key ? "active" : ""}`}
                                        onClick={() => setType(key)}
                                    >
                                        <Icon name={icon} size={20} />
                                        <span>{t[key]}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="ap-field">
                                <label htmlFor="feedback-message">{t.message}</label>
                                <textarea
                                    id="feedback-message"
                                    className="mk-textarea"
                                    rows={6}
                                    maxLength={2000}
                                    value={message}
                                    onChange={(event) => setMessage(event.target.value)}
                                    placeholder={t.placeholder}
                                />
                            </div>

                            <div className="ap-field">
                                <label htmlFor="feedback-phone">{t.phone}</label>
                                <input
                                    id="feedback-phone"
                                    className="mk-input"
                                    type="tel"
                                    inputMode="tel"
                                    maxLength={30}
                                    value={phone}
                                    onChange={(event) => setPhone(event.target.value)}
                                    autoComplete="tel"
                                />
                                <small>{t.phoneHelp}</small>
                            </div>

                            {error && (
                                <div className="ap-note ap-note-red" role="alert">
                                    <Icon name="alert" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div className="ap-actions">
                                <button type="submit" className="ts-btn ts-btn-primary ts-btn-lg" disabled={sending}>
                                    {sending ? t.sending : `${t.send} →`}
                                </button>
                                <a className="ts-btn ts-btn-light ts-btn-lg" href={whatsapp} target="_blank" rel="noopener noreferrer">
                                    <Icon name="chat" /> {t.urgent}
                                </a>
                            </div>

                        </form>
                    )}

                </div>

                <SiteFooter />

            </div>
        </>
    );
}
