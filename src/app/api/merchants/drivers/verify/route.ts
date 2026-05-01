import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse('<h2>Invalid verification link</h2>', {
      headers: { 'Content-Type': 'text/html' },
      status: 400,
    });
  }

  const supabase = createServiceClient();

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, full_name')
    .eq('verification_token', token)
    .single();

  if (!driver) {
    return new NextResponse('<h2>Invalid or expired verification link</h2>', {
      headers: { 'Content-Type': 'text/html' },
      status: 404,
    });
  }

  await supabase
    .from('drivers')
    .update({ email_verified: true, status: 'active', verification_token: null })
    .eq('id', driver.id);

  return new NextResponse(
    `<!DOCTYPE html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Email Verified</title></head>
    <body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb">
      <div style="text-align:center;padding:32px">
        <div style="width:64px;height:64px;background:#10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <svg width="32" height="32" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h1 style="font-size:24px;color:#111827;margin:0">Email Verified!</h1>
        <p style="color:#6b7280;margin-top:8px">Welcome, ${driver.full_name}. Your driver account is now active.</p>
        <p style="color:#9ca3af;font-size:14px;margin-top:24px">You can close this page.</p>
      </div>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
