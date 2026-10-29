import { Card } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm } from "./change-password-form";
import { ProfileForm } from "./profile-form";

export default async function AccountPage() {
  const me = await requireUser();
  const { motto } = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { motto: true } });

  return (
    <div className="max-w-sm space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold">{me.displayName}</h1>
        <p className="text-sm text-neutral-500">@{me.username}</p>
      </div>
      <Card>
        <h2 className="mb-4 font-semibold">Profile</h2>
        <ProfileForm displayName={me.displayName} motto={motto ?? ""} />
      </Card>
      <Card>
        <h2 className="mb-4 font-semibold">Change password</h2>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
