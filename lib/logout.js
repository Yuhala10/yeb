export function logout(router) {
    localStorage.removeItem("tayebUser");
    router.push("/login");
}