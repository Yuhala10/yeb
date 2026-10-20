import { useRef, useState } from "react";

import Icon from "../Site/Icon";
import { compressImage } from "../../lib/image";
import { useLanguage } from "../../lib/LanguageContext";

const MAX_PHOTOS = 8;

let nextId = 0;

/*
 * Choose up to 8 photos for a product, like a social post:
 * pick several at once, move them left or right, remove, and
 * the first one is the cover. Photos are shrunk on the phone
 * before they're uploaded.
 *
 * items: [{ id, url, kind: "saved" | "new", dataUrl? }]
 */
export default function PhotoPicker({ items, onChange, disabled }) {
    const { language } = useLanguage();

    const fr = language === "fr";

    const input = useRef(null);

    const [busy, setBusy] = useState(0);

    const [error, setError] = useState("");

    const room = MAX_PHOTOS - items.length;

    async function add(event) {
        const files = Array.from(event.target.files || []).slice(0, room);

        event.target.value = "";

        if (files.length === 0) {
            return;
        }

        setError("");
        setBusy(files.length);

        const added = [];

        for (const file of files) {
            try {
                const dataUrl = await compressImage(file);

                nextId += 1;

                added.push({ id: `new-${Date.now()}-${nextId}`, url: dataUrl, dataUrl, kind: "new" });
            } catch {
                setError(fr ? "Une photo n'a pas pu être ouverte." : "One photo couldn't be opened.");
            } finally {
                setBusy((current) => Math.max(0, current - 1));
            }
        }

        onChange([...items, ...added].slice(0, MAX_PHOTOS));
    }

    function move(position, step) {
        const next = [...items];
        const target = position + step;

        if (target < 0 || target >= next.length) {
            return;
        }

        [next[position], next[target]] = [next[target], next[position]];

        onChange(next);
    }

    function remove(position) {
        onChange(items.filter((_, index) => index !== position));
    }

    return (
        <div style={{ display: "grid", gap: 8 }}>

            <div className="ts-picker">

                {items.map((item, position) => (
                    <div key={item.id} className="ts-pick">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.url} alt="" />

                        {position === 0 && (
                            <span className="ts-pick-cover">{fr ? "Couverture" : "Cover"}</span>
                        )}

                        <div className="ts-pick-tools">
                            <button
                                type="button"
                                onClick={() => move(position, -1)}
                                disabled={disabled || position === 0}
                                aria-label={fr ? "Déplacer à gauche" : "Move left"}
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                onClick={() => remove(position)}
                                disabled={disabled}
                                aria-label={fr ? "Retirer" : "Remove"}
                            >
                                <Icon name="x" />
                            </button>
                            <button
                                type="button"
                                onClick={() => move(position, 1)}
                                disabled={disabled || position === items.length - 1}
                                aria-label={fr ? "Déplacer à droite" : "Move right"}
                            >
                                ›
                            </button>
                        </div>
                    </div>
                ))}

                {Array.from({ length: busy }).map((_, index) => (
                    <div key={`busy-${index}`} className="ts-pick">
                        <div className="ts-pick-busy">
                            <span className="tayeb-spinner tayeb-spinner-orange" />
                        </div>
                    </div>
                ))}

                {room > 0 && !busy && (
                    <button
                        type="button"
                        className="ts-pick-add"
                        onClick={() => input.current?.click()}
                        disabled={disabled}
                    >
                        <b>＋</b>
                        {items.length === 0
                            ? fr ? "Ajouter des photos" : "Add photos"
                            : fr ? `Encore ${room}` : `${room} more`}
                    </button>
                )}

            </div>

            <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={add}
            />

            <small style={{ color: "var(--ts-muted)", fontSize: 12.5 }}>
                {fr
                    ? `Jusqu'à ${MAX_PHOTOS} photos. La première est la couverture. Lumière du jour, produit bien visible : ça vend plus vite.`
                    : `Up to ${MAX_PHOTOS} photos. The first is the cover. Daylight and a clear view of the produce sell faster.`}
            </small>

            {error && <small style={{ color: "var(--tint-red-fg)" }}>{error}</small>}

        </div>
    );
}
