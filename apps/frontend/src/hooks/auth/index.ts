/**
 * Central export file for all authentication-related hooks
 * Best Practice: Single source of truth for auth hooks
 */

// Authentication
export * from "../use-login";
export * from "../use-register";
export * from "../use-auth-profile";

// Password Management
export * from "../use-password-reset";
export * from "../use-password-change";
