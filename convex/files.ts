import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveImage = mutation({
  args: { imageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.imageId);
    if (!url) throw new Error("Storage URL generation failed");

    const id = await ctx.db.insert("garments", {
      imageId: args.imageId,
      imageUrl: url,
      uploadedAt: Date.now(),
      analyzed: false,
      status: "processing", 
    });

    return { 
      id: id, 
      imageUrl: url 
    };
  },
});

export const markAnalyzed = mutation({
  args: {
    id: v.id("garments"),
    dryingTime: v.number(),
    totalGarments: v.number(),
    garmentsList: v.array(
      v.object({
        type: v.string(),
        fabric: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      analyzed: true,
      status: "completed",
      dryingTime: args.dryingTime,
      totalGarments: args.totalGarments,
      garmentsList: args.garmentsList,
    });
  },
});
