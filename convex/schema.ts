import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Roles (Director, Supervisor, Field Officer, Clerical, etc.)
  roles: defineTable({
    name: v.string(),
    permissions: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  // App users (linked to Convex Auth)
  appUsers: defineTable({
    name: v.string(),
    email: v.string(),
    roleId: v.id("roles"),
    authUserId: v.string(), // authTables users._id as string
    isActive: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_roleId", ["roleId"]),

  // Residents database
  residents: defineTable({
    systemId: v.optional(v.string()),
    consecNo: v.optional(v.string()),
    name: v.string(),
    building: v.optional(v.string()),
    apt: v.optional(v.string()),
    address: v.string(),
    pollingDivision: v.optional(v.string()),
    parliamentaryDistrict: v.optional(v.string()),
    municipalDistrict: v.optional(v.string()),
    registrationArea: v.optional(v.string()),
    corporation: v.optional(v.string()),
    securityCode: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_systemId", ["systemId"])
    .index("by_name", ["name"])
    .index("by_corporation", ["corporation"])
    .index("by_parliamentaryDistrict", ["parliamentaryDistrict", "name"])
    .index("by_municipalDistrict", ["municipalDistrict", "name"])
    .index("by_pollingDivision", ["pollingDivision", "name"])
    .searchIndex("search_name", { searchField: "name" })
    .searchIndex("search_address", { searchField: "address" }),

  // Cached geographic filter options (populated on import)
  geographicFilters: defineTable({
    type: v.union(
      v.literal("parliamentaryDistrict"),
      v.literal("municipalDistrict"),
      v.literal("pollingDivision"),
      v.literal("corporation"),
      v.literal("registrationArea")
    ),
    value: v.string(),
  }).index("by_type_value", ["type", "value"]),

  // Cached system statistics (refreshed via cron/background task)
  appStats: defineTable({
    type: v.string(), // e.g. "resident_summary"
    residentCount: v.number(),
    homeCount: v.number(),
    streetCount: v.number(),
    lastUpdated: v.number(),
  }).index("by_type", ["type"]),

  // Cached table for resident counts by street
  streetStats: defineTable({
    municipalDistrict: v.string(),
    pollingDivision: v.string(),
    street: v.string(),
    residentCount: v.number(),
  }),

  // Issues
  issues: defineTable({
    residentId: v.id("residents"),
    title: v.string(),
    description: v.string(),
    category: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("closed")
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    createdBy: v.id("appUsers"),
    assignedTo: v.optional(v.id("appUsers")),
    closedAt: v.optional(v.number()),
    closedBy: v.optional(v.id("appUsers")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_residentId", ["residentId"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"])
    .index("by_assignedTo", ["assignedTo"]),

  // Sub-issues (can only be assigned/closed by supervisor+)
  subIssues: defineTable({
    issueId: v.id("issues"),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
    assignedTo: v.optional(v.id("appUsers")),
    assignedBy: v.optional(v.id("appUsers")),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_issueId", ["issueId"]),

  // Chronology of actions on issues/sub-issues
  issueActions: defineTable({
    issueId: v.id("issues"),
    subIssueId: v.optional(v.id("subIssues")),
    actionType: v.string(), // "created"|"assigned"|"media_uploaded"|"comment"|"status_changed"|"closed"|"sub_issue_added"
    description: v.string(),
    performedBy: v.id("appUsers"),
    createdAt: v.number(),
  }).index("by_issueId_createdAt", ["issueId", "createdAt"]),

  // Media attached to address, issue, or sub-issue
  media: defineTable({
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
    actionId: v.optional(v.id("issueActions")),
    uploadedBy: v.id("appUsers"),
    caption: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_issueId", ["issueId"])
    .index("by_residentId", ["residentId"])
    .index("by_subIssueId", ["subIssueId"]),
});
