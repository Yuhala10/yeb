import crypto from "crypto";

import { cleanLanguages } from "../languages";
import { DEFAULT_COUNTRY } from "../countries";
import { cleanText, db, EngineError, must, notify, socialReady, usersById } from "./core";
import { isListingVisible, publicFarmer, publicListing } from "./market";
import { readPhoto, readVoice } from "./media";
import { publicUser } from "./session";

/*
 * ============================================================
 * TAYEB MARCHÉ — THE SOCIAL SIDE
 * ============================================================
 *
 * Farm profiles (name, @handle, photo, cover, bio, languages,
 * badges), posts (a product is a post: photos, a caption in
 * the farmer's own language, an optional voice note), likes,
 * saves and follows.
 *
 * Anyone signed in can like, save and follow. Only the farmer
 * edits their profile and their posts. Counts are recounted
 * from the rows each time, so they can't drift.
 */

const PHOTO_BUCKET = "produce";

const VOICE_BUCKET = "voices";

// Words that can't be a farm's @handle.
const RESERVED = new Set([
    "admin", "api", "about", "console", "drive", "driver", "farmer", "feedback", "go", "help", "hq",
    "load", "login", "marche", "market", "shipper", "staff", "support", "team", "tayeb", "track",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requireSocial() {
    if (!(await socialReady())) {
        throw new EngineError("This opens very soon.", 503, "SOCIAL_NOT_READY");
    }
}

/* =========================================================
   @HANDLES
========================================================= */

function slugify(text) {
    return String(text || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24)
        .replace(/-+$/g, "");
}

async function handleTaken(handle, userId) {
    const rows = must(await db.from("users").select("id").eq("handle", handle).limit(1)) || [];

    return rows.length > 0 && rows[0].id !== userId;
}

async function freeHandle(base, userId) {
    let root = slugify(base);

    if (root.length < 3) {
        root = `ferme-${root || "tayeb"}`;
    }

    if (RESERVED.has(root)) {
        root = `${root}-ferme`;
    }

    for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = attempt === 0 ? root : `${root.slice(0, 24)}-${crypto.randomInt(10, 9999)}`;

        if (!(await handleTaken(candidate, userId))) {
            return candidate;
        }
    }

    return `${root.slice(0, 20)}-${userId.slice(0, 6)}`;
}

/*
 * Every farmer gets an address for their page the first time
 * it's needed: tayeb…/farm/<handle>.
 */
export async function ensureHandle(user) {
    if (!user || user.role !== "FARMER" || user.handle || !(await socialReady())) {
        return user;
    }

    const handle = await freeHandle(user.farm_name || user.full_name, user.id);

    const row = must(await db.from("users").update({ handle }).eq("id", user.id).is("handle", null).select("*").maybeSingle());

    return row || { ...user, handle };
}

/* =========================================================
   PROFILES
========================================================= */

export function profileView(user, extra = {}) {
    const farmer = publicFarmer(user);

    return {
        ...farmer,
        first_name: String(user.full_name || "").trim().split(/\s+/)[0] || "",
        bio: user.bio || null,
        cover_url: user.cover_url || null,
        languages: cleanLanguages(user.languages || []),
        badges: {
            phone: true,
            id: Boolean(user.verified_id),
            visited: Boolean(user.farm_visited),
            top: Number(user.rating) >= 4.5 && (user.rating_count || 0) >= 5,
        },
        ...extra,
    };
}

async function findFarmer(handleOrId) {
    const key = String(handleOrId || "").trim().toLowerCase().slice(0, 40);

    if (!key) {
        return null;
    }

    const rows = must(
        await db
            .from("users")
            .select("*")
            .eq(UUID.test(key) ? "id" : "handle", key)
            .limit(1)
    ) || [];

    const user = rows[0];

    return user && user.role === "FARMER" ? user : null;
}

/*
 * A farm's public page: the profile and its posts (on sale
 * first, then sold out), newest first.
 */
export async function getProfile(handleOrId, viewer = null) {
    await requireSocial();

    const user = await ensureHandle(await findFarmer(handleOrId));

    if (!user) {
        throw new EngineError("Farm not found.", 404);
    }

    const rows = must(
        await db
            .from("products")
            .select("*")
            .eq("farmer_id", user.id)
            .in("status", ["ACTIVE", "SOLD_OUT"])
            .order("created_at", { ascending: false })
            .limit(60)
    ) || [];

    const posts = rows
        .map((row) => publicListing(row, user, null))
        .sort((a, b) => Number(b.visible) - Number(a.visible));

    let following = false;

    if (viewer?.id && viewer.id !== user.id) {
        const rowsFollow = must(await db.from("follows").select("farmer_id").eq("farmer_id", user.id).eq("follower_id", viewer.id).limit(1)) || [];

        following = rowsFollow.length > 0;
    }

    return {
        profile: profileView(user, { following, posts_count: posts.length, is_me: viewer?.id === user.id }),
        posts,
    };
}

export async function updateProfile(farmer, input) {
    await requireSocial();

    const updates = {};

    if (input.farmName !== undefined) {
        updates.farm_name = cleanText(input.farmName, 60) || null;
    }

    if (input.bio !== undefined) {
        updates.bio = cleanText(input.bio, 300) || null;
    }

    if (input.languages !== undefined) {
        updates.languages = cleanLanguages(input.languages);
    }

    if (input.handle !== undefined && input.handle !== farmer.handle) {
        const handle = String(input.handle || "").trim().toLowerCase().replace(/^@/, "");

        if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(handle) || handle.includes("--")) {
            throw new EngineError("Use 3 to 30 letters, numbers or dashes.", 400, "HANDLE_INVALID");
        }

        if (RESERVED.has(handle) || (await handleTaken(handle, farmer.id))) {
            throw new EngineError("This name is already taken.", 409, "HANDLE_TAKEN");
        }

        updates.handle = handle;
    }

    if (Object.keys(updates).length === 0) {
        return { user: publicUser(farmer) };
    }

    const user = must(await db.from("users").update(updates).eq("id", farmer.id).select("*").maybeSingle());

    return { user: publicUser(await ensureHandle(user)) };
}

/*
 * Profile photo (square) or cover (wide). Anyone signed in
 * can have a photo; covers are for farm pages.
 */
export async function setProfilePhoto(user, { image, kind }) {
    await requireSocial();

    if (kind !== "avatar" && kind !== "cover") {
        throw new EngineError("Choose a photo.");
    }

    const photo = await readPhoto(image, kind === "avatar" ? { maxSide: 480, square: true } : { maxSide: 1500, wide: true });

    const path = `profiles/${user.id}/${kind}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.${photo.extension}`;

    const { error } = await db.storage.from(PHOTO_BUCKET).upload(path, photo.buffer, {
        contentType: photo.contentType,
        cacheControl: "31536000",
        upsert: false,
    });

    if (error) {
        console.error("Profile photo upload error:", error);
        throw new EngineError("The photo couldn't be saved. Please try again.", 502);
    }

    const { data } = db.storage.from(PHOTO_BUCKET).getPublicUrl(path);

    const old = user[`${kind}_path`];

    const updated = must(
        await db
            .from("users")
            .update({ [`${kind}_url`]: data.publicUrl, [`${kind}_path`]: path })
            .eq("id", user.id)
            .select("*")
            .maybeSingle()
    );

    if (old) {
        await db.storage.from(PHOTO_BUCKET).remove([old]);
    }

    return { user: publicUser(updated), url: data.publicUrl };
}

export async function removeProfilePhoto(user, { kind }) {
    await requireSocial();

    if (kind !== "avatar" && kind !== "cover") {
        throw new EngineError("Choose a photo.");
    }

    const old = user[`${kind}_path`];

    const updated = must(
        await db
            .from("users")
            .update({ [`${kind}_url`]: null, [`${kind}_path`]: null })
            .eq("id", user.id)
            .select("*")
            .maybeSingle()
    );

    if (old) {
        await db.storage.from(PHOTO_BUCKET).remove([old]);
    }

    return { user: publicUser(updated) };
}

/* =========================================================
   LIKES, SAVES, FOLLOWS
========================================================= */

async function countRows(table, column, value) {
    const { count, error } = await db.from(table).select("*", { count: "exact", head: true }).eq(column, value);

    if (error) {
        throw error;
    }

    return count || 0;
}

async function postFor(productId) {
    if (!UUID.test(String(productId || ""))) {
        throw new EngineError("Post not found.", 404);
    }

    const post = must(await db.from("products").select("id, farmer_id, status").eq("id", productId).maybeSingle());

    if (!post || post.status === "ARCHIVED") {
        throw new EngineError("Post not found.", 404);
    }

    return post;
}

// Insert once: a second tap (or a race) is not an error.
async function insertOnce(table, row, match) {
    let query = db.from(table).select(Object.keys(match)[0]);

    for (const [column, value] of Object.entries(match)) {
        query = query.eq(column, value);
    }

    const existing = must(await query.limit(1)) || [];

    if (existing.length) {
        return false;
    }

    const { error } = await db.from(table).insert([row]);

    if (error && error.code !== "23505") {
        throw error;
    }

    return !error;
}

async function removeRow(table, match) {
    let query = db.from(table).delete();

    for (const [column, value] of Object.entries(match)) {
        query = query.eq(column, value);
    }

    must(await query);
}

export async function setLike(user, { productId, on }) {
    await requireSocial();

    const post = await postFor(productId);

    const match = { product_id: post.id, user_id: user.id };

    if (on) {
        await insertOnce("product_likes", match, match);
    } else {
        await removeRow("product_likes", match);
    }

    const likes = await countRows("product_likes", "product_id", post.id);

    must(await db.from("products").update({ likes_count: likes }).eq("id", post.id));

    return { liked: Boolean(on), likes };
}

export async function setSave(user, { productId, on }) {
    await requireSocial();

    const post = await postFor(productId);

    const match = { product_id: post.id, user_id: user.id };

    if (on) {
        await insertOnce("product_saves", match, match);
    } else {
        await removeRow("product_saves", match);
    }

    return { saved: Boolean(on) };
}

export async function setFollow(user, { farmerId, on }) {
    await requireSocial();

    if (!UUID.test(String(farmerId || ""))) {
        throw new EngineError("Farm not found.", 404);
    }

    if (farmerId === user.id) {
        throw new EngineError("You can't follow your own farm.", 400, "FOLLOW_SELF");
    }

    const farmer = (await usersById([farmerId])).get(farmerId);

    if (!farmer || farmer.role !== "FARMER") {
        throw new EngineError("Farm not found.", 404);
    }

    const match = { farmer_id: farmer.id, follower_id: user.id };

    let added = false;

    if (on) {
        added = await insertOnce("follows", match, match);
    } else {
        await removeRow("follows", match);
    }

    const followers = await countRows("follows", "farmer_id", farmer.id);

    must(await db.from("users").update({ followers_count: followers }).eq("id", farmer.id));

    if (added) {
        await notify([
            {
                user_id: farmer.id,
                type: "NEW_FOLLOWER",
                link: "/farmer",
                title: "Nouvel abonné · New follower 🌱",
                message: String(user.full_name || "").trim().split(/\s+/)[0] || "Tayeb",
            },
        ]);
    }

    return { following: Boolean(on), followers };
}

/*
 * What this person liked, saved and follows, to draw the
 * hearts, bookmarks and "Following" buttons.
 */
export async function mySocial(user) {
    if (!(await socialReady())) {
        return { ready: false, likes: [], saves: [], following: [] };
    }

    const [likes, saves, follows] = await Promise.all([
        db.from("product_likes").select("product_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000),
        db.from("product_saves").select("product_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1000),
        db.from("follows").select("farmer_id").eq("follower_id", user.id).limit(1000),
    ]);

    return {
        ready: true,
        likes: (must(likes) || []).map((row) => row.product_id),
        saves: (must(saves) || []).map((row) => row.product_id),
        following: (must(follows) || []).map((row) => row.farmer_id),
    };
}

async function listingsWithFarmers(rows) {
    const farmers = await usersById(rows.map((row) => row.farmer_id));

    return rows.map((row) => publicListing(row, farmers.get(row.farmer_id), null));
}

// Posts from the farms this person follows, newest first.
export async function followingFeed(user) {
    await requireSocial();

    const follows = must(await db.from("follows").select("farmer_id").eq("follower_id", user.id).limit(500)) || [];

    if (follows.length === 0) {
        return { listings: [], follows: 0 };
    }

    const rows = (must(
        await db
            .from("products")
            .select("*")
            .in("farmer_id", follows.map((row) => row.farmer_id))
            .eq("status", "ACTIVE")
            .gt("quantity_available", 0)
            .order("created_at", { ascending: false })
            .limit(80)
    ) || []).filter(isListingVisible);

    return { listings: await listingsWithFarmers(rows), follows: follows.length };
}

export async function savedPosts(user) {
    await requireSocial();

    const saves = must(await db.from("product_saves").select("product_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200)) || [];

    if (saves.length === 0) {
        return { listings: [] };
    }

    const rows = must(await db.from("products").select("*").in("id", saves.map((row) => row.product_id)).neq("status", "ARCHIVED")) || [];

    const order = new Map(saves.map((row, index) => [row.product_id, index]));

    rows.sort((a, b) => order.get(a.id) - order.get(b.id));

    return { listings: await listingsWithFarmers(rows) };
}

/* =========================================================
   VOICE NOTES ON A POST
========================================================= */

async function ownPost(farmer, productId) {
    if (!UUID.test(String(productId || ""))) {
        throw new EngineError("Product not found.", 404);
    }

    const post = must(await db.from("products").select("*").eq("id", productId).maybeSingle());

    if (!post || post.farmer_id !== farmer.id || post.status === "ARCHIVED") {
        throw new EngineError("Product not found.", 404);
    }

    return post;
}

export async function setVoice(farmer, { productId, audio, seconds }) {
    await requireSocial();

    const post = await ownPost(farmer, productId);

    const voice = readVoice(audio);

    const length = Math.max(1, Math.min(90, Math.round(Number(seconds) || 0)));

    const path = `${farmer.id}/${post.id}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.${voice.extension}`;

    const { error } = await db.storage.from(VOICE_BUCKET).upload(path, voice.buffer, {
        contentType: voice.contentType,
        cacheControl: "31536000",
        upsert: false,
    });

    if (error) {
        console.error("Voice upload error:", error);
        throw new EngineError("The voice note couldn't be saved. Please try again.", 502);
    }

    const { data } = db.storage.from(VOICE_BUCKET).getPublicUrl(path);

    must(
        await db
            .from("products")
            .update({ voice_url: data.publicUrl, voice_path: path, voice_seconds: length, updated_at: new Date().toISOString() })
            .eq("id", post.id)
            .eq("farmer_id", farmer.id)
    );

    if (post.voice_path) {
        await db.storage.from(VOICE_BUCKET).remove([post.voice_path]);
    }

    return { voice_url: data.publicUrl, voice_seconds: length };
}

export async function removeVoice(farmer, { productId }) {
    await requireSocial();

    const post = await ownPost(farmer, productId);

    must(
        await db
            .from("products")
            .update({ voice_url: null, voice_path: null, voice_seconds: null, updated_at: new Date().toISOString() })
            .eq("id", post.id)
            .eq("farmer_id", farmer.id)
    );

    if (post.voice_path) {
        await db.storage.from(VOICE_BUCKET).remove([post.voice_path]);
    }

    return {};
}

/* =========================================================
   FOR THE SITEMAP
========================================================= */

export async function sitemapFarms() {
    if (!(await socialReady())) {
        return [];
    }

    const rows = must(
        await db
            .from("users")
            .select("id, handle, created_at, country")
            .eq("role", "FARMER")
            .not("handle", "is", null)
            .limit(5000)
    ) || [];

    return rows.filter((row) => row.handle && (row.country || DEFAULT_COUNTRY));
}
