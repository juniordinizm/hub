import { describe, expect, it } from "vitest";
import {
  parseCheckoutRequest,
  parseCheckoutStatusRequest,
} from "./checkout-api";

const ATTEMPT_ID = "7fb3447e-2702-48f8-abe2-6c47b091bdcb";
const COURSE_ID = "4a45d650-fc63-44c9-b2d1-6c73d52de84c";

describe("parseCheckoutRequest", () => {
  it("normalizes a checkout request selected by course slug", () => {
    expect(
      parseCheckoutRequest({
        checkoutAttemptId: ` ${ATTEMPT_ID} `,
        courseSlug: " Curso ",
      })
    ).toEqual({
      checkoutAttemptId: ATTEMPT_ID,
      courseSlug: "curso",
    });
  });

  it("accepts a valid course UUID as the only course identifier", () => {
    expect(
      parseCheckoutRequest({
        checkoutAttemptId: ATTEMPT_ID,
        courseId: ` ${COURSE_ID} `,
      })
    ).toEqual({ checkoutAttemptId: ATTEMPT_ID, courseId: COURSE_ID });
  });

  it.each([
    "buyerEmail",
    "buyerName",
    "price",
    "callback",
    "paymentMethod",
    "unknown",
  ])("rejects the forbidden or unknown %s key", (key) => {
    expect(
      parseCheckoutRequest({
        checkoutAttemptId: ATTEMPT_ID,
        courseSlug: "curso",
        [key]: "attacker-controlled",
      })
    ).toBeNull();
  });

  it.each([
    null,
    [],
    [ATTEMPT_ID],
    "checkout",
    1,
    Object.create(null),
    Object.create({ checkoutAttemptId: ATTEMPT_ID }),
  ])("rejects non-record and unusual-prototype input", (value) => {
    expect(parseCheckoutRequest(value)).toBeNull();
  });

  it.each([
    {},
    { checkoutAttemptId: ATTEMPT_ID },
    {
      checkoutAttemptId: ATTEMPT_ID,
      courseId: COURSE_ID,
      courseSlug: "curso",
    },
    {
      checkoutAttemptId: ATTEMPT_ID,
      courseId: undefined,
      courseSlug: "curso",
    },
  ])("requires exactly one explicitly present course identifier", (value) => {
    expect(parseCheckoutRequest(value)).toBeNull();
  });

  it.each([
    { checkoutAttemptId: 123, courseSlug: "curso" },
    { checkoutAttemptId: ATTEMPT_ID, courseSlug: 123 },
    { checkoutAttemptId: ATTEMPT_ID, courseSlug: null },
    { checkoutAttemptId: ATTEMPT_ID, courseSlug: ["curso"] },
    { checkoutAttemptId: "not-a-uuid", courseSlug: "curso" },
    { checkoutAttemptId: ATTEMPT_ID, courseId: "not-a-uuid" },
    { checkoutAttemptId: ATTEMPT_ID, courseSlug: "curso/invalido" },
    { checkoutAttemptId: ATTEMPT_ID, courseSlug: "---" },
  ])("rejects coercible or invalid field values", (value) => {
    expect(parseCheckoutRequest(value)).toBeNull();
  });
});

describe("parseCheckoutStatusRequest", () => {
  it("normalizes the opaque attempt and course slug pair", () => {
    expect(
      parseCheckoutStatusRequest(
        new URLSearchParams({
          checkoutAttemptId: ` ${ATTEMPT_ID} `,
          courseSlug: " Curso ",
        })
      )
    ).toEqual({ checkoutAttemptId: ATTEMPT_ID, courseSlug: "curso" });
  });

  it.each([
    new URLSearchParams({ checkoutAttemptId: ATTEMPT_ID }),
    new URLSearchParams({ checkoutAttemptId: "invalid", courseSlug: "curso" }),
    new URLSearchParams({
      checkoutAttemptId: ATTEMPT_ID,
      courseSlug: "curso/invalido",
    }),
    new URLSearchParams({
      checkoutAttemptId: ATTEMPT_ID,
      courseSlug: "curso",
      orderId: "enumeration-attempt",
    }),
    new URLSearchParams(
      `checkoutAttemptId=${ATTEMPT_ID}&checkoutAttemptId=${ATTEMPT_ID}&courseSlug=curso`
    ),
  ])("rejects ambiguous or invalid query parameters", (query) => {
    expect(parseCheckoutStatusRequest(query)).toBeNull();
  });
});
