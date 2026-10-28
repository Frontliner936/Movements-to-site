import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import {
  recruiterAccounts,
  memberAccounts,
  memberProfiles,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { requireSameOrigin } from "./auth";
import {
  clearRecruiterSession,
  getRecruiterId,
  hashRecruiterPassword,
  isRecruiterAuthConfigured,
  requireRecruiter,
  setRecruiterSession,
  verifyRecruiterPassword,
} from "./recruiter-auth";
const router = Router();
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
const attempts = new Map<string, { count: number; until: number }>();
const emailRe = /^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)*\.[^\s@<>.]{2,}$/;
export function recruiterTier(memberCount: number) {
  return memberCount < 200
    ? { tier: "small" as const, priceTsh: 15000 }
    : memberCount < 1000
      ? { tier: "medium" as const, priceTsh: 30000 }
      : { tier: "large" as const, priceTsh: 50000 };
}
export function canAccessRecruiterDirectory(state: {
  isActive: boolean;
  approved: boolean;
  paymentVerified: boolean;
  accessStatus: string;
}) {
  return (
    state.isActive &&
    state.approved &&
    state.paymentVerified &&
    state.accessStatus === "approved"
  );
}
function attemptKey(req: any, email: string) {
  return `${createHash("sha256")
    .update(String(req.ip ?? "unknown"))
    .digest("hex")
    .slice(0, 20)}:${email}`;
}
function allow(key: string) {
  const now = Date.now(),
    old = attempts.get(key);
  if (!old || old.until <= now) {
    attempts.set(key, { count: 1, until: now + 900000 });
    return true;
  }
  if (old.count >= 10) return false;
  old.count++;
  return true;
}
function validPassword(p: string) {
  return (
    p.length >= 8 &&
    p.length <= 128 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /[^A-Za-z0-9\s]/.test(p)
  );
}
const publicRecruiter = (r: any) => ({
  id: r.id,
  email: r.email,
  contactName: r.contactName,
  phone: r.phone,
  companyName: r.companyName,
  location: r.location,
  businessDetails: r.businessDetails,
  memberCount: r.memberCount,
  tier: r.tier,
  priceTsh: r.priceTsh,
  applicationStatus: r.applicationStatus,
  paymentStatus: r.paymentStatus,
  accessStatus: r.accessStatus,
  paymentReference: r.paymentReference,
  payerPhone: r.payerPhone,
});
router.post("/signup", async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  if (!isRecruiterAuthConfigured())
    return res
      .status(503)
      .json({ error: "Recruiter sign-in is not configured yet." });
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const key = attemptKey(req, email || "invalid");
  if (!allow(key))
    return res
      .status(429)
      .json({ error: "Too many attempts. Please wait and try again." });
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const contactName =
    typeof req.body?.contactName === "string"
      ? req.body.contactName.trim()
      : "";
  const phone =
    typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const companyName =
    typeof req.body?.companyName === "string"
      ? req.body.companyName.trim()
      : "";
  const location =
    typeof req.body?.location === "string" ? req.body.location.trim() : "";
  const businessDetails =
    typeof req.body?.businessDetails === "string"
      ? req.body.businessDetails.trim()
      : "";
  const memberCount = Number(req.body?.memberCount);
  if (
    !emailRe.test(email) ||
    email.length > 320 ||
    !validPassword(password) ||
    contactName.length < 2 ||
    contactName.length > 150 ||
    phone.length < 5 ||
    phone.length > 40 ||
    companyName.length < 2 ||
    companyName.length > 240 ||
    location.length < 2 ||
    location.length > 240 ||
    businessDetails.length < 2 ||
    businessDetails.length > 12000 ||
    !Number.isSafeInteger(memberCount) ||
    memberCount < 0 ||
    memberCount > 100000000
  )
    return res
      .status(400)
      .json({
        error:
          "Enter valid contact, business and member-count details, and a password of 8–128 characters with upper- and lowercase letters and a symbol.",
      });
  const db = await getDb();
  if (!db)
    return res
      .status(503)
      .json({ error: "Recruiter applications are temporarily unavailable." });
  const { tier, priceTsh } = recruiterTier(memberCount);
  try {
    const credential = await hashRecruiterPassword(password);
    // Identical response for new and existing addresses prevents account enumeration.
    await db
      .insert(recruiterAccounts)
      .values({
        email,
        passwordHash: credential.hash,
        passwordSalt: credential.salt,
        contactName,
        phone,
        companyName,
        location,
        businessDetails,
        memberCount,
        tier,
        priceTsh,
      });
  } catch (error) {
    if (
      !(
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as any).code === "ER_DUP_ENTRY"
      )
    )
      return res
        .status(500)
        .json({
          error: "The application could not be submitted. Please try again.",
        });
  }
  attempts.delete(key);
  return res
    .status(202)
    .json({
      message:
        "If an application can be created for that email, it has been received. Sign in to view its status.",
    });
});
router.post("/login", async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  if (!isRecruiterAuthConfigured())
    return res
      .status(503)
      .json({ error: "Recruiter sign-in is not configured yet." });
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  const k = attemptKey(req, email || "invalid");
  if (!allow(k))
    return res
      .status(429)
      .json({ error: "Too many attempts. Please wait and try again." });
  const db = await getDb();
  if (!db)
    return res
      .status(503)
      .json({ error: "Recruiter accounts are temporarily unavailable." });
  const [r] = emailRe.test(email)
    ? await db
        .select()
        .from(recruiterAccounts)
        .where(eq(recruiterAccounts.email, email))
        .limit(1)
    : [];
  if (
    !r ||
    !r.isActive ||
    password.length > 128 ||
    !(await verifyRecruiterPassword(password, r.passwordSalt, r.passwordHash))
  )
    return res.status(401).json({ error: "Email or password is incorrect." });
  try {
    await setRecruiterSession(req, res, r.id);
  } catch {
    return res
      .status(503)
      .json({ error: "Recruiter sign-in is not configured yet." });
  }
  attempts.delete(k);
  return res.json({ recruiter: publicRecruiter(r) });
});
router.get("/session", async (req, res) => {
  const id = await getRecruiterId(req);
  if (!id) return res.json({ authenticated: false, recruiter: null });
  const db = await getDb();
  if (!db)
    return res
      .status(503)
      .json({ error: "Recruiter accounts are temporarily unavailable." });
  const [r] = await db
    .select()
    .from(recruiterAccounts)
    .where(
      and(eq(recruiterAccounts.id, id), eq(recruiterAccounts.isActive, true))
    )
    .limit(1);
  return res.json({
    authenticated: !!r,
    recruiter: r ? publicRecruiter(r) : null,
  });
});
router.post("/logout", async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  clearRecruiterSession(req, res);
  return res.json({ authenticated: false });
});
router.use(requireRecruiter);
router.get("/dashboard", async (_req, res) => {
  const db = await getDb();
  if (!db)
    return res
      .status(503)
      .json({ error: "Recruiter dashboard is temporarily unavailable." });
  const [r] = await db
    .select()
    .from(recruiterAccounts)
    .where(eq(recruiterAccounts.id, Number(res.locals.recruiterId)))
    .limit(1);
  if (!r)
    return res
      .status(401)
      .json({ error: "Sign in to access your recruiter dashboard." });
  return res.json({
    recruiter: publicRecruiter(r),
    paymentInstructions: {
      method: "HaloPesa",
      number: "0638386459",
      amountTsh: r.priceTsh,
      submit:
        "After manual payment, submit the payer phone and transaction/reference. An administrator must separately verify payment and approve access. No automatic payment or verification is configured.",
    },
  });
});
router.post("/payment", async (req, res) => {
  if (!requireSameOrigin(req, res)) return;
  const payerPhone =
    typeof req.body?.payerPhone === "string" ? req.body.payerPhone.trim() : "";
  const paymentReference =
    typeof req.body?.paymentReference === "string"
      ? req.body.paymentReference.trim()
      : "";
  if (
    payerPhone.length < 5 ||
    payerPhone.length > 40 ||
    paymentReference.length < 3 ||
    paymentReference.length > 160
  )
    return res
      .status(400)
      .json({ error: "Enter a valid payer phone and transaction/reference." });
  const db = await getDb();
  if (!db)
    return res
      .status(503)
      .json({ error: "Payment reference could not be saved." });
  await db
    .update(recruiterAccounts)
    .set({
      payerPhone,
      paymentReference,
      paymentStatus: "submitted",
      paymentVerified: false,
      approved: false,
      accessStatus: "pending",
    })
    .where(eq(recruiterAccounts.id, Number(res.locals.recruiterId)));
  return res.json({
    submitted: true,
    message:
      "Reference received for manual administrator review. Access remains locked until payment is verified and the application is approved.",
  });
});
router.get("/directory", async (_req, res) => {
  const db = await getDb();
  if (!db)
    return res
      .status(503)
      .json({ error: "Member directory is temporarily unavailable." });
  const [r] = await db
    .select({
      approved: recruiterAccounts.approved,
      paymentVerified: recruiterAccounts.paymentVerified,
      accessStatus: recruiterAccounts.accessStatus,
      isActive: recruiterAccounts.isActive,
    })
    .from(recruiterAccounts)
    .where(eq(recruiterAccounts.id, Number(res.locals.recruiterId)))
    .limit(1);
  if (!r || !canAccessRecruiterDirectory(r))
    return res
      .status(403)
      .json({
        error:
          "Directory access requires administrator-approved access and verified payment.",
      });
  const rows = await db
    .select({
      fullName: memberProfiles.fullName,
      phoneNumber: memberProfiles.phoneNumber,
      location: memberProfiles.location,
      profession: memberProfiles.profession,
    })
    .from(memberProfiles)
    .innerJoin(memberAccounts, eq(memberProfiles.memberId, memberAccounts.id))
    .where(
      and(
        eq(memberProfiles.directoryOptIn, true),
        eq(memberAccounts.isActive, true)
      )
    )
    .orderBy(desc(memberProfiles.updatedAt))
    .limit(1000);
  return res.json({ members: rows });
});
export function createRecruiterRouter() {
  return router;
}
export default router;
