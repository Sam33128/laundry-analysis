import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const saveImage = mutation({
  args: {
    imageId: v.id("_storage"),
  },

  handler: async (ctx, args) => {
    const imageUrl = await ctx.storage.getUrl(args.imageId);

    if (!imageUrl) {
      throw new Error("Failed to retrieve image URL");
    }

    await ctx.db.insert("garments", {
      imageId: args.imageId,
      imageUrl,
      uploadedAt: Date.now(),

      // ✅ REQUIRED FIELD
      analyzed: false,

      // ❌ DO NOT ADD dryingTime here
      // ❌ DO NOT ADD null values
    });

    return imageUrl;
  },
});

export const getRecentImages = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("garments").order("desc").take(20);
  },
}); 