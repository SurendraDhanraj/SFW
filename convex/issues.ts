import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth";

// List issues with optional filters
export const listIssues = query({
  args: {
    status: v.optional(v.string()),
    residentId: v.optional(v.id("residents")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    let issues;
    if (args.residentId) {
      issues = await ctx.db
        .query("issues")
        .withIndex("by_residentId", (q) => q.eq("residentId", args.residentId!))
        .order("desc")
        .take(limit);
    } else if (args.status) {
      issues = await ctx.db
        .query("issues")
        .withIndex("by_status", (q) => q.eq("status", args.status as "open" | "in_progress" | "closed"))
        .order("desc")
        .take(limit);
    } else {
      issues = await ctx.db.query("issues").order("desc").take(limit);
    }
    return Promise.all(
      issues.map(async (issue) => {
        const resident = await ctx.db.get(issue.residentId);
        const creator = await ctx.db.get(issue.createdBy);
        const assignee = issue.assignedTo ? await ctx.db.get(issue.assignedTo) : null;
        return { ...issue, resident, creator, assignee };
      })
    );
  },
});

// Get issue counts for dashboard
export const getIssueCounts = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("issues").collect();
    return {
      total: all.length,
      open: all.filter((i) => i.status === "open").length,
      inProgress: all.filter((i) => i.status === "in_progress").length,
      closed: all.filter((i) => i.status === "closed").length,
      critical: all.filter(
        (i) => i.priority === "critical" && i.status !== "closed"
      ).length,
    };
  },
});

// Get issue counts tabulated by municipal electoral district
export const getIssueStatsByDistrict = query({
  args: {},
  handler: async (ctx) => {
    const issues = await ctx.db.query("issues").collect();
    const districtStats: Record<string, { md: string, open: number, inProgress: number, closed: number, total: number }> = {};
    
    for (const issue of issues) {
      const resident = await ctx.db.get(issue.residentId);
      const district = resident?.municipalDistrict?.trim() || 'Unknown District';
      
      if (!districtStats[district]) {
        districtStats[district] = { md: district, open: 0, inProgress: 0, closed: 0, total: 0 };
      }
      
      districtStats[district].total++;
      if (issue.status === 'open') districtStats[district].open++;
      else if (issue.status === 'in_progress') districtStats[district].inProgress++;
      else if (issue.status === 'closed') districtStats[district].closed++;
    }
    
    return Object.values(districtStats).sort((a, b) => a.md.localeCompare(b.md));
  }
});

// Get a single issue with all details
export const getIssue = query({
  args: { id: v.id("issues") },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get(args.id);
    if (!issue) return null;
    const resident = await ctx.db.get(issue.residentId);
    const creator = await ctx.db.get(issue.createdBy);
    const assignee = issue.assignedTo ? await ctx.db.get(issue.assignedTo) : null;
    const closer = issue.closedBy ? await ctx.db.get(issue.closedBy) : null;
    return { ...issue, resident, creator, assignee, closer };
  },
});

// Create a new issue
export const createIssue = mutation({
  args: {
    residentId: v.id("residents"),
    title: v.string(),
    description: v.string(),
    category: v.optional(v.string()),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const appUser = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authId))
      .first();
    if (!appUser) throw new Error("App user not found");
    const now = Date.now();
    const issueId = await ctx.db.insert("issues", {
      ...args,
      status: "open",
      createdBy: appUser._id,
      createdAt: now,
      updatedAt: now,
    });
    // Log chronology entry
    await ctx.db.insert("issueActions", {
      issueId,
      actionType: "created",
      description: `Issue created by ${appUser.name}`,
      performedBy: appUser._id,
      createdAt: now,
    });
    return issueId;
  },
});

// Assign an issue to a user
export const assignIssue = mutation({
  args: {
    issueId: v.id("issues"),
    assignedTo: v.id("appUsers"),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const appUser = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authId))
      .first();
    if (!appUser) throw new Error("App user not found");
    const now = Date.now();
    await ctx.db.patch(args.issueId, {
      assignedTo: args.assignedTo,
      status: "in_progress",
      updatedAt: now,
    });
    const assignee = await ctx.db.get(args.assignedTo);
    await ctx.db.insert("issueActions", {
      issueId: args.issueId,
      actionType: "assigned",
      description: `Issue assigned to ${assignee?.name ?? "Unknown"}`,
      performedBy: appUser._id,
      createdAt: now,
    });
  },
});

// Close an issue (supervisor/director only - enforced on frontend via role check)
export const closeIssue = mutation({
  args: {
    issueId: v.id("issues"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const appUser = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authId))
      .first();
    if (!appUser) throw new Error("App user not found");
    
    // Enforce that all sub-issues must be completed
    const openSubIssues = await ctx.db
      .query("subIssues")
      .withIndex("by_issueId", q => q.eq("issueId", args.issueId))
      .filter(q => q.neq(q.field("status"), "completed"))
      .collect();
      
    if (openSubIssues.length > 0) {
      throw new Error("Cannot close issue. All sub-tasks must be marked as completed first.");
    }

    const now = Date.now();
    await ctx.db.patch(args.issueId, {
      status: "closed",
      closedAt: now,
      closedBy: appUser._id,
      updatedAt: now,
    });
    await ctx.db.insert("issueActions", {
      issueId: args.issueId,
      actionType: "closed",
      description: args.note ?? `Issue closed by ${appUser.name}`,
      performedBy: appUser._id,
      createdAt: now,
    });
  },
});

// Add a comment/action to the chronology
export const addIssueAction = mutation({
  args: {
    issueId: v.id("issues"),
    actionType: v.string(),
    description: v.string(),
    subIssueId: v.optional(v.id("subIssues")),
    addedMedia: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      mimeType: v.string(),
    })))
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const appUser = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authId))
      .first();
    if (!appUser) throw new Error("App user not found");
    
    const actionId = await ctx.db.insert("issueActions", {
      issueId: args.issueId,
      subIssueId: args.subIssueId,
      actionType: args.actionType,
      description: args.description,
      performedBy: appUser._id,
      createdAt: Date.now(),
    });

    if (args.addedMedia && args.addedMedia.length > 0) {
      for (const m of args.addedMedia) {
        await ctx.db.insert("media", {
          storageId: m.storageId,
          mimeType: m.mimeType,
          linkedTo: "issue",
          issueId: args.issueId,
          ...(args.subIssueId ? { subIssueId: args.subIssueId } : {}),
          actionId: actionId,
          uploadedBy: appUser._id,
          createdAt: Date.now(),
        });
      }
    }

    const issue = await ctx.db.get(args.issueId);
    if (issue && issue.status === "open") {
      await ctx.db.patch(args.issueId, {
        status: "in_progress",
        updatedAt: Date.now(),
      });
      await ctx.db.insert("issueActions", {
        issueId: args.issueId,
        actionType: "status_changed",
        description: `Issue automatically moved to In Progress by new update`,
        performedBy: appUser._id,
        createdAt: Date.now() + 1,
      });
    }

    return actionId;
  },
});

// Get issue chronology
export const getIssueChronology = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const actions = await ctx.db
      .query("issueActions")
      .withIndex("by_issueId_createdAt", (q) =>
        q.eq("issueId", args.issueId)
      )
      .order("desc")
      .collect();
      
    // Prefetch all media for this issue to avoid N+1 queries
    const allIssueMedia = await ctx.db.query("media")
      .withIndex("by_issueId", q => q.eq("issueId", args.issueId))
      .collect();

    return Promise.all(
      actions.map(async (a) => {
        const performer = await ctx.db.get(a.performedBy);
        const actionMedia = allIssueMedia.filter(m => m.actionId === a._id);
        const mediaWithUrls = await Promise.all(actionMedia.map(async m => ({
          ...m,
          url: await ctx.storage.getUrl(m.storageId)
        })));
        return { ...a, performer, media: mediaWithUrls.length > 0 ? mediaWithUrls : undefined };
      })
    );
  },
});

// List sub-issues for an issue
export const listSubIssues = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const subs = await ctx.db
      .query("subIssues")
      .withIndex("by_issueId", (q) => q.eq("issueId", args.issueId))
      .collect();
    return Promise.all(
      subs.map(async (s) => {
        const assignee = s.assignedTo ? await ctx.db.get(s.assignedTo) : null;
        return { ...s, assignee };
      })
    );
  },
});

// Create sub-issue (supervisor only - checked on frontend)
export const createSubIssue = mutation({
  args: {
    issueId: v.id("issues"),
    title: v.string(),
    description: v.optional(v.string()),
    assignedTo: v.optional(v.id("appUsers")),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const appUser = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authId))
      .first();
    if (!appUser) throw new Error("App user not found");
    const now = Date.now();
    const subIssueId = await ctx.db.insert("subIssues", {
      issueId: args.issueId,
      title: args.title,
      description: args.description,
      status: "open",
      assignedTo: args.assignedTo,
      assignedBy: appUser._id,
      createdAt: now,
    });
    const assignee = args.assignedTo ? await ctx.db.get(args.assignedTo) : null;
    await ctx.db.insert("issueActions", {
      issueId: args.issueId,
      subIssueId,
      actionType: "sub_issue_added",
      description: `Sub-issue "${args.title}" added${assignee ? ` — assigned to ${assignee.name}` : ""}`,
      performedBy: appUser._id,
      createdAt: now,
    });
    return subIssueId;
  },
});

// Close a sub-issue
export const closeSubIssue = mutation({
  args: { subIssueId: v.id("subIssues") },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const appUser = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authId))
      .first();
    if (!appUser) throw new Error("App user not found");
    const now = Date.now();
    const sub = await ctx.db.get(args.subIssueId);
    if (!sub) throw new Error("Sub-issue not found");
    await ctx.db.patch(args.subIssueId, { status: "completed", completedAt: now });
    await ctx.db.insert("issueActions", {
      issueId: sub.issueId,
      subIssueId: args.subIssueId,
      actionType: "status_changed",
      description: `Sub-issue "${sub.title}" marked as completed by ${appUser.name}`,
      performedBy: appUser._id,
      createdAt: now,
    });
  },
});

// Start a sub-issue (mark in progress)
export const startSubIssue = mutation({
  args: { subIssueId: v.id("subIssues") },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const appUser = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authId))
      .first();
    if (!appUser) throw new Error("App user not found");
    const now = Date.now();
    const sub = await ctx.db.get(args.subIssueId);
    if (!sub) throw new Error("Sub-issue not found");
    await ctx.db.patch(args.subIssueId, { status: "in_progress" });
    await ctx.db.insert("issueActions", {
      issueId: sub.issueId,
      subIssueId: args.subIssueId,
      actionType: "status_changed",
      description: `Sub-issue "${sub.title}" marked as in progress by ${appUser.name}`,
      performedBy: appUser._id,
      createdAt: now,
    });
  },
});

// Bulk delete issues (Director only)
export const deleteIssues = mutation({
  args: { ids: v.array(v.id("issues")) },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const appUser = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authId))
      .first();
    if (!appUser) throw new Error("App user not found");
    const role = await ctx.db.get(appUser.roleId);
    if (role?.name !== "Director" && role?.name !== "Supervisor") throw new Error("Unauthorized. Only Directors and Supervisors can delete issues.");

    for (const id of args.ids) {
      // Cascading deletes for related artifacts
      const subIssues = await ctx.db.query("subIssues").withIndex("by_issueId", q => q.eq("issueId", id)).collect();
      for (const sub of subIssues) await ctx.db.delete(sub._id);
      
      const actions = await ctx.db.query("issueActions").withIndex("by_issueId_createdAt", q => q.eq("issueId", id)).collect();
      for (const act of actions) await ctx.db.delete(act._id);

      const medias = await ctx.db.query("media").withIndex("by_issueId", q => q.eq("issueId", id)).collect();
      for (const m of medias) {
        await ctx.storage.delete(m.storageId);
        await ctx.db.delete(m._id);
      }

      // Delete issue itself
      await ctx.db.delete(id);
    }
  }
});

// Delete all issues in database (Director only)
export const deleteAllIssues = mutation({
  args: {},
  handler: async (ctx) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const appUser = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authId))
      .first();
    if (!appUser) throw new Error("App user not found");
    const role = await ctx.db.get(appUser.roleId);
    if (role?.name !== "Director" && role?.name !== "Supervisor") throw new Error("Unauthorized. Only Directors and Supervisors can delete issues.");

    // Delete batch
    const all = await ctx.db.query("issues").take(100);
    for (const r of all) {
      const subIssues = await ctx.db.query("subIssues").withIndex("by_issueId", q => q.eq("issueId", r._id)).collect();
      for (const sub of subIssues) await ctx.db.delete(sub._id);
      
      const actions = await ctx.db.query("issueActions").withIndex("by_issueId_createdAt", q => q.eq("issueId", r._id)).collect();
      for (const act of actions) await ctx.db.delete(act._id);

      const medias = await ctx.db.query("media").withIndex("by_issueId", q => q.eq("issueId", r._id)).collect();
      for (const m of medias) {
        await ctx.storage.delete(m.storageId);
        await ctx.db.delete(m._id);
      }

      await ctx.db.delete(r._id);
    }
    
    return all.length === 100;
  }
});
