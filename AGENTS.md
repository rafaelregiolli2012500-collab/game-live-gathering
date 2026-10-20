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
