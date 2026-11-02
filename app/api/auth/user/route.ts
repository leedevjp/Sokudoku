import { createClient } from '@/lib/supabase/server';
export async function GET(){
 const client=await createClient();
 const {data,error}=await client.auth.getUser();
 const headers={'Cache-Control':'private, no-store'};
 if(error||!data.user)return Response.json({error:'unauthorized'},{status:401,headers});
 return Response.json({user:{id:data.user.id,email:data.user.email}},{headers});
}
