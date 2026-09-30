import { Card } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { ChangePasswordForm } from "./change-password-form";

export default async function AccountPage() {
  const me = await requireUser();
  return (
    <div className="max-w-sm">
      <h1 className="mb-1 text-xl font-semibold">{me.displayName}</h1>
      <p className="mb-6 text-sm text-neutral-500">@{me.username}</p>
      <Card>
        <h2 className="mb-4 font-semibold">Change password</h2>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
