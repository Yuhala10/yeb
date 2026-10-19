import { useEffect, useRef, useState } from "react";

import { useSocialText } from "../../lib/socialText";

/*
 * Plays a farmer's voice note, like a WhatsApp voice message.
 * Only one note plays at a time on the page.
 */

let playingNow = null;

function clock(seconds) {
    const value = Math.max(0, Math.round(Number(seconds) || 0));

    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export default function VoiceNote({ url, seconds, className = "" }) {
    const s = useSocialText();

    const audio = useRef(null);

    const [playing, setPlaying] = useState(false);

    const [progress, setProgress] = useState(0);

    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        return () => {
            audio.current?.pause();
        };
    }, []);

    // A new recording replaces the old one.
    useEffect(() => {
        if (audio.current) {
            audio.current.pause();
            audio.current = null;
        }
    }, [url]);

    function toggle(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!audio.current) {
            const element = new Audio(url);

            element.preload = "auto";

            element.addEventListener("timeupdate", () => {
                const total = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : Number(seconds) || 1;

                setProgress(Math.min(1, element.currentTime / total));
                setElapsed(element.currentTime);
            });

            element.addEventListener("ended", () => {
                setPlaying(false);
                setProgress(0);
                setElapsed(0);
            });

            element.addEventListener("pause", () => setPlaying(false));
            element.addEventListener("play", () => setPlaying(true));

            audio.current = element;
        }

        if (playing) {
            audio.current.pause();
            return;
        }

        if (playingNow && playingNow !== audio.current) {
            playingNow.pause();
        }

        playingNow = audio.current;

        audio.current.play().catch(() => setPlaying(false));
    }

    return (
        <button type="button" className={`sm-voice ${playing ? "is-playing" : ""} ${className}`} onClick={toggle} aria-label={playing ? s("pause") : `${s("listen")} · ${s("voiceNote")}`}>
            <span className="sm-voice-icon" aria-hidden="true">{playing ? "❚❚" : "▶"}</span>
            <span className="sm-voice-wave" aria-hidden="true">
                <i style={{ transform: `scaleX(${progress})` }} />
            </span>
            <span className="sm-voice-time">{playing || elapsed ? clock(elapsed) : clock(seconds)}</span>
        </button>
    );
}
