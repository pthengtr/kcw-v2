# LIFF product scanner (kcw-v2)

Companion doc: also see **kcw-api** `docs/liff-product-scan.md`.

## Auth model (no double login)

| Layer | Who authenticates | What it protects |
|-------|-------------------|------------------|
| LIFF page `/liff/*` | **No Supabase login** (public path) | Camera UI only |
| `liff.sendMessages()` | LINE LIFF in-client + `chat_message.write` | Can post into *this* chat only |
| Product lookup / Reply | **kcw-api** webhook (`ops.line_access` + LINE signature) | Business data & permissions |

Do **not** require a second KCW web login inside LIFF for this flow. The chatbot already knows who the LINE user is when the callback message arrives.

Plain browser URL access cannot be fully blocked (URLs are guessable), but it is **harmless**: outside LINE, send-to-chat is disabled and the page never calls product APIs or Push API.

## Env

```bash
NEXT_PUBLIC_LINE_LIFF_PRODUCT_SCANNER_ID=<LIFF_ID>
```

Browser-safe only. Never put channel secret / access token / service role keys in `NEXT_PUBLIC_*`.

## Route

- Page: `/liff/scan-product`
- Endpoint URL to register in LINE Developers: `https://<kcw-v2-host>/liff/scan-product`

## Callback contract

After scan, LIFF sends the **bare product code** into the current chat (no label prefix):

```text
<barcode>
```

Example: `8851234567890`

Implemented in `src/lib/liff/product-scan-contract.ts` (keep in sync with kcw-api). The bot webhook should treat a sanitized product-code message as scan/lookup input.

## LINE Developers checklist

1. Use a **LINE Login** channel under the **same provider** as the Messaging API bot (LIFF cannot be added to Messaging API channels).
2. Create LIFF app on that Login channel (not on the bot channel)
3. Size: Full
4. Endpoint: kcw-v2 `/liff/scan-product` (HTTPS)
5. Scopes: `profile`, `openid`, **`chat_message.write`** (often under View all)
6. Put LIFF ID in `NEXT_PUBLIC_LINE_LIFF_PRODUCT_SCANNER_ID`
7. Put LIFF URL in kcw-api `KCW_LIFF_PRODUCT_SCANNER_URL`
8. Leave the bot webhook on the Messaging API channel unchanged

## Local testing

- Camera UI can be exercised in a normal mobile browser (expect “เปิดนอก LINE” warning)
- Full send → webhook → reply requires real LINE / LIFF (use HTTPS tunnel for the endpoint if needed)

### Camera permission & autofocus

- **Always allow:** cannot be forced from the web app. LINE/OS shows the permission dialog; choose the lasting option if offered (e.g. Allow while using the app). After grant, same HTTPS origin usually won’t re-prompt unless the user cleared site data or denied earlier.
- **Autofocus:** applied *after* `getUserMedia` (never in the initial constraint bag — some LINE/iOS WebViews mishandle `focusMode` there). Continuous when supported; otherwise single-shot. The UI also supports **tap-to-focus**, a Focus button, and a periodic focus nudge. iOS / many LINE WebViews still only offer system AF.
- **Torch:** shown only when `MediaTrackCapabilities.torch` is true (mostly Android).
- **Zoom / focal length:** default **2×**. Uses camera `zoom` when the WebView exposes it; otherwise digitally center-crops the frame for detection and CSS-scales the preview. UI: ไกล / ใกล้ (1×–3×). This keeps the phone at a focusing-friendly distance instead of macro-close to the sticker.
- **1D tips:** hold about a hand’s width away and center the bars in the guide — do **not** fill the box. Small sticker codes like `16052911` need zoom + mid-range distance. Random wrong numbers are filtered by dropping ITF/Codabar and requiring 3 identical frame hits.
