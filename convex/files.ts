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

    await ctx.db.insert("garments", {
      imageId: args.imageId,
      imageUrl: imageUrl!,
      uploadedAt: Date.now(),
    });

    return imageUrl;
  },
});

export const listImages = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("garments").order("desc").collect();
  },
}); 