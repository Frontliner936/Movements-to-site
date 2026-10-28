import { describe, expect, it } from "vitest";
import { canAccessRecruiterDirectory, recruiterTier } from "./recruiter-routes";

describe("recruiter subscription tiers", () => {
  it("uses the specified tier boundaries and prices", () => {
    expect(recruiterTier(0)).toEqual({ tier: "small", priceTsh: 15000 });
    expect(recruiterTier(199)).toEqual({ tier: "small", priceTsh: 15000 });
    expect(recruiterTier(200)).toEqual({ tier: "medium", priceTsh: 30000 });
    expect(recruiterTier(999)).toEqual({ tier: "medium", priceTsh: 30000 });
    expect(recruiterTier(1000)).toEqual({ tier: "large", priceTsh: 50000 });
  });
});

describe("recruiter directory access policy", () => {
  const eligible = {
    isActive: true,
    approved: true,
    paymentVerified: true,
    accessStatus: "approved",
  };
  it("allows access only when account, payment and application are all approved", () => {
    expect(canAccessRecruiterDirectory(eligible)).toBe(true);
    expect(
      canAccessRecruiterDirectory({ ...eligible, paymentVerified: false })
    ).toBe(false);
    expect(canAccessRecruiterDirectory({ ...eligible, approved: false })).toBe(
      false
    );
    expect(
      canAccessRecruiterDirectory({ ...eligible, accessStatus: "pending" })
    ).toBe(false);
    expect(canAccessRecruiterDirectory({ ...eligible, isActive: false })).toBe(
      false
    );
  });
});
