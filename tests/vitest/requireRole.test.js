/**
 * requireRole middleware unit tests.
 *
 * Validates role-based access control (RBAC) behavior:
 * - missing `req.user` -> 401
 * - disallowed role -> 403
 * - allowed role -> calls `next()`
 *
 * References:
 * - OWASP Access Control: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
 */

import { describe, expect, it, vi } from "vitest";
import requireRole from "../../src/middleware/requireRole.js";
import statusCode from "../../src/utils/statusCodes.utils.js";
import { createMockRes } from "./test.utils.js";

describe("requireRole middleware", () => {
	it("blocks when req.user is missing", () => {
		const middleware = requireRole("TALENT");
		const req = {};
		const res = createMockRes();
		const next = vi.fn();

		middleware(req, res, next);

		expect(res.statusCode).toBe(statusCode.UNAUTHORIZED);
		expect(res.body).toEqual({
			success: false,
			statusCode: statusCode.UNAUTHORIZED,
			message: "unauthorized",
			details: null,
		});
		expect(next).not.toHaveBeenCalled();
	});

	it("blocks when req.user.role is missing", () => {
		const middleware = requireRole(["TALENT"]);
		const req = { user: {} };
		const res = createMockRes();
		const next = vi.fn();

		middleware(req, res, next);

		expect(res.statusCode).toBe(statusCode.UNAUTHORIZED);
		expect(res.body).toEqual({
			success: false,
			statusCode: statusCode.UNAUTHORIZED,
			message: "unauthorized",
			details: null,
		});
		expect(next).not.toHaveBeenCalled();
	});

	it("blocks when role is not allowed", () => {
		const middleware = requireRole(["EMPLOYER"]);
		const req = { user: { role: "TALENT" } };
		const res = createMockRes();
		const next = vi.fn();

		middleware(req, res, next);

		expect(res.statusCode).toBe(statusCode.FORBIDDEN);
		expect(res.body).toEqual({
			success: false,
			statusCode: statusCode.FORBIDDEN,
			message: "forbidden",
			details: null,
		});
		expect(next).not.toHaveBeenCalled();
	});

	it("blocks when role case does not match", () => {
		const middleware = requireRole(["TALENT"]);
		const req = { user: { role: "talent" } };
		const res = createMockRes();
		const next = vi.fn();

		middleware(req, res, next);

		expect(res.statusCode).toBe(403);
		expect(res.body).toEqual({
			success: false,
			statusCode: 403,
			message: "forbidden",
			details: null,
		});
		expect(next).not.toHaveBeenCalled();
	});

	it("allows when role is allowed", () => {
		const middleware = requireRole(["TALENT", "EMPLOYER"]);
		const req = { user: { role: "TALENT" } };
		const res = createMockRes();
		const next = vi.fn();

		middleware(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(res.statusCode).toBe(200);
		expect(res.body).toBe(null);
	});

	it("allows when allowedRoles is a string", () => {
		const middleware = requireRole("TALENT");
		const req = { user: { role: "TALENT" } };
		const res = createMockRes();
		const next = vi.fn();

		middleware(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(res.statusCode).toBe(200);
		expect(res.body).toBe(null);
	});
});
