import { afterEach, describe, expect, it, vi } from "vitest";
import { isJobAlertEmailConfigured, jobMatchesAlertPreferences } from "./job-email-alerts";

afterEach(() => vi.unstubAllEnvs());

describe("jobMatchesAlertPreferences", () => {
  it("matches category and location selections together", () => {
    const job = { category: "Healthcare", location: "Dar es Salaam, Tanzania" };
    expect(jobMatchesAlertPreferences(job, { alertCategories: '["Healthcare"]', alertLocations: '["Dar es Salaam"]' })).toBe(true);
    expect(jobMatchesAlertPreferences(job, { alertCategories: '["Healthcare"]', alertLocations: '["Dodoma"]' })).toBe(false);
  });

  it("matches a selected category or location when the other filter is empty", () => {
    const job = { category: "Education", location: "Arusha" };
    expect(jobMatchesAlertPreferences(job, { alertCategories: '["Education"]', alertLocations: "[]" })).toBe(true);
    expect(jobMatchesAlertPreferences(job, { alertCategories: "[]", alertLocations: '["ARUSHA"]' })).toBe(true);
  });

  it("does not send when no usable alert filters are saved", () => {
    const job = { category: "Finance", location: "Mwanza" };
    expect(jobMatchesAlertPreferences(job, { alertCategories: null, alertLocations: null })).toBe(false);
    expect(jobMatchesAlertPreferences(job, { alertCategories: "not json", alertLocations: "[]" })).toBe(false);
  });
});

describe("isJobAlertEmailConfigured", () => {
  it("requires SMTP credentials and a public HTTPS origin without opening a connection", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SMTP_HOST", "smtp.example.test");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_SECURE", "false");
    vi.stubEnv("SMTP_USER", "alerts@example.test");
    vi.stubEnv("SMTP_PASSWORD", "secret-for-this-test");
    vi.stubEnv("SMTP_FROM_EMAIL", "alerts@example.test");
    vi.stubEnv("PUBLIC_SITE_ORIGIN", "https://getmchongo.example.test");
    expect(isJobAlertEmailConfigured()).toBe(true);
    vi.stubEnv("SMTP_PASSWORD", "");
    expect(isJobAlertEmailConfigured()).toBe(false);
    vi.stubEnv("SMTP_PASSWORD", "secret-for-this-test");
    vi.stubEnv("PUBLIC_SITE_ORIGIN", "http://getmchongo.example.test");
    expect(isJobAlertEmailConfigured()).toBe(false);
  });
});
