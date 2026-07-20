# @lighter/shop — Aurora storefront

A standalone Next.js shop on `@lighter/design-system`. **Every page body is a Lighter spec exported
from the studio after approval** — this app is the consumer end of Lighter's hand-off loop.

## Run it

```bash
pnpm --filter @lighter/shop dev
```

Then open http://localhost:4200

## The loop this demonstrates

```
author / amend a screen in Lighter   →  deploy to a review link  →  stakeholders comment
        ↓                                                                    ↓
   approve the version  ──────────────────────────────────────────  request changes
        ↓
GET /screens/:id/versions/:v/export   →  commit bundle `spec` into specs/  →  this app renders it
```

- **The app owns** routing, chrome (header/nav/cart), state and data.
- **Lighter owns** the screen: layout + composition, reviewed and approved before it lands here.

## Where things live

| Path | What |
| --- | --- |
| `specs/*.json` | The approved specs exported from Lighter — do not hand-edit; re-export instead |
| `lib/renderSpec.tsx` | `Spec → toJsonRender → <SpecView>` (the same boundary the studio uses) |
| `components/ShopChrome.tsx` | The app's own shell — real code, not a spec |
| `app/*/page.tsx` | One route per screen, each rendering its exported spec |

## Re-exporting after a change in Lighter

```bash
curl -s "$LIGHTER_URL/screens/storefront/versions/1/export" \
  -H "authorization: Bearer $LIGHTER_TOKEN" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.stringify(JSON.parse(d).spec,null,2)))" \
  > specs/storefront.json
```

Export is only allowed for an **approved** version (`403` otherwise) — so what ships here has always
been through review.

## Known limit

Spec-rendered content is presentational. Interactivity *inside* a spec (add-to-cart mutating cart
state) needs json-render **actions** wired into the design system's catalog; today the shop's real
state and navigation live in the app shell.
