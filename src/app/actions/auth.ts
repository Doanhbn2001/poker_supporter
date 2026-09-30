"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import * as z from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

const LoginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, { error: "Enter your username." }),
  password: z.string().min(1, { error: "Enter your password." }),
});

export type LoginState = { error?: string; username?: string } | undefined;

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const parsed = LoginSchema.safeParse({
    username,
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, username };

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!user || !ok) return { error: "Wrong username or password.", username };

  await createSession(user.id, user.role);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
