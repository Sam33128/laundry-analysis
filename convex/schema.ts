import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
        })
      )
    ),
  }),
});