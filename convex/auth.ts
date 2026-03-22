import { convexAuth, getAuthUserId as getAuthUserIdFromLib } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { MutationCtx, QueryCtx, ActionCtx } from "./_generated/server";

const DEFAULT_ROLES = [
  { name: "Director", permissions: ["all"] },
  { name: "Supervisor", permissions: ["close_issue", "assign_sub_issue", "create_issue"] },
  { name: "Field Officer", permissions: ["create_issue", "upload_media"] },
  { name: "Clerical", permissions: ["create_issue", "upload_media", "csv_upload"] },
];

async function ensureRoles(ctx: MutationCtx) {
  const existing = await ctx.db.query("roles").collect();
  if (existing.length === 0) {
    const now = Date.now();
    for (const r of DEFAULT_ROLES) {
      await ctx.db.insert("roles", { ...r, createdAt: now });
    }
  }
}

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password({ 
    profile: (params) => ({ email: params.email as string, name: params.name as string }),
  })],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      const { userId, existingUserId, profile } = args;

      // Only run on new user creation (not updates / sign-ins)
      if (existingUserId != null) return;

      try {
        // Seed default roles if none exist
        await ensureRoles(ctx);

        // Check if this is the first app user → Director. Otherwise → Clerical
        const allAppUsers = await ctx.db.query("appUsers").collect();
        const isFirst = allAppUsers.length === 0;

        const directorRole = await (ctx.db as any)
          .query("roles")
          .withIndex("by_name", (q: any) => q.eq("name", "Director"))
          .first();
        const clericalRole = await (ctx.db as any)
          .query("roles")
          .withIndex("by_name", (q: any) => q.eq("name", "Clerical"))
          .first();

        if (!directorRole) return;

        const roleId = isFirst ? directorRole._id : (clericalRole?._id ?? directorRole._id);

        const name = (profile.name as string | undefined) ?? (profile.email as string | undefined) ?? "Unknown";
        const email = (profile.email as string | undefined) ?? "";

        // Check if appUser already exists for this authUserId
        const existing = await (ctx.db as any)
          .query("appUsers")
          .withIndex("by_authUserId", (q: any) => q.eq("authUserId", userId as string))
          .first();

        if (!existing) {
          await ctx.db.insert("appUsers", {
            name,
            email,
            roleId,
            authUserId: userId as string,
            isActive: true,
            createdAt: Date.now(),
          });
        }
      } catch (e) {
        // Log but don't fail the auth transaction
        console.error("afterUserCreatedOrUpdated error:", e);
      }
    },
  },
});

export async function getAuthUserId(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const userId = await getAuthUserIdFromLib(ctx);
  if (!userId) return null;
  if ("db" in ctx) {
    const appUser = await (ctx.db as any).query("appUsers").withIndex("by_authUserId", (q: any) => q.eq("authUserId", userId)).first();
    if (appUser && appUser.isActive === false) throw new Error("Account has been deactivated. Please contact an administrator.");
  }
  return userId;
}
