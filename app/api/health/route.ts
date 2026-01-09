//prevent supabase project pause due to inactivity

import { NextResponse } from "next/server";
import { getSupabaseServiceRole } from "../../lib/storage/supabaseClientServer";

export async function GET() {
  try {
    const supabase = getSupabaseServiceRole();
    
    // Just attempt a connection - even failed attempts count as activity
    if (supabase) {
      // Minimal operation - just check if client is initialized
      await supabase.auth.getSession().catch(() => {
        // Ignore errors - the connection attempt itself counts as activity
      });
    }
    
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Even errors count as activity - the important thing is the API call
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  }
}

