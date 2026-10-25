import { NextResponse, type NextRequest } from 'next/server';
import { emailOtpTypeSchema, safeNextPath } from '@carza/shared';
import { createClient } from '@/lib/supabase/server';

/** Links in Supabase auth emails (confirm sign-up, password recovery, email change). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = emailOtpTypeSchema.safeParse(searchParams.get('type'));
  const next = safeNextPath(
    searchParams.get('next'),
    type.data === 'recovery' ? '/update-password' : '/',
  );

  if (tokenHash && type.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: type.data, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL('/sign-in?error=link_invalid', request.url));
}
