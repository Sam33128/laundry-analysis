import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Your existing table for handling image uploads and analysis
  garments: defineTable({
    imageId: v.id("_storage"),
    imageUrl: v.string(),
    uploadedAt: v.number(),
    analyzed: v.boolean(),
    
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),

    dryingTime: v.optional(v.number()),
    totalGarments: v.optional(v.number()),

    garmentsList: v.optional(
      v.array(
        v.object({
          type: v.string(),
          fabric: v.string(),
          color: v.optional(v.string()), // ✅ Kept your color validator
        })
      )
    ),
  }),

  // NEW: Sessions table to track the active timers and populate the History tab
  sessions: defineTable({
    userId: v.optional(v.string()), // Made optional temporarily in case auth isn't fully wired yet
    imageUrl: v.string(),
    estimatedMinutes: v.number(),
    
    garments: v.array(
      v.object({
        type: v.string(),
        fabric: v.string(),
        color: v.optional(v.string()),
      })
    ),
    
    weatherContext: v.optional(v.any()), // Stores the temperature, humidity, etc.
    startTime: v.number(),               // Unix timestamp of when they clicked "Start Session"
    status: v.string(),                  // "active", "completed", or "cancelled"
  }).index("by_user", ["userId"]),
}); 