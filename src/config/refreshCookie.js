import { parseExpiry } from "../utils/general.utils.js";
import env from "./env.js";

/**
 * Cookie options for the refresh token cookie (name: `jwt`).
 */
export const refreshCookie = {
	httpOnly: true,
	secure: env.NODE_ENV === "production",
	sameSite: env.NODE_ENV === "production" ? "none" : "lax",
	path: "/",
	maxAge: parseExpiry(env.JWT_REFRESH_EXPIRY),
};
