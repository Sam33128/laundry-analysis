import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createSession = mutation({
  args: {
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
    const identity = await ctx.auth.getUserIdentity();
    
    // HARD BLOCK: Stop the creation if Clerk hasn't verified the user
    if (!identity) {
      throw new Error("Authentication required to create a session.");
    }

    // Use the strict, unique Clerk User ID
    const userId = identity.subject;

    return await ctx.db.insert("sessions", {
      userId,
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
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    
    // Return an empty state safely if the auth token is still loading
    if (!identity) {
      return []; 
    }
    
    const userId = identity.subject;

    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
}); 