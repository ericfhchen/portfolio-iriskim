import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { _type, slug } = body;

    // Revalidate the home page
    revalidatePath("/", "layout");

    // Revalidate specific project page if slug is provided
    if (slug?.current) {
      revalidatePath(`/${slug.current}`);
    }

    return NextResponse.json({ revalidated: true });
  } catch (err) {
    return NextResponse.json({ revalidated: false, error: err.message }, { status: 500 });
  }
}
