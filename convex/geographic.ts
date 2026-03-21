import { query, internalMutation } from "./_generated/server";

export const getFilters = query({
  args: {},
  handler: async (ctx) => {
    const filters = await ctx.db.query("geographicFilters").collect();
    
    const parlDistricts = Array.from(new Set(filters.filter(f => f.type === "parliamentaryDistrict").map(f => f.value))).sort();
    const munDistricts = Array.from(new Set(filters.filter(f => f.type === "municipalDistrict").map(f => f.value))).sort();
    const pollDivisions = Array.from(new Set(filters.filter(f => f.type === "pollingDivision").map(f => f.value))).sort();
    const corps = Array.from(new Set(filters.filter(f => f.type === "corporation").map(f => f.value))).sort();
    const regAreas = Array.from(new Set(filters.filter(f => f.type === "registrationArea").map(f => f.value))).sort();

    return {
      parliamentaryDistricts: parlDistricts,
      municipalDistricts: munDistricts,
      pollingDivisions: pollDivisions,
      corporations: corps,
      registrationAreas: regAreas,
    };
  },
});

export const backfillFilters = internalMutation({
  args: {},
  handler: async (ctx) => {
    const residents = await ctx.db.query("residents").collect();
    
    const pds = new Set<string>();
    const mds = new Set<string>();
    const polls = new Set<string>();
    const corps = new Set<string>();
    const regAreas = new Set<string>();
    
    for (const r of residents) {
      if (r.parliamentaryDistrict) pds.add(r.parliamentaryDistrict.trim());
      if (r.municipalDistrict) mds.add(r.municipalDistrict.trim());
      if (r.pollingDivision) polls.add(r.pollingDivision.trim());
      if (r.corporation) corps.add(r.corporation.trim());
      if (r.registrationArea) regAreas.add(r.registrationArea.trim());
    }

    // Clear existing
    const existing = await ctx.db.query("geographicFilters").collect();
    for (const e of existing) {
      await ctx.db.delete(e._id);
    }

    // Insert new
    for (const val of pds) {
      await ctx.db.insert("geographicFilters", { type: "parliamentaryDistrict", value: val });
    }
    for (const val of mds) {
      await ctx.db.insert("geographicFilters", { type: "municipalDistrict", value: val });
    }
    for (const val of polls) {
      await ctx.db.insert("geographicFilters", { type: "pollingDivision", value: val });
    }
    for (const val of corps) {
      await ctx.db.insert("geographicFilters", { type: "corporation", value: val });
    }
    for (const val of regAreas) {
      await ctx.db.insert("geographicFilters", { type: "registrationArea", value: val });
    }
    
    return "Done";
  }
});
