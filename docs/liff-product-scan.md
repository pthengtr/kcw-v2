# LIFF product scanner (retired)

Product scan no longer uses LIFF. The `/liff/scan-product` page and
`NEXT_PUBLIC_LINE_LIFF_PRODUCT_SCANNER_ID` are leftover experiment code — do not
extend them or treat them as the LINE scanner.

Current flow: LINE camera / camera-roll → kcw-api webhook → pyzbar decode.

See **[kcw-api `docs/product-scan.md`](https://github.com/pthengtr/kcw-api/blob/master/docs/product-scan.md)**.
