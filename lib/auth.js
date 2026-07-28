export function getCurrentUser() {
    if (typeof window === "undefined") return null;

    const user = localStorage.getItem("tayebUser");

    if (!user) return null;

    return JSON.parse(user);
}

export function logout() {
    localStorage.removeItem("tayebUser");
    localStorage.removeItem("selectedRole");

    window.location.href = "/";
}