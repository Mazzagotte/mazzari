import {NextResponse} from "next/server";

export async function GET() {
  return NextResponse.json({app:"splitflap-smart", mode:process.env.NODE_ENV});
}
