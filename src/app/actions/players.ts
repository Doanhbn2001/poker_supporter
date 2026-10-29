"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireAdmin, requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

const PlayerSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, { error: "Username: 3-20 letters, numbers or _." }),
  displayName: z.string().trim().min(1, { error: "Enter a poker name." }).max(40),
  password: z.string().min(8, { error: "Password must be at least 8 characters." }),
});

export type FormState =
  | { error?: string; success?: string; values?: Record<string, string> }
  | undefined;

export async function createPlayer(_state: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const values = {
    username: String(formData.get("username") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = PlayerSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  const { username, displayName, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: `Username "${username}" is taken.`, values };

  await prisma.user.create({
    data: { username, displayName, passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath("/players");
  return { success: `Added ${displayName}.` };
}

const ProfileSchema = z.object({
  displayName: z.string().trim().min(1, { error: "Enter a poker name." }).max(40, { error: "Poker name: 40 characters max." }),
  motto: z.string().trim().max(160, { error: "Motto: 160 characters max." }),
});

export async function updateProfile(_state: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();

  const values = {
    displayName: String(formData.get("displayName") ?? ""),
    motto: String(formData.get("motto") ?? ""),
  };
  const parsed = ProfileSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };

  await prisma.user.update({
    where: { id: me.id },
    data: { displayName: parsed.data.displayName, motto: parsed.data.motto || null },
  });
  // The poker name shows in the top bar and every leaderboard/session page.
  revalidatePath("/", "layout");
  return { success: "Profile saved.", values: parsed.data };
}

const PasswordSchema = z.object({
  current: z.string().min(1, { error: "Enter your current password." }),
  next: z.string().min(8, { error: "New password must be at least 8 characters." }),
});

export async function changePassword(_state: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();

  const parsed = PasswordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { error: "Current password is wrong." };
  }

  await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) },
  });
  return { success: "Password changed." };
}
