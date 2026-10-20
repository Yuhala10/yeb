/*
 * A farm's (or person's) round photo, or the first letter of
 * their name on Tayeb orange when there's no photo yet.
 */
export default function Avatar({ person, size = 40, ring = false, className = "" }) {
    const name = person?.farm_name || person?.full_name || "";

    const letter = name.trim().charAt(0).toUpperCase() || "T";

    const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };

    if (person?.avatar_url) {
        return (
            // Served from Tayeb's storage, already a small square.
            // eslint-disable-next-line @next/next/no-img-element
            <img
                className={`sm-avatar ${ring ? "is-ring" : ""} ${className}`}
                src={person.avatar_url}
                alt=""
                width={size}
                height={size}
                loading="lazy"
                decoding="async"
                style={style}
            />
        );
    }

    return (
        <span className={`sm-avatar is-letter ${ring ? "is-ring" : ""} ${className}`} style={style} aria-hidden="true">
            {letter}
        </span>
    );
}
