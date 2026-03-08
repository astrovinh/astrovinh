import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    // TODO: Integrate Resend when API key is available
    // import { Resend } from 'resend';
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'DevPet <hello@devpet.com>',
    //   to: email,
    //   subject: 'Welcome to the DevPet waitlist!',
    //   html: '<p>Thanks for joining! Your pet will be waiting for you. 😺</p>',
    // });

    console.log(`Waitlist signup: ${email}`);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
