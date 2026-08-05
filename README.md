

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

