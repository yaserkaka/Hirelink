/**
 * Vitest configuration.
 *
 * References:
 * - Vitest config: https://vitest.dev/config/
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/vitest/**/*.test.js"],
		setupFiles: ["tests/vitest/setup.env.js"],
		testTimeout: 20000,
		clearMocks: true,
		restoreMocks: true,
		mockReset: true,
	},
});
