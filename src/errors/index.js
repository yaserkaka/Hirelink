/**
 * Error barrel export.
 *
 * Centralizes custom error classes for convenient imports.
 *
 * Notes:
 * - Only export domain-level errors here.
 * - The global error handler decides what information to expose to clients.
 */

import ApiError from "./ApiError.js";
import ValidationError from "./ValidationError.js";

export { ApiError, ValidationError };
