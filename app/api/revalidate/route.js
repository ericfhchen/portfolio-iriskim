import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

function isValidSignature(body, signature, secret) {
  const hmac = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const sigBuffer = Buffer.from(signature);
  const hmacBuffer = Buffer.from(hmac);
  if (sigBuffer.length !== hmacBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, hmacBuffer);
}

export async function POST(request) {
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { revalidated: false, error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("sanity-webhook-signature");
  if (!signature) {
    return NextResponse.json(
      { revalidated: false, error: "Missing signature" },
      { status: 401 }
    );
  }

  const body = await request.text();
  if (!isValidSignature(body, signature, secret)) {
    return NextResponse.json(
      { revalidated: false, error: "Invalid signature" },
      { status: 401 }
    );
  }

  try {
    const { _type, slug } = JSON.parse(body);

    revalidatePath("/", "layout");

    if (slug?.current) {
      revalidatePath(`/${slug.current}`);
    }

    return NextResponse.json({ revalidated: true });
  } catch (err) {
    return NextResponse.json(
      { revalidated: false, error: err.message },
      { status: 500 }
    );
  }
}
