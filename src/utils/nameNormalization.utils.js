/**
 * Name normalization helpers.
 *
 * Provides two related representations:
 * - `normalizeDisplayName`: trims/collapses whitespace to keep a human-friendly display value.
 * - `normalizedNameKey`: generates a normalized lookup key that ignores case, spaces, and punctuation
 *   (and removes diacritics) so user input can be matched reliably.
 *
 * This is used for entities like Skill/Language where users may type variations like:
 * "Node.js" / "node js" / "nodejs".
 *
 * References:
 * - Unicode normalization: https://unicode.org/reports/tr15/
 */

export function normalizeDisplayName(value) {
	return String(value || "")
		.trim()
		.replace(/\s+/g, " ");
}

export function normalizedNameKey(value) {
	const input = normalizeDisplayName(value);
	if (!input) {
		return "";
	}

	// Normalize diacritics (for example, "Français" -> "Francais")
	const noDiacritics = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

	// Make it insensitive to punctuation and spaces.
	return noDiacritics
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "")
		.trim();
}
