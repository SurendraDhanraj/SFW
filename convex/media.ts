import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth";

// Generate a URL to upload media to Convex storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    return ctx.storage.generateUploadUrl();
  },
});

// Save media metadata after upload
export const saveMedia = mutation({
  args: {
    storageId: v.id("_storage"),
    mimeType: v.string(),
    linkedTo: v.union(
      v.literal("address"),
      v.literal("issue"),
      v.literal("sub_issue")
    ),
    residentId: v.optional(v.id("residents")),
    issueId: v.optional(v.id("issues")),
    subIssueId: v.optional(v.id("subIssues")),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const appUser = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authId))
      .first();
    if (!appUser) throw new Error("App user not found");
    const mediaId = await ctx.db.insert("media", {
      ...args,
      uploadedBy: appUser._id,
      createdAt: Date.now(),
    });
    // Log to issue chronology if linked to issue
    if (args.issueId) {
      await ctx.db.insert("issueActions", {
        issueId: args.issueId,
        actionType: "media_uploaded",
        description: `Media uploaded by ${appUser.name}${args.caption ? `: ${args.caption}` : ""}`,
        performedBy: appUser._id,
        createdAt: Date.now(),
      });
    }
    return mediaId;
  },
});

// Get media files for an issue
export const getMediaForIssue = query({
  args: { issueId: v.id("issues") },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("media")
      .withIndex("by_issueId", (q) => q.eq("issueId", args.issueId))
      .collect();
    return Promise.all(
      files.map(async (f) => ({
        ...f,
        url: await ctx.storage.getUrl(f.storageId),
      }))
    );
  },
});

// Get media files for a resident (address photos)
export const getMediaForResident = query({
  args: { residentId: v.id("residents") },
  handler: async (ctx, args) => {
    const files = await ctx.db
      .query("media")
      .withIndex("by_residentId", (q) => q.eq("residentId", args.residentId))
      .collect();
    return Promise.all(
      files.map(async (f) => ({
        ...f,
        url: await ctx.storage.getUrl(f.storageId),
      }))
    );
  },
});
