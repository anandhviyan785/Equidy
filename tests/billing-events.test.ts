import { beforeEach, describe, expect, it, vi } from "vitest";

const cancel = vi.fn(async () => ({}));
let storedRow: Record<string, unknown> | null = null;
const queries: string[] = [];

vi.mock("stripe", () => ({ default: class { subscriptions = { cancel }; } }));
vi.mock("../server/db", () => ({
  dbEnabled: () => true,
  db: () => async (strings: TemplateStringsArray) => {
    const text = strings.join("?");
    queries.push(text);
    if (text.includes("SELECT customer_id")) return storedRow ? [storedRow] : [];
    return [];
  },
}));

const checkout = (sub: string, created: number) => ({
  type: "checkout.session.completed",
  created,
  data: { object: { client_reference_id: "u1", customer: "cus_1", subscription: sub, mode: "subscription", payment_status: "paid" } },
}) as never;

describe("applyStripeEvent checkout ordering", () => {
  beforeEach(() => {
    cancel.mockClear();
    queries.length = 0;
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    process.env.STRIPE_PRICE_ID = "price_x";
  });

  it("does not cancel the current subscription when an older checkout event is replayed", async () => {
    storedRow = { customer_id: "cus_1", subscription_id: "sub_B", status: "active", event_created: 200 };
    const { applyStripeEvent } = await import("../server/billing");
    await applyStripeEvent(checkout("sub_A", 100));
    expect(cancel).not.toHaveBeenCalled();
  });

  it("saves the new subscription before cancelling the previous one", async () => {
    storedRow = { customer_id: "cus_1", subscription_id: "sub_A", status: "active", event_created: 100 };
    const { applyStripeEvent } = await import("../server/billing");
    await applyStripeEvent(checkout("sub_B", 200));
    expect(queries.some((q) => q.includes("INSERT INTO equidy_subscriptions"))).toBe(true);
    expect(cancel).toHaveBeenCalledWith("sub_A");
  });
});
