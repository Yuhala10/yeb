export function getCurrentUser() {
    if (typeof window === "undefined") return null;

    const stored = localStorage.getItem("tayebUser");

    if (!stored) return null;

    return JSON.parse(stored);
}