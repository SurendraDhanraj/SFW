import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Bootstrap: create the first Director user bypassing auth check
export const bootstrapDirector = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    roleId: v.id("roles"),
    authUserId: v.string(),
  },
  handler: async (ctx, args) => {
    // Avoid duplicates
    const existing = await ctx.db
      .query("appUsers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", args.authUserId))
      .first();
  },
});

export const trimGeographicData = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    let q = ctx.db.query("residents");
    const { page, continueCursor, isDone } = await q.paginate({ cursor: args.cursor, numItems: 3000 });
    
    let patched = 0;
    for (const r of page) {
      let needsPatch = false;
      const patch: any = {};
      
      if (r.parliamentaryDistrict && r.parliamentaryDistrict !== r.parliamentaryDistrict.trim()) {
        patch.parliamentaryDistrict = r.parliamentaryDistrict.trim();
        needsPatch = true;
      }
      if (r.municipalDistrict && r.municipalDistrict !== r.municipalDistrict.trim()) {
        patch.municipalDistrict = r.municipalDistrict.trim();
        needsPatch = true;
      }
      if (r.pollingDivision && r.pollingDivision !== r.pollingDivision.trim()) {
        patch.pollingDivision = r.pollingDivision.trim();
        needsPatch = true;
      }
      
      if (needsPatch) {
        await ctx.db.patch(r._id, patch);
        patched++;
      }
    }
    
    return { nextCursor: isDone ? null : continueCursor, patched };
  }
});
