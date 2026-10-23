// The newsletter's settings, in code. Only the Resend API key (RESEND_API_KEY) comes from the environment.
// This repo is public, so anyone can read the passcode below: it keeps casual visitors out of /admin, nothing more.
import { CONTACT_EMAIL } from "./site";

/** The passcode /admin asks for. */
export const ADMIN_PASSCODE = "fastandfurious";

/** The sender. Its domain must be verified in Resend, or sending to the list fails (previews to the Resend account owner still work). */
export const NEWSLETTER_FROM = "HaaV <newsletter@haav.build>";

/** Where "Send preview to me" delivers. */
export const PREVIEW_EMAIL = CONTACT_EMAIL;

/** Name of the Resend segment that holds the subscribers. It is created on first use. */
export const SEGMENT_NAME = "Newsletter";
