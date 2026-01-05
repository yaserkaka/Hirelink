/**
 * Talent routes.
 *
 * Exposes profile endpoints for the authenticated talent user, including
 * uploading and fetching profile files (avatar/resume).
 *
 * Notes:
 * - All endpoints here require authentication and `TALENT` role.
 * - Skills/languages endpoints accept user-friendly input which is normalized in the service layer.
 * - Upload endpoints use Multer + Cloudinary storage.
 *
 * References:
 * - Express Router: https://expressjs.com/en/guide/routing.html
 * - Multer: https://github.com/expressjs/multer
 */

import { Router } from "express";
import { authController, talentController } from "../controllers/index.js";
import requireAuth from "../middleware/requireAuth.js";
import requireRole from "../middleware/requireRole.js";
import { uploadAvatar, uploadResume } from "../middleware/upload.js";
import validate from "../middleware/validate.js";
import {
	talentLanguagesSchema,
	talentProfileSchema,
	talentSkillsSchema,
} from "../validators/talent.validator.js";

const router = Router();

router.get("/profile", requireAuth, requireRole("TALENT"), authController.getCurrent);
router.put(
	"/profile",
	requireAuth,
	requireRole("TALENT"),
	validate(talentProfileSchema),
	talentController.updateProfile,
);

router.put(
	"/skills",
	requireAuth,
	requireRole("TALENT"),
	validate(talentSkillsSchema),
	talentController.setSkills,
);

router.put(
	"/languages",
	requireAuth,
	requireRole("TALENT"),
	validate(talentLanguagesSchema),
	talentController.setLanguages,
);

router.put(
	"/avatar",
	requireAuth,
	requireRole("TALENT"),
	uploadAvatar.single("avatar"),
	talentController.updateFile,
);
router.get("/avatar", requireAuth, requireRole("TALENT"), talentController.getFile);
router.delete(
	"/avatar",
	requireAuth,
	requireRole("TALENT"),
	talentController.deleteFile,
);

router.get("/resume", requireAuth, requireRole("TALENT"), talentController.getFile);
router.put(
	"/resume",
	requireAuth,
	requireRole("TALENT"),
	uploadResume.single("resume"),
	talentController.updateFile,
);
router.delete(
	"/resume",
	requireAuth,
	requireRole("TALENT"),
	talentController.deleteFile,
);

export default router;
