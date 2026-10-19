import { useEffect, useSyncExternalStore } from "react";

import { apiGet, apiPost } from "./api";

/*
 * ============================================================
 * LIKES, SAVES AND FOLLOWS IN THE BROWSER
 * ============================================================
 *
 * One shared store for the whole page: every heart, bookmark
 * and "Follow" button reads it, so tapping one updates them
 * all. Taps show at once and are undone if the server says no.
 */

let state = {
    loaded: false,
    ready: true,
    likes: new Set(),
    saves: new Set(),
    following: new Set(),
    // Latest counts the server sent: { [productId]: n } and { [farmerId]: n }.
    likeCounts: {},
    followerCounts: {},
};

let loading = null;

let loadedFor = null;

const listeners = new Set();

function emit(changes) {
    state = { ...state, ...changes };
    listeners.forEach((listener) => listener());
}

function subscribe(listener) {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

function snapshot() {
    return state;
}

export function loadSocial(userId) {
    if (!userId) {
        return Promise.resolve();
    }

    if (loadedFor === userId && (state.loaded || loading)) {
        return loading || Promise.resolve();
    }

    loadedFor = userId;

    loading = apiGet("/api/social?mine=1")
        .then((result) => {
            emit({
                loaded: true,
                ready: result.ready !== false,
                likes: new Set(result.likes || []),
                saves: new Set(result.saves || []),
                following: new Set(result.following || []),
            });
        })
        .catch(() => emit({ loaded: true }))
        .finally(() => {
            loading = null;
        });

    return loading;
}

export function useSocial(user) {
    const current = useSyncExternalStore(subscribe, snapshot, snapshot);

    const userId = user?.id;

    useEffect(() => {
        loadSocial(userId);
    }, [userId]);

    return current;
}

function toggled(set, id, on) {
    const next = new Set(set);

    if (on) {
        next.add(id);
    } else {
        next.delete(id);
    }

    return next;
}

export async function setLiked(listing, on) {
    const before = { likes: state.likes, likeCounts: state.likeCounts };

    const base = state.likeCounts[listing.id] ?? Number(listing.likes_count || 0);

    const was = state.likes.has(listing.id);

    emit({
        likes: toggled(state.likes, listing.id, on),
        likeCounts: { ...state.likeCounts, [listing.id]: Math.max(0, base + (on === was ? 0 : on ? 1 : -1)) },
    });

    try {
        const result = await apiPost("/api/social", { action: "like", productId: listing.id, on });

        emit({ likeCounts: { ...state.likeCounts, [listing.id]: result.likes } });
    } catch (error) {
        emit(before);
        throw error;
    }
}

export async function setSaved(listing, on) {
    const before = { saves: state.saves };

    emit({ saves: toggled(state.saves, listing.id, on) });

    try {
        await apiPost("/api/social", { action: "save", productId: listing.id, on });
    } catch (error) {
        emit(before);
        throw error;
    }
}

export async function setFollowing(farmer, on) {
    const before = { following: state.following, followerCounts: state.followerCounts };

    const base = state.followerCounts[farmer.id] ?? Number(farmer.followers_count || 0);

    const was = state.following.has(farmer.id);

    emit({
        following: toggled(state.following, farmer.id, on),
        followerCounts: { ...state.followerCounts, [farmer.id]: Math.max(0, base + (on === was ? 0 : on ? 1 : -1)) },
    });

    try {
        const result = await apiPost("/api/social", { action: "follow", farmerId: farmer.id, on });

        emit({ followerCounts: { ...state.followerCounts, [farmer.id]: result.followers } });
    } catch (error) {
        emit(before);
        throw error;
    }
}

export function likeCount(social, listing) {
    return social.likeCounts[listing.id] ?? Number(listing.likes_count || 0);
}

export function followerCount(social, farmer) {
    return social.followerCounts[farmer.id] ?? Number(farmer.followers_count || 0);
}
