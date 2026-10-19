import { useRouter } from "next/router";

import { useFeedback } from "../App/Feedback";
import { useLanguage } from "../../lib/LanguageContext";
import { socialError, useSocialText } from "../../lib/socialText";
import { setFollowing, useSocial } from "../../lib/useSocial";
import { loginThenReturn } from "../../lib/useSession";

/*
 * "Follow" / "Following" for a farm. Asks to log in first
 * when nobody is signed in. Hidden on the farmer's own posts.
 */
export default function FollowButton({ farmer, user, size = "sm", className = "" }) {
    const router = useRouter();

    const { language } = useLanguage();

    const s = useSocialText();

    const { toast } = useFeedback();

    const social = useSocial(user);

    if (!farmer?.id || user?.id === farmer.id) {
        return null;
    }

    const following = social.following.has(farmer.id);

    async function tap(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!user) {
            loginThenReturn(router, "SHIPPER", router.asPath);
            return;
        }

        try {
            await setFollowing(farmer, !following);
        } catch (error) {
            toast(socialError(language, error), "error");
        }
    }

    return (
        <button
            type="button"
            className={`sm-follow ${following ? "is-on" : ""} ${size === "lg" ? "is-lg" : ""} ${className}`}
            onClick={tap}
            aria-pressed={following}
        >
            {following ? `✓ ${s("followingButton")}` : `＋ ${s("follow")}`}
        </button>
    );
}
