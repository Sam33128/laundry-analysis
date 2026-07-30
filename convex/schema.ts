import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  garments: defineTable({
    imageId: v.id("_storage"),
    imageUrl: v.string(),
    uploadedAt: v.number(),
  }),
}); 