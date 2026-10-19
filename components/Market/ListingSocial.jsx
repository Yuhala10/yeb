import { useRouter } from "next/router";

import { BookmarkIcon, HeartIcon, ShareIcon } from "./Icons";
import { shareListing } from "./PostCard";
import VoiceNote from "./VoiceNote";
import { useFeedback } from "../App/Feedback";
import { languageName } from "../../lib/languages";
import { useLanguage } from "../../lib/LanguageContext";
import { countLabel, socialError, useSocialText } from "../../lib/socialText";
import { likeCount, setLiked, setSaved, useSocial } from "../../lib/useSocial";
import { loginThenReturn } from "../../lib/useSession";

/*
 * On a product page: like, save, share, the voice note, and
 * the farmer's caption with the language it's written in.
 */
export default function ListingSocial({ listing, user }) {
    const router = useRouter();

    const { language } = useLanguage();

    const s = useSocialText();

    const { toast } = useFeedback();

    const social = useSocial(user);

    const liked = social.likes.has(listing.id);

    const saved = social.saves.has(listing.id);

    const likes = likeCount(social, listing);

    async function act(kind) {
        if (!user) {
            loginThenReturn(router, "SHIPPER", router.asPath);
            return;
        }

        try {
            if (kind === "like") {
                await setLiked(listing, !liked);
            } else {
                await setSaved(listing, !saved);
            }
        } catch (error) {
            toast(socialError(language, error), "error");
        }
    }

    return (
        <div className="sm-listing-social">
            <div className="sm-actions" style={{ padding: "6px 0 0" }}>
                <button type="button" className={`sm-act ${liked ? "is-liked" : ""}`} onClick={() => act("like")} aria-pressed={liked} aria-label={liked ? s("unlike") : s("like")}>
                    <HeartIcon filled={liked} />
                    {likes > 0 && <b aria-label={countLabel(language, "likes", likes)}>{likes}</b>}
                </button>
                <button type="button" className="sm-act" onClick={() => shareListing(listing, language)} aria-label={s("share")}>
                    <ShareIcon />
                </button>
                {listing.voice_url && <VoiceNote url={listing.voice_url} seconds={listing.voice_seconds} />}
                <span className="sm-grow" />
                <button type="button" className={`sm-act ${saved ? "is-saved" : ""}`} onClick={() => act("save")} aria-pressed={saved} aria-label={saved ? s("unsave") : s("save")}>
                    <BookmarkIcon filled={saved} />
                </button>
            </div>

            {listing.details && (
                <p className="mk-description" lang={listing.caption_lang || undefined} style={{ whiteSpace: "pre-line" }}>
                    {listing.details}
                </p>
            )}

            {listing.caption_lang && listing.caption_lang !== "fra" && listing.caption_lang !== "eng" && (
                <span className="sm-lang">🗣️ {s("inLanguage", { lang: languageName(listing.caption_lang, language) })}</span>
            )}
        </div>
    );
}
