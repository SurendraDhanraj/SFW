import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth";

// List all roles
export const listRoles = query({
  args: {},
  handler: async (ctx) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    return ctx.db.query("roles").collect();
  },
});

// Create a new role
export const createRole = mutation({
  args: {
    name: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    return ctx.db.insert("roles", {
      name: args.name,
      permissions: args.permissions,
      createdAt: Date.now(),
    });
  },
});

// Update a role
export const updateRole = mutation({
  args: {
    roleId: v.id("roles"),
    name: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const { roleId, ...updates } = args;
    await ctx.db.patch(roleId, updates);
  },
});

// Delete a role
export const deleteRole = mutation({
  args: { roleId: v.id("roles") },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    
    // Safety checks
    const role = await ctx.db.get(args.roleId);
    if (!role) throw new Error("Role not found");
    if (role.name === "Director") throw new Error("Cannot delete Director role");

    const usersWithRole = await ctx.db.query("appUsers").collect();
    if (usersWithRole.some((u) => u.roleId.toString() === args.roleId.toString())) {
      throw new Error("Cannot delete role while personnel are assigned to it");
    }

    await ctx.db.delete(args.roleId);
  },
});

// Get member count per role
export const getRoleMemberCounts = query({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db.query("roles").collect();
    const users = await ctx.db.query("appUsers").collect();
    return roles.map((role) => ({
      ...role,
      memberCount: users.filter(
        (u) => u.roleId.toString() === role._id.toString()
      ).length,
    }));
  },
});

// Seed default roles if none exist
export const seedDefaultRoles = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("roles").collect();
    if (existing.length > 0) return;
    const defaultRoles = [
      { name: "Director", permissions: ["all"] },
      {
        name: "Supervisor",
        permissions: ["close_issue", "assign_sub_issue", "create_issue"],
      },
      {
        name: "Field Officer",
        permissions: ["create_issue", "upload_media"],
      },
      {
        name: "Clerical",
        permissions: ["create_issue", "upload_media", "csv_upload"],
      },
    ];
    for (const role of defaultRoles) {
      await ctx.db.insert("roles", { ...role, createdAt: Date.now() });
    }
  },
});
