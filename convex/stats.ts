import { query, internalMutation, action, internalQuery } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("appStats")
      .withIndex("by_type", (q) => q.eq("type", "resident_summary"))
      .first();
  },
});

export const triggerStatsUpdate = action({
  args: {},
  handler: async (ctx) => {
    let cursor: string | undefined = undefined;
    let isDone = false;
    
    let residentCount = 0;
    const uniqueHomes = new Set<string>();
    const uniqueStreets = new Set<string>();

    const streetCounts = new Map<string, { md: string, pd: string, street: string, count: number }>();

    while (!isDone) {
      const page: any = await ctx.runQuery(internal.stats.getResidentsPage, { cursor });
      for (const r of page.residents) {
        residentCount++;
        const street = r.address ? r.address.trim().toUpperCase() : "UNKNOWN";
        const bldg = r.building ? r.building.trim().toUpperCase() : "";
        const apt = r.apt ? r.apt.trim().toUpperCase() : "";
        const md = r.municipalDistrict ? r.municipalDistrict.trim() : "UNKNOWN";
        const pd = r.pollingDivision ? r.pollingDivision.trim() : "UNKNOWN";
        
        uniqueStreets.add(street);
        uniqueHomes.add(`${street}|${bldg}|${apt}`);

        const key = `${md}|${pd}|${street}`;
        if (!streetCounts.has(key)) {
          streetCounts.set(key, { md, pd, street, count: 0 });
        }
        streetCounts.get(key)!.count++;
      }
      cursor = page.nextCursor;
      isDone = page.isDone;
    }

    await ctx.runMutation(internal.stats.saveStats, {
      residentCount,
      homeCount: uniqueHomes.size,
      streetCount: uniqueStreets.size,
    });

    await ctx.runMutation(internal.stats.clearStreetStats);
    
    const streetsArr = Array.from(streetCounts.values());
    for (let i = 0; i < streetsArr.length; i += 500) {
      await ctx.runMutation(internal.stats.saveStreetStatsBatch, {
        batch: streetsArr.slice(i, i + 500)
      });
    }

    return "Stats Updated";
  },
});

export const getResidentsPage = internalQuery({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const res = await ctx.db.query("residents").paginate({ cursor: args.cursor ?? null, numItems: 5000 });
    return {
      residents: res.page.map(r => ({
        address: r.address,
        building: r.building,
        apt: r.apt,
        municipalDistrict: r.municipalDistrict,
        pollingDivision: r.pollingDivision
      })),
      nextCursor: res.continueCursor,
      isDone: res.isDone
    };
  }
});

export const saveStats = internalMutation({
  args: {
    residentCount: v.number(),
    homeCount: v.number(),
    streetCount: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appStats")
      .withIndex("by_type", q => q.eq("type", "resident_summary"))
      .first();
      
    if (existing) {
      await ctx.db.patch(existing._id, {
        residentCount: args.residentCount,
        homeCount: args.homeCount,
        streetCount: args.streetCount,
        lastUpdated: Date.now()
      });
    } else {
      await ctx.db.insert("appStats", {
        type: "resident_summary",
        residentCount: args.residentCount,
        homeCount: args.homeCount,
        streetCount: args.streetCount,
        lastUpdated: Date.now()
      });
    }
  }
});

export const clearStreetStats = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("streetStats").take(4096);
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
  }
});

export const saveStreetStatsBatch = internalMutation({
  args: {
    batch: v.array(v.object({
      md: v.string(),
      pd: v.string(),
      street: v.string(),
      count: v.number(),
    }))
  },
  handler: async (ctx, args) => {
    for (const row of args.batch) {
      await ctx.db.insert("streetStats", {
        municipalDistrict: row.md,
        pollingDivision: row.pd,
        street: row.street,
        residentCount: row.count
      });
    }
  }
});

export const getStreetSummary = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("streetStats").collect();
    // Sort logically by MD -> PD -> Street
    return stats.sort((a, b) => {
      if (a.municipalDistrict !== b.municipalDistrict) return a.municipalDistrict.localeCompare(b.municipalDistrict);
      if (a.pollingDivision !== b.pollingDivision) return a.pollingDivision.localeCompare(b.pollingDivision);
      return a.street.localeCompare(b.street);
    });
  }
});
