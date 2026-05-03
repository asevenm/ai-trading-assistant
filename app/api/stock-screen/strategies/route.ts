import { NextResponse } from "next/server"
import { STRATEGIES } from "@/lib/ai/stock-screener"

export async function GET() {
  return NextResponse.json(STRATEGIES)
}
