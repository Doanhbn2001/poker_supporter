import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold">♠ Poker Supporter</h1>
        <p className="mb-6 text-sm text-neutral-500">Sign in to see the group&apos;s stats.</p>
        <LoginForm />
      </Card>
    </main>
  );
}
