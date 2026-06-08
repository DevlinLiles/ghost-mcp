import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";

const uploadParams = {
  file: z.string().describe("Absolute path to the image file on disk"),
  purpose: z
    .enum(["image", "profile_image", "icon"])
    .optional()
    .describe("Upload purpose; defaults to 'image'"),
  ref: z.string().optional().describe("Optional reference string returned in the response"),
};

export function registerImageTools(server: McpServer) {
  server.tool(
    "images_upload",
    uploadParams,
    async (args, _extra) => {
      const result = await ghostApiClient.images.upload(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
