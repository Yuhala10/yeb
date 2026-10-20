import { useEffect, useRef, useState } from "react";

import Icon from "./Icon";

import { useSiteText } from "../../lib/siteText";

/*
 * Share a link: the phone's own share menu where there is
 * one (it lists every app), otherwise WhatsApp, Facebook,
 * Telegram, SMS and "copy link".
 */
export default function ShareSheet({ url, title, text, className = "ts-btn ts-btn-light", label }) {
    const s = useSiteText();

    const [open, setOpen] = useState(false);

    const [copied, setCopied] = useState(false);

    const box = useRef(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        function close(event) {
            if (box.current && !box.current.contains(event.target)) {
                setOpen(false);
            }
        }

        function escape(event) {
            if (event.key === "Escape") {
                setOpen(false);
            }
        }

        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", escape);

        return () => {
            document.removeEventListener("pointerdown", close);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);

    async function share() {
        if (typeof navigator !== "undefined" && navigator.share) {
            try {
                await navigator.share({ title, text, url });
                return;
            } catch (error) {
                if (error?.name === "AbortError") {
                    return;
                }
            }
        }

        setOpen((current) => !current);
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            const input = document.createElement("input");
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            input.remove();
        }

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    const message = `${text ? `${text}\n` : ""}${url}`;

    return (
        <div className="ts-share" ref={box}>

            <button type="button" className={className} onClick={share} aria-expanded={open} aria-haspopup="menu">
                <Icon name="share" size={17} /> {label || s("share")}
            </button>

            {open && (
                <div className="ts-share-menu" role="menu">
                    <a role="menuitem" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
                        <Icon name="chat" /> {s("shareWhatsApp")}
                    </a>
                    <a role="menuitem" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
                        <Icon name="globe" /> {s("shareFacebook")}
                    </a>
                    <a role="menuitem" href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text || title || "")}`} target="_blank" rel="noopener noreferrer">
                        <Icon name="send" /> {s("shareTelegram")}
                    </a>
                    <a role="menuitem" href={`sms:?&body=${encodeURIComponent(message)}`}>
                        <Icon name="message" /> {s("shareSms")}
                    </a>
                    <button type="button" role="menuitem" onClick={copy}>
                        <Icon name={copied ? "check" : "link"} /> {copied ? s("shareCopied") : s("shareCopy")}
                    </button>
                </div>
            )}

        </div>
    );
}
