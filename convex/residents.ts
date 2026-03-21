import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "./auth";

// Search residents by name or address
export const searchResidents = query({
  args: { 
    query: v.string(), 
    limit: v.optional(v.number()),
    parliamentaryDistrict: v.optional(v.string()),
    municipalDistrict: v.optional(v.string()),
    pollingDivision: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;

    const pd = args.parliamentaryDistrict?.trim();
    const md = args.municipalDistrict?.trim();
    const pool = args.pollingDivision?.trim();

    let results = [];
    if (!args.query.trim()) {
      let q;
      if (pool) {
        q = ctx.db.query("residents").withIndex("by_pollingDivision", q => q.eq("pollingDivision", pool)).order("asc");
        if (md) q = q.filter(q => q.eq(q.field("municipalDistrict"), md));
        if (pd) q = q.filter(q => q.eq(q.field("parliamentaryDistrict"), pd));
      } else if (md) {
        q = ctx.db.query("residents").withIndex("by_municipalDistrict", q => q.eq("municipalDistrict", md)).order("asc");
        if (pd) q = q.filter(q => q.eq(q.field("parliamentaryDistrict"), pd));
      } else if (pd) {
        q = ctx.db.query("residents").withIndex("by_parliamentaryDistrict", q => q.eq("parliamentaryDistrict", pd)).order("asc");
      } else {
        q = ctx.db.query("residents").withIndex("by_name").order("asc");
      }
      
      results = await q.take(limit);
    } else {
      let byName = await ctx.db
        .query("residents")
        .withSearchIndex("search_name", (q) => q.search("name", args.query))
        .take(100);
        
      if (pd) byName = byName.filter(r => r.parliamentaryDistrict === pd);
      if (md) byName = byName.filter(r => r.municipalDistrict === md);
      if (pool) byName = byName.filter(r => r.pollingDivision === pool);

      if (byName.length > 0) {
        results = byName.slice(0, limit);
      } else {
        let byAddress = await ctx.db
          .query("residents")
          .withSearchIndex("search_address", (q) =>
            q.search("address", args.query)
          )
          .take(100);
          
        if (pd) byAddress = byAddress.filter(r => r.parliamentaryDistrict === pd);
        if (md) byAddress = byAddress.filter(r => r.municipalDistrict === md);
        if (pool) byAddress = byAddress.filter(r => r.pollingDivision === pool);
        
        results = byAddress.slice(0, limit);
      }
    }
    
    // Sort the matched chunk alphabetically
    return results.sort((a, b) => a.name.localeCompare(b.name));
  },
});

// Get a single resident
export const getResident = query({
  args: { id: v.id("residents") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

// List residents with optional filters
export const listResidents = query({
  args: {
    corporation: v.optional(v.string()),
    parliamentaryDistrict: v.optional(v.string()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    let q = ctx.db.query("residents").order("asc");
    const page = await q.take(limit);
    return page;
  },
});

// List residents grouped by address
export const listByAddress = query({
  args: { 
    limit: v.optional(v.number()),
    parliamentaryDistrict: v.optional(v.string()),
    municipalDistrict: v.optional(v.string()),
    pollingDivision: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 2000;

    const pd = args.parliamentaryDistrict?.trim();
    const md = args.municipalDistrict?.trim();
    const pool = args.pollingDivision?.trim();
    
    let q;
    if (pool) {
      q = ctx.db.query("residents").withIndex("by_pollingDivision", q => q.eq("pollingDivision", pool)).order("desc");
      if (md) q = q.filter(q => q.eq(q.field("municipalDistrict"), md));
      if (pd) q = q.filter(q => q.eq(q.field("parliamentaryDistrict"), pd));
    } else if (md) {
      q = ctx.db.query("residents").withIndex("by_municipalDistrict", q => q.eq("municipalDistrict", md)).order("desc");
      if (pd) q = q.filter(q => q.eq(q.field("parliamentaryDistrict"), pd));
    } else if (pd) {
      q = ctx.db.query("residents").withIndex("by_parliamentaryDistrict", q => q.eq("parliamentaryDistrict", pd)).order("desc");
    } else {
      q = ctx.db.query("residents").order("desc");
    }

    const allResidents = await q.take(limit);

    const groups: Record<string, { residents: any[], street: string, fullAddress: string }> = {};
    for (const r of allResidents) {
      const bldg = r.building ? `Bldg ${r.building}` : "";
      const apt = r.apt ? `Apt ${r.apt}` : "";
      const street = r.address ? r.address.trim() : "";
      
      const parts = [bldg, apt, street].filter(Boolean);
      const fullAddress = parts.length > 0 ? parts.join(", ") : "Unknown Address";
      
      if (!groups[fullAddress]) {
        groups[fullAddress] = { residents: [], street, fullAddress };
      }
      groups[fullAddress].residents.push(r);
    }

    return Object.values(groups)
      .map((group) => ({
        address: group.fullAddress,
        residents: group.residents.sort((a, b) => a.name.localeCompare(b.name)),
        street: group.street
      }))
      .sort((a, b) => {
        const strCmp = a.street.localeCompare(b.street);
        if (strCmp !== 0) return strCmp;
        return a.address.localeCompare(b.address);
      });
  }
});

// Get total count of residents
export const getResidentCount = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("residents").collect();
    return all.length;
  },
});

// Create a new resident
export const createResident = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const now = Date.now();
    return ctx.db.insert("residents", { ...args, createdAt: now, updatedAt: now });
  },
});

// Update a resident
export const updateResident = mutation({
  args: {
    id: v.id("residents"),
    name: v.optional(v.string()),
    building: v.optional(v.string()),
    apt: v.optional(v.string()),
    address: v.optional(v.string()),
    pollingDivision: v.optional(v.string()),
    parliamentaryDistrict: v.optional(v.string()),
    municipalDistrict: v.optional(v.string()),
    registrationArea: v.optional(v.string()),
    corporation: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });
  },
});

// Batch import residents from CSV
export const batchImportResidents = mutation({
  args: {
    residents: v.array(
      v.object({
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
      })
    ),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const now = Date.now();
    let inserted = 0;
    let skipped = 0;

    const seenFilters = new Set<string>();
    const addFilter = async (type: "parliamentaryDistrict" | "municipalDistrict" | "pollingDivision" | "corporation" | "registrationArea", value: string) => {
      if (!value) return;
      const val = value.trim();
      const key = `${type}:${val}`;
      if (seenFilters.has(key)) return;
      seenFilters.add(key);
      
      const exists = await ctx.db
        .query("geographicFilters")
        .withIndex("by_type_value", q => q.eq("type", type).eq("value", val))
        .first();
      if (!exists) {
        await ctx.db.insert("geographicFilters", { type, value: val });
      }
    };

    for (const r of args.residents) {
      let existing = null;
      if (r.systemId) {
        existing = await ctx.db
          .query("residents")
          .withIndex("by_systemId", (q) => q.eq("systemId", r.systemId))
          .first();
      }
      if (existing) {
        skipped++;
        continue;
      }
      await ctx.db.insert("residents", { ...r, createdAt: now, updatedAt: now });
      inserted++;

      if (r.parliamentaryDistrict) await addFilter("parliamentaryDistrict", r.parliamentaryDistrict);
      if (r.municipalDistrict) await addFilter("municipalDistrict", r.municipalDistrict);
      if (r.pollingDivision) await addFilter("pollingDivision", r.pollingDivision);
      if (r.corporation) await addFilter("corporation", r.corporation);
      if (r.registrationArea) await addFilter("registrationArea", r.registrationArea);
    }
    return { inserted, skipped };
  },
});

export const deleteResidents = mutation({
  args: { ids: v.array(v.id("residents")) },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const user = await ctx.db.query("appUsers").withIndex("by_authUserId", q => q.eq("authUserId", authId)).first();
    if (!user) throw new Error("User not found");
    const role = await ctx.db.get(user.roleId);
    if (role?.name !== "Director" && role?.name !== "Supervisor") throw new Error("Unauthorized. Only Directors and Supervisors can delete residents.");

    for (const id of args.ids) {
      await ctx.db.delete(id);
    }
  }
});

export const deleteAllResidents = mutation({
  args: {},
  handler: async (ctx) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    const user = await ctx.db.query("appUsers").withIndex("by_authUserId", q => q.eq("authUserId", authId)).first();
    if (!user) throw new Error("User not found");
    const role = await ctx.db.get(user.roleId);
    if (role?.name !== "Director" && role?.name !== "Supervisor") throw new Error("Unauthorized. Only Directors and Supervisors can delete residents.");

    // Delete in batches to avoid overwhelming the transaction
    const all = await ctx.db.query("residents").take(2000);
    for (const r of all) {
      await ctx.db.delete(r._id);
    }
    
    // Also clear geographic filters when clearing all residents
    if (all.length > 0) {
      const filters = await ctx.db.query("geographicFilters").take(500);
      for (const f of filters) {
        await ctx.db.delete(f._id);
      }
    }
    
    return all.length === 2000;
  }
});

// Tag a GIS location on a resident address
export const tagResidentLocation = mutation({
  args: {
    id: v.id("residents"),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthUserId(ctx);
    if (!authId) throw new Error("Unauthenticated");
    await ctx.db.patch(args.id, {
      lat: args.lat,
      lng: args.lng,
      updatedAt: Date.now(),
    });
  },
});
