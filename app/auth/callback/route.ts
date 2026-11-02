import { NextRequest,NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request:NextRequest){
 const code=request.nextUrl.searchParams.get('code');
 if(code){
  try{const client=await createClient();const {error}=await client.auth.exchangeCodeForSession(code);
   if(!error){const response=NextResponse.redirect(new URL('/',request.url));response.headers.set('Cache-Control','private, no-store');return response;}
  }catch{/* Show a recoverable error without exposing provider details. */}
 }
 return NextResponse.redirect(new URL('/auth/error',request.url));
}
