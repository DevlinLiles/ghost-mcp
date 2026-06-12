// src/tools/tags.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";
import { toTagSummary } from "../utils/summaries";

// Parameter schemas as ZodRawShape (object literals)
const browseParams = {
  filter: z.string().optional(),
  limit: z.number().optional(),
  page: z.number().optional(),
  order: z.string().optional(),
};
const readParams = {
  id: z.string().optional(),
  slug: z.string().optional(),
};
const addParams = {
  name: z.string(),
  description: z.string().optional(),
  slug: z.string().optional(),
  // Add more fields as needed
};
const editParams = {
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  slug: z.string().optional(),
  // Add more fields as needed
};
const deleteParams = {
  id: z.string(),
};

export function registerTagTools(server: McpServer) {
  // Browse tags
  server.tool(
    "tags_browse",
    "Returns a summary list of tags (id, name, slug, description, created_at). Use tags_read with an id or slug to fetch full detail including meta and OG fields.",
    browseParams,
    async (args, _extra) => {
      const tags = await ghostApiClient.tags.browse(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tags.map(toTagSummary), null, 2),
          },
        ],
      };
    }
  );

  // Read tag
  server.tool(
    "tags_read",
    readParams,
    async (args, _extra) => {
      const tag = await ghostApiClient.tags.read(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tag, null, 2),
          },
        ],
      };
    }
  );

  // Add tag
  server.tool(
    "tags_add",
    addParams,
    async (args, _extra) => {
      const tag = await ghostApiClient.tags.add(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tag, null, 2),
          },
        ],
      };
    }
  );

  // Edit tag
  server.tool(
    "tags_edit",
    editParams,
    async (args, _extra) => {
      const tag = await ghostApiClient.tags.edit(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tag, null, 2),
          },
        ],
      };
    }
  );

  // Delete tag
  server.tool(
    "tags_delete",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.tags.delete(args);
      return {
        content: [
          {
            type: "text",
            text: `Tag with id ${args.id} deleted.`,
          },
        ],
      };
    }
  );
}