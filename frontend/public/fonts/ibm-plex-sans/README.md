# IBM Plex Sans web fonts

Self-hosted IBM Plex Sans v23 WOFF2 assets used by the frontend. The official Google Fonts CSS (Chromium user agent) returned the same variable WOFF2 binary for weights 400, 500, and 600. The local `@font-face` declarations therefore share that binary with a `400 600` weight range while retaining the API's `font-display: swap` and Unicode subsets. Latin and Latin-ext are kept as separate subsets; together they preserve the source CSS coverage, including Spanish text and symbols such as `€`.

## Provenance

- Google Fonts CSS API: `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap`
- CSS user agent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36`
- Upstream version: `v23` (Google Fonts CSS asset paths)
- Downloaded: 2026-09-30 (UTC)
- License source: `https://raw.githubusercontent.com/IBM/plex/master/LICENSE.txt`
- License file: [`LICENSE.txt`](./LICENSE.txt), SIL Open Font License 1.1

| Local file | Exact source URL | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `ibm-plex-sans-latin.woff2` | `https://fonts.gstatic.com/s/ibmplexsans/v23/zYXzKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1syxeKYY.woff2` | 45712 | `e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470` |
| `ibm-plex-sans-latin-ext.woff2` | `https://fonts.gstatic.com/s/ibmplexsans/v23/zYXzKVElMYYaJe8bpLHnCwDKr932-G7dytD-Dmu1syxQKYbABA.woff2` | 30964 | `d160e20920ae4d6556518d352d3af27a74e9b0de3d8fe17b1c1044fc75aa2f81` |

Both assets are WOFF2 (`wOF2` signature) variable font resources from the same official v23 CSS response; they are unmodified upstream binaries, not generated or converted.
