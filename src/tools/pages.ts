import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ghostApiClient } from "../ghostApi";

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
const tagRef = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    slug: z.string().optional(),
    name: z.string().optional(),
  }),
]);
const authorRef = z.union([
  z.string(),
  z.object({
    id: z.string().optional(),
    slug: z.string().optional(),
    email: z.string().optional(),
  }),
]);
const pageMutableFields = {
  html: z.string().optional().describe("HTML content for the page. Any <img> src values must be publicly accessible URLs — upload local images via images_upload first and use the returned URL."),
  lexical: z.string().optional(),
  status: z.string().optional().describe("Page status: 'draft', 'published', or 'scheduled'. All image URLs referenced in the page must be uploaded and accessible before setting status to 'published'."),
  slug: z.string().optional(),
  visibility: z.string().optional(),
  featured: z.boolean().optional(),
  show_title_and_feature_image: z.boolean().optional(),
  published_at: z.string().optional(),
  custom_excerpt: z.string().optional(),
  feature_image: z.string().url().optional().describe("Publicly accessible HTTPS URL of the feature image. Use the URL returned by images_upload for Ghost-hosted images."),
  feature_image_alt: z.string().optional(),
  feature_image_caption: z.string().optional(),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
  og_title: z.string().optional(),
  og_description: z.string().optional(),
  og_image: z.string().url().optional().describe("Publicly accessible HTTPS URL for the Open Graph image. Use the URL returned by images_upload for Ghost-hosted images."),
  twitter_title: z.string().optional(),
  twitter_description: z.string().optional(),
  twitter_image: z.string().url().optional().describe("Publicly accessible HTTPS URL for the Twitter card image. Use the URL returned by images_upload for Ghost-hosted images."),
  codeinjection_head: z.string().optional(),
  codeinjection_foot: z.string().optional(),
  canonical_url: z.string().optional(),
  tags: z.array(tagRef).optional(),
  authors: z.array(authorRef).optional(),
};
const addParams = {
  title: z.string(),
  ...pageMutableFields,
};
const editParams = {
  id: z.string(),
  updated_at: z.string(),
  title: z.string().optional(),
  ...pageMutableFields,
};
const deleteParams = {
  id: z.string(),
};

export function registerPageTools(server: McpServer) {
  server.tool(
    "pages_browse",
    browseParams,
    async (args, _extra) => {
      const pages = await ghostApiClient.pages.browse(args);
      return {
        content: [{ type: "text", text: JSON.stringify(pages, null, 2) }],
      };
    }
  );

  server.tool(
    "pages_read",
    readParams,
    async (args, _extra) => {
      const page = await ghostApiClient.pages.read(args);
      return {
        content: [{ type: "text", text: JSON.stringify(page, null, 2) }],
      };
    }
  );

  server.tool(
    "pages_add",
    "Create a new Ghost page. If the page includes images (feature_image, og_image, twitter_image, or <img> tags in html), upload them first using images_upload and use the returned URLs. Setting status to 'published' immediately makes the page live.",
    addParams,
    async (args, _extra) => {
      const options = args.html ? { source: "html" } : undefined;
      const page = await ghostApiClient.pages.add(args, options);
      return {
        content: [{ type: "text", text: JSON.stringify(page, null, 2) }],
      };
    }
  );

  server.tool(
    "pages_edit",
    "Update an existing Ghost page. Requires the current updated_at timestamp to prevent conflicting edits. If adding or changing images, upload them via images_upload first and use the returned URLs. Changing status to 'published' immediately makes the page live.",
    editParams,
    async (args, _extra) => {
      const options = args.html ? { source: "html" } : undefined;
      const page = await ghostApiClient.pages.edit(args, options);
      return {
        content: [{ type: "text", text: JSON.stringify(page, null, 2) }],
      };
    }
  );

  server.tool(
    "pages_delete",
    deleteParams,
    async (args, _extra) => {
      await ghostApiClient.pages.delete(args);
      return {
        content: [{ type: "text", text: `Page with id ${args.id} deleted.` }],
      };
    }
  );
}
