import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth";

// Get the current app user profile
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) return null;
    const user = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authId))
      .first();
    if (!user) return null;
    const role = await ctx.db.get(user.roleId);
    return { ...user, role };
  },
});

// List all app users
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const users = await ctx.db.query("appUsers").collect();
    return Promise.all(
      users.map(async (u) => {
        const role = await ctx.db.get(u.roleId);
        return { ...u, role };
      })
    );
  },
});

// Create a new app user (Director only)
export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    roleId: v.id("roles"),
    authUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    return await ctx.db.insert("appUsers", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Assign a user to a role
export const assignRole = mutation({
  args: {
    userId: v.id("appUsers"),
    roleId: v.id("roles"),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    await ctx.db.patch(args.userId, { roleId: args.roleId });
  },
});

// Toggle user active status
export const toggleUserActiveStatus = mutation({
  args: { userId: v.id("appUsers"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    
    // Prevent deactivating yourself
    const me = await ctx.db.query("appUsers").withIndex("by_authUserId", q => q.eq("authUserId", authId)).first();
    if (me?._id === args.userId) throw new Error("You cannot deactivate your own account");
    
    await ctx.db.patch(args.userId, { isActive: args.isActive });
  }
});
