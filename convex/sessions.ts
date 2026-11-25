import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createSession = mutation({
  args: {
    userId: v.string(), // Explicitly pass Clerk ID from frontend
    imageUrl: v.string(),
    estimatedMinutes: v.number(),
    garments: v.array(
      v.object({
        type: v.string(),
        fabric: v.string(),
        color: v.optional(v.string()),
      })
    ),
    weatherContext: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      throw new Error("Authentication required to create a session.");
    }

    return await ctx.db.insert("sessions", {
      userId: args.userId,
      imageUrl: args.imageUrl,
      estimatedMinutes: args.estimatedMinutes,
      garments: args.garments,
      weatherContext: args.weatherContext,
      startTime: Date.now(),
      status: "active",
    });
  },
});

export const getHistory = query({
  args: {
    userId: v.optional(v.string()), // Accept userId from frontend query
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return []; 
    }

    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
}); 