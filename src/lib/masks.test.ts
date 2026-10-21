import { describe, it, expect } from "vitest";
import { maskPhone, unmaskPhone, isValidPhone, isValidEmail } from "./masks";

describe("maskPhone", () => {
  it("returns empty string for empty input", () => {
    expect(maskPhone("")).toBe("");
  });

  it("strips non-digit characters", () => {
    expect(maskPhone("abc")).toBe("");
    expect(maskPhone("(11)")).toBe("(11");
  });

  it("formats partial DDD (1-2 digits)", () => {
    expect(maskPhone("1")).toBe("(1");
    expect(maskPhone("11")).toBe("(11");
  });

  it("formats up to 6 digits with DDD and partial number", () => {
    expect(maskPhone("113")).toBe("(11) 3");
    expect(maskPhone("113456")).toBe("(11) 3456");
  });

  it("formats 10-digit landline as (11) 3456-7890", () => {
    expect(maskPhone("1134567890")).toBe("(11) 3456-7890");
  });

  it("formats 11-digit mobile as (11) 99999-0000", () => {
    expect(maskPhone("11999990000")).toBe("(11) 99999-0000");
  });

  it("truncates input longer than 11 digits", () => {
    expect(maskPhone("119999900001234")).toBe("(11) 99999-0000");
  });

  it("ignores already-masked input and reformats it", () => {
    expect(maskPhone("(11) 99999-0000")).toBe("(11) 99999-0000");
  });
});

describe("unmaskPhone", () => {
  it("returns only digits", () => {
    expect(unmaskPhone("(11) 99999-0000")).toBe("11999990000");
  });

  it("returns empty string when no digits present", () => {
    expect(unmaskPhone("abc-()")).toBe("");
    expect(unmaskPhone("")).toBe("");
  });
});

describe("isValidPhone", () => {
  it("accepts 10-digit landline", () => {
    expect(isValidPhone("1134567890")).toBe(true);
    expect(isValidPhone("(11) 3456-7890")).toBe(true);
  });

  it("accepts 11-digit mobile", () => {
    expect(isValidPhone("11999990000")).toBe(true);
    expect(isValidPhone("(11) 99999-0000")).toBe(true);
  });

  it("rejects too short or too long", () => {
    expect(isValidPhone("123456789")).toBe(false);
    expect(isValidPhone("123456789012")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });

  it("accepts numbers with DDI 55", () => {
    expect(isValidPhone("5521983160797")).toBe(true);
    expect(isValidPhone("559381234567")).toBe(true);
  });

  it("rejects 11-digit numbers without the mobile 9 (WhatsApp internal ids)", () => {
    expect(isValidPhone("93405308818")).toBe(false);
    expect(isValidPhone("5593405308818")).toBe(false);
  });

  it("rejects unknown DDDs and numbers starting with 0/1 after the DDD", () => {
    expect(isValidPhone("20999990000")).toBe(false);
    expect(isValidPhone("1112345678")).toBe(false);
    expect(isValidPhone("333009662623")).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts empty string (optional field)", () => {
    expect(isValidEmail("")).toBe(true);
  });

  it("accepts valid emails", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("user.name+tag@sub.example.com")).toBe(true);
  });

  it("rejects malformed emails", () => {
    expect(isValidEmail("no-at-sign")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a @b.co")).toBe(false);
    expect(isValidEmail("@b.co")).toBe(false);
    expect(isValidEmail("a@.co")).toBe(false);
  });
});