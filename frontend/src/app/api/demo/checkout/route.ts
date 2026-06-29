import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const repoRoot = path.resolve(process.cwd(), "..");
const checkoutPath = path.join(repoRoot, "data/demo_repo/apps/web/checkout.py");

const cleanCheckout = `# Northstar Bank — Web checkout (clean MVP state)

from apps.api.payments_gateway import create_payment_intent


def process_checkout(customer_id: str, amount_cents: int) -> dict:
    """Process checkout via API gateway — compliant path."""
    return create_payment_intent(customer_id=customer_id, amount_cents=amount_cents)
`;

const violation = `
# DEMO VIOLATION — remove for clean verify
from packages.payments.client import charge_customer  # noqa: F401
`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const mode = body.mode;

  if (mode !== "clean" && mode !== "violation") {
    return NextResponse.json({ error: "mode must be clean or violation" }, { status: 400 });
  }

  if (mode === "clean") {
    await fs.writeFile(checkoutPath, cleanCheckout, "utf8");
  } else {
    const current = await fs.readFile(checkoutPath, "utf8").catch(() => cleanCheckout);
    await fs.writeFile(
      checkoutPath,
      current.includes("packages.payments.client") ? current : `${current}${violation}`,
      "utf8",
    );
  }

  return NextResponse.json({
    ok: true,
    mode,
    path: "data/demo_repo/apps/web/checkout.py",
  });
}
