import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { mid } = await request.json();

  if (!mid) {
    return NextResponse.json({ error: 'mid required' }, { status: 400 });
  }

  // Get merchant details
  const { data: merchant } = await supabase
    .from('merchants')
    .select('mid, business_name, github_repo, site_url, cart_enabled')
    .eq('mid', mid)
    .single();

  if (!merchant) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  if (!merchant.github_repo) {
    return NextResponse.json({ error: 'No GitHub repo configured. Set it in Settings first.' }, { status: 400 });
  }

  if (!merchant.cart_enabled) {
    return NextResponse.json({ error: 'Cart must be enabled before deploying.' }, { status: 400 });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return NextResponse.json({ error: 'GitHub token not configured' }, { status: 500 });
  }

  const repo = merchant.github_repo;
  const embedScript = `<script src="https://commerce-cart-prod.b2bweb.app/v1/cart.js?mid=${mid}" async></script>`;

  // Create GitHub issue that triggers the claude.yml workflow
  const issueTitle = `Add commerce cart widget for ${merchant.business_name}`;
  const issueBody = `@claude

## Task
Add the B2B Commerce cart widget to this merchant's website. This script adds a floating "Order" button that opens an online ordering cart synced with the merchant's Clover POS.

## What to do
1. Find the main HTML layout file. Look for one of these (check in order):
   - \`src/app/layout.tsx\` (Next.js App Router)
   - \`app/layout.tsx\`
   - \`pages/_document.tsx\` (Next.js Pages Router)
   - \`pages/_app.tsx\`
   - \`index.html\`
   - \`public/index.html\`

2. Add this script tag just before the closing \`</body>\` tag (or at the end of the \`<body>\` in a layout component):

\`\`\`html
${embedScript}
\`\`\`

**For Next.js App Router (\`layout.tsx\`)**, add it using the Script component:
\`\`\`tsx
import Script from 'next/script'

// Add inside the <body> tag, before the closing </body>:
<Script
  src="https://commerce-cart-prod.b2bweb.app/v1/cart.js?mid=${mid}"
  strategy="lazyOnload"
/>
\`\`\`

3. **Important rules:**
   - Do NOT add the script if it already exists (check first!)
   - Do NOT modify any other files
   - Do NOT change any existing functionality
   - Keep the commit clean and minimal

## Merchant Info
- **Business**: ${merchant.business_name}
- **MID**: ${mid}
- **Site**: ${merchant.site_url || 'N/A'}

## After adding the script
The cart widget will appear automatically as a floating button on the merchant's website. No other configuration is needed.`;

  try {
    // Create the issue via GitHub API
    const res = await fetch(
      `https://api.github.com/repos/${repo}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          title: issueTitle,
          body: issueBody,
          labels: ['claude'],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `GitHub API error: ${res.status} ${err}` },
        { status: 502 }
      );
    }

    const issue = await res.json();

    return NextResponse.json({
      success: true,
      issue_number: issue.number,
      issue_url: issue.html_url,
      message: `Issue #${issue.number} created. Claude will add the cart widget and create a PR automatically.`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to create issue: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }
}
