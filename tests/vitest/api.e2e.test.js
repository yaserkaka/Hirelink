/**
 * API end-to-end tests (Supertest + real application + real database).
 *
 * Safety:
 * - The suite will only run when `DATABASE_URL_TEST` is set.
 * - If `DATABASE_URL_TEST` equals `DATABASE_URL`, you must explicitly confirm
 *   destructive cleanup via `TEST_MODE=true|1|yes`.
 *
 * What this covers:
 * - auth flows (register/login)
 * - basic talent/employer/moderator interactions
 * - job creation and application flow
 *
 * References:
 * - Supertest: https://github.com/ladjs/supertest
 * - Vitest: https://vitest.dev/
 */

import bcrypt from "bcrypt";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

async function importApp() {
	const mod = await import("../../src/app.js");
	return mod.default;
}

async function importPrisma() {
	const mod = await import("../../src/lib/prisma.js");
	return mod.default;
}

const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);
const sameDb =
	Boolean(process.env.DATABASE_URL_TEST) &&
	Boolean(process.env.DATABASE_URL) &&
	process.env.DATABASE_URL_TEST === process.env.DATABASE_URL;
const wipeConfirmed = ["true", "1", "yes"].includes(
	String(process.env.TEST_MODE || "").toLowerCase(),
);

const describeE2E =
	hasTestDb && (!sameDb || wipeConfirmed) ? describe : describe.skip;

async function clearDatabase(prisma) {
	await prisma.application.deleteMany();
	await prisma.jobSkill.deleteMany();
	await prisma.jobLanguage.deleteMany();
	await prisma.job.deleteMany();
	await prisma.talentSkill.deleteMany();
	await prisma.talentLanguage.deleteMany();
	await prisma.talentCertificate.deleteMany();
	await prisma.talent.deleteMany();
	await prisma.employer.deleteMany();
	await prisma.refreshToken.deleteMany();
	await prisma.user.deleteMany();
	await prisma.skill.deleteMany();
	await prisma.language.deleteMany();
}

describeE2E("API E2E", () => {
	let app;
	let prisma;

	const talentPassword = "a@A345dsa";
	const employerPassword = "a@A345dsa";
	const moderatorPassword = "a@A345dsa";

	const talentEmail = `talent_${Date.now()}@example.com`;
	const employerEmail = `employer_${Date.now()}@example.com`;
	const moderatorEmail =
		process.env.MODERATOR_EMAIL || `mod_${Date.now()}@example.com`;

	let talentToken;
	let employerToken;
	let moderatorToken;
	let jobId;
	let applicationId;

	let talentAgent;
	let employerAgent;
	let moderatorAgent;

	beforeAll(async () => {
		app = await importApp();
		prisma = await importPrisma();

		talentAgent = request.agent(app);
		employerAgent = request.agent(app);
		moderatorAgent = request.agent(app);

		await clearDatabase(prisma);

		const hashed = await bcrypt.hash(moderatorPassword, 10);
		await prisma.user.create({
			data: {
				id: (await import("../../src/utils/general.utils.js")).generateUlid(),
				email: moderatorEmail,
				password: hashed,
				role: "MODERATOR",
				isActive: true,
				isEmailVerified: true,
			},
		});
	}, 30000);

	afterAll(async () => {
		if (prisma) {
			await prisma.$disconnect();
		}
	}, 30000);

	it("register -> verify -> login (talent)", async () => {
		const registerRes = await request(app)
			.post("/api/v1/auth/register")
			.send({
				email: talentEmail,
				password: talentPassword,
				role: "TALENT",
				profileData: { firstName: "Test", lastName: "Talent" },
			});

		expect(registerRes.status).toBe(201);
		expect(registerRes.body.success).toBe(true);
		expect(registerRes.body.data.verificationToken).toBeTruthy();

		const verificationToken = registerRes.body.data.verificationToken;

		const verifyRes = await request(app)
			.post("/api/v1/auth/verify")
			.send({ verificationToken });
		expect(verifyRes.status).toBe(200);
		expect(verifyRes.body.success).toBe(true);

		const loginRes = await talentAgent
			.post("/api/v1/auth/login")
			.send({ email: talentEmail, password: talentPassword });
		expect(loginRes.status).toBe(200);
		expect(loginRes.body.data.token).toBeTruthy();
		talentToken = loginRes.body.data.token;
	});

	it("refresh rotates cookie and returns a new access token (talent)", async () => {
		const refreshRes = await talentAgent.get("/api/v1/auth/refresh");
		expect(refreshRes.status).toBe(200);
		expect(refreshRes.body.success).toBe(true);
		expect(refreshRes.body.data.token).toBeTruthy();
		expect(refreshRes.body.data.token).not.toBe(talentToken);
		talentToken = refreshRes.body.data.token;
	});

	it("register -> verify -> login (employer)", async () => {
		const registerRes = await request(app)
			.post("/api/v1/auth/register")
			.send({
				email: employerEmail,
				password: employerPassword,
				role: "EMPLOYER",
				profileData: { companyName: "Test Co" },
			});

		expect(registerRes.status).toBe(201);
		expect(registerRes.body.data.verificationToken).toBeTruthy();

		const verifyRes = await request(app)
			.post("/api/v1/auth/verify")
			.send({ verificationToken: registerRes.body.data.verificationToken });
		expect(verifyRes.status).toBe(200);

		const loginRes = await employerAgent
			.post("/api/v1/auth/login")
			.send({ email: employerEmail, password: employerPassword });
		expect(loginRes.status).toBe(200);
		expect(loginRes.body.data.token).toBeTruthy();
		employerToken = loginRes.body.data.token;
	});

	it("moderator login", async () => {
		const loginRes = await moderatorAgent
			.post("/api/v1/auth/login")
			.send({ email: moderatorEmail, password: moderatorPassword });
		expect(loginRes.status).toBe(200);
		moderatorToken = loginRes.body.data.token;
		expect(moderatorToken).toBeTruthy();
	});

	it("employer can create/update/list/get/delete job; talent can apply; employer can list applications", async () => {
		const createRes = await request(app)
			.post("/api/v1/employer/jobs")
			.set("Authorization", `Bearer ${employerToken}`)
			.send({
				title: "Backend Engineer",
				description: "Build APIs",
				jobType: "FULL_TIME",
				experienceLevel: "JUNIOR",
				salary: 2000,
			});
		expect(createRes.status).toBe(201);
		jobId = createRes.body.data.id;
		expect(jobId).toBeTruthy();

		const listRes = await request(app)
			.get("/api/v1/employer/jobs")
			.set("Authorization", `Bearer ${employerToken}`);
		expect(listRes.status).toBe(200);

		const getRes = await request(app)
			.get(`/api/v1/employer/jobs/${jobId}`)
			.set("Authorization", `Bearer ${employerToken}`);
		expect(getRes.status).toBe(200);
		expect(getRes.body.data.id).toBe(jobId);

		const updateRes = await request(app)
			.put(`/api/v1/employer/jobs/${jobId}`)
			.set("Authorization", `Bearer ${employerToken}`)
			.send({ title: "Backend Engineer Updated" });
		expect(updateRes.status).toBe(200);

		const talentListRes = await request(app)
			.get("/api/v1/jobs?mode=recent")
			.set("Authorization", `Bearer ${talentToken}`);
		expect(talentListRes.status).toBe(200);

		const applyRes = await request(app)
			.post(`/api/v1/jobs/${jobId}/apply`)
			.set("Authorization", `Bearer ${talentToken}`)
			.send({ coverLetter: "Hello" });
		expect(applyRes.status).toBe(201);
		applicationId = applyRes.body.data.id;
		expect(applicationId).toBeTruthy();

		const applyAgain = await request(app)
			.post(`/api/v1/jobs/${jobId}/apply`)
			.set("Authorization", `Bearer ${talentToken}`)
			.send({ coverLetter: "Hello again" });
		expect(applyAgain.status).toBe(409);

		const talentAppsRes = await request(app)
			.get("/api/v1/talent/applications")
			.set("Authorization", `Bearer ${talentToken}`);
		expect(talentAppsRes.status).toBe(200);
		expect(Array.isArray(talentAppsRes.body.data)).toBe(true);

		const employerAppsRes = await request(app)
			.get(`/api/v1/employer/jobs/${jobId}/applications`)
			.set("Authorization", `Bearer ${employerToken}`);
		expect(employerAppsRes.status).toBe(200);

		const updateStatusRes = await request(app)
			.patch(`/api/v1/employer/applications/${applicationId}`)
			.set("Authorization", `Bearer ${employerToken}`)
			.send({ status: "HIRED" });
		expect(updateStatusRes.status).toBe(200);

		const updateInvalidStatus = await request(app)
			.patch(`/api/v1/employer/applications/${applicationId}`)
			.set("Authorization", `Bearer ${employerToken}`)
			.send({ status: "INVALID" });
		expect(updateInvalidStatus.status).toBe(400);
	});

	it("moderator can list stats/jobs and delete job", async () => {
		const statsRes = await request(app)
			.get("/api/v1/moderation/stats")
			.set("Authorization", `Bearer ${moderatorToken}`);
		expect(statsRes.status).toBe(200);

		const jobsRes = await request(app)
			.get("/api/v1/moderation/jobs")
			.set("Authorization", `Bearer ${moderatorToken}`);
		expect(jobsRes.status).toBe(200);

		const deleteRes = await request(app)
			.delete(`/api/v1/moderation/jobs/${jobId}`)
			.set("Authorization", `Bearer ${moderatorToken}`);
		expect(deleteRes.status).toBe(200);

		const talentGetRes = await request(app)
			.get(`/api/v1/jobs/${jobId}`)
			.set("Authorization", `Bearer ${talentToken}`);
		expect(talentGetRes.status).toBe(404);
	});

	it("moderator cannot deactivate moderator account", async () => {
		const listUsersRes = await request(app)
			.get("/api/v1/moderation/users?limit=50&skip=0")
			.set("Authorization", `Bearer ${moderatorToken}`);
		expect(listUsersRes.status).toBe(200);

		const modUser = (listUsersRes.body.data || []).find(
			(u) => u.role === "MODERATOR",
		);
		expect(modUser).toBeTruthy();

		const deactivateRes = await request(app)
			.patch(`/api/v1/moderation/users/${modUser.id}/active`)
			.set("Authorization", `Bearer ${moderatorToken}`)
			.send({ isActive: false });
		expect(deactivateRes.status).toBe(403);
	});

	it("employer delete job returns not found after moderator deletion", async () => {
		const deleteRes = await request(app)
			.delete(`/api/v1/employer/jobs/${jobId}`)
			.set("Authorization", `Bearer ${employerToken}`);
		expect(deleteRes.status).toBe(404);
	});

	it("job apply returns 404 for missing job", async () => {
		const applyMissing = await request(app)
			.post("/api/v1/jobs/nonexistent/apply")
			.set("Authorization", `Bearer ${talentToken}`)
			.send({});
		expect(applyMissing.status).toBe(404);
	});

	it("returns correct auth/role errors", async () => {
		const noAuthJobs = await request(app).get("/api/v1/jobs");
		expect(noAuthJobs.status).toBe(401);

		const employerJobsBrowse = await request(app)
			.get("/api/v1/jobs")
			.set("Authorization", `Bearer ${employerToken}`);
		expect(employerJobsBrowse.status).toBe(403);

		const noAuth = await request(app).get("/api/v1/employer/jobs");
		expect(noAuth.status).toBe(401);

		const wrongRole = await request(app)
			.get("/api/v1/employer/jobs")
			.set("Authorization", `Bearer ${talentToken}`);
		expect(wrongRole.status).toBe(403);
	});
});
