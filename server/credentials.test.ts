import { describe, it, expect } from "vitest";
import * as dotenv from "dotenv";
dotenv.config();

describe("Environment credentials", () => {
  it("EMAIL_USER is set and looks like an email", () => {
    const val = process.env.EMAIL_USER;
    expect(val).toBeTruthy();
    expect(val).toMatch(/@/);
  });

  it("EMAIL_PASS is set and is 16 characters", () => {
    const val = process.env.EMAIL_PASS;
    expect(val).toBeTruthy();
    expect(val!.replace(/\s/g, "").length).toBeGreaterThanOrEqual(16);
  });

  it("GOOGLE_SERVICE_ACCOUNT_EMAIL is set", () => {
    const val = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    expect(val).toBeTruthy();
    expect(val).toContain("iam.gserviceaccount.com");
  });

  it("GOOGLE_SERVICE_ACCOUNT_KEY is set and contains PEM header", () => {
    const val = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    expect(val).toBeTruthy();
    expect(val).toContain("BEGIN PRIVATE KEY");
  });

  it("GOOGLE_CALENDAR_ID is set", () => {
    const val = process.env.GOOGLE_CALENDAR_ID;
    expect(val).toBeTruthy();
    expect(val).toMatch(/@/);
  });
});
