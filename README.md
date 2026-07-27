<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a73e5819-0903-43c4-9042-d6a7ab9da2c6

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env](.env) to your Gemini API key
3. Run the app:
   `npm run dev`

## Notes

- Uploaded/created documents are persisted to `data/documents.json` (gitignored) so they survive server restarts. Delete the `data/` directory to reset back to the sample documents.
- MCP tools (`mcp_doc_search`, `mcp_spec_analyzer`, `mcp_web_grounding`, `mcp_hypothesis_tester`) are executed for real rather than mocked — agents select and invoke them via Gemini function calling, and results are grounded in that tool output.
- If a Gemini API call fails (e.g. missing/invalid `GEMINI_API_KEY`), the app surfaces the real error in the UI instead of falling back to fabricated sample data.
