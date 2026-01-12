/**
 * Applications controller unit tests.
 *
 * Strategy:
 * - Mock the application service and verify the controller returns consistent
 *   `success/fail` response shapes.
 *
 * References:
 * - Vitest: https://vitest.dev/
 */

import { describe, expect, it, vi } from "vitest";
import { createMockRes } from "./test.utils.js";

vi.mock("../../src/services/index.js", () => {
	return {
		applicationService: {
			listTalentApplications: vi.fn(async () => ({
				ok: true,
				statusCode: 200,
				message: "applications fetched",
				payload: [{ id: "a1" }],
			})),
			listEmployerJobApplications: vi.fn(async () => ({
				ok: true,
				statusCode: 200,
				message: "applications fetched",
				payload: [],
			})),
			updateEmployerApplicationStatus: vi.fn(async () => ({
				ok: true,
				statusCode: 200,
				message: "application updated",
				payload: { id: "a1", status: "HIRED" },
			})),
		},
	};
});

import * as applicationsController from "../../src/controllers/applications.controller.js";

describe("applications.controller", () => {
	it("list returns talent applications", async () => {
		const req = { user: { id: "u1" } };
		const res = createMockRes();

		await applicationsController.list(req, res);

		expect(res.statusCode).toBe(200);
		expect(res.body.data).toEqual([{ id: "a1" }]);
	});

	it("updateStatus returns updated application", async () => {
		const req = {
			user: { id: "e1" },
			params: { applicationId: "a1" },
			body: { status: "HIRED" },
		};
		const res = createMockRes();

		await applicationsController.updateStatus(req, res);

		expect(res.statusCode).toBe(200);
		expect(res.body.data.status).toBe("HIRED");
	});
});
