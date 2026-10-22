<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Game engine (src/game, src/components/GameHome.tsx) is browser-only and loaded via ClientOnly + lazy in src/routes/index.tsx; it reads localStorage/Audio at init, so never SSR it.
- Game backend lives in src/lib/live.functions.ts (server functions using the admin client); tables have no public policies except SELECT on live_events, which feeds realtime gift delivery.
- Game-specific UI primitives live in src/components/game-ui (base-ui based); keep src/components/ui as the stock shadcn set.
- tsconfig has noUncheckedIndexedAccess off because the imported game code relies on indexed access.
- Chrome extension source lives in extension/; after editing it, re-zip into public/brasil-fight-conector.zip (the panel downloads that file).
- Extension traffic enters only via src/routes/api/public/extension.event.ts (events, incl. raw page text classified server-side by classifyRaw) and extension.ocr.ts (screenshot → AI rows, token-checked); gift/keyword/raw-text logic is in src/lib/gift-bridge.server.ts (covered by src/test/gift-bridge.test.ts). Text reading and OCR are mutually exclusive in the extension so gifts are never counted twice.
- Gift delivery merges realtime with cursor-based recovery polling and deduplicates by event_id; polling only includes events created after the page opened to avoid replaying history.
- Gift cutscenes start only when an arena engine exists; interrupted gifts return to the queue, and panel delivery states are local to the current arena to avoid claiming execution on other devices.
