import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">Commerce Portal</h1>
      <p className="text-muted-foreground">
        B2B Commerce Platform for Puerto Rico
      </p>
      <Link
        href="/api/health"
        className="text-sm underline underline-offset-4 hover:text-primary"
      >
        Health Check
      </Link>
    </div>
  );
}
