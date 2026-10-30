# Image OCR failure investigation — October 29, 2026 (Vancouver)

## Finding

The two retained failures, `217652af-89f2-41bc-b3a4-21325361d176` and
`5f6c4955-8b85-456a-ad71-03397a06a3f4`, occurred at 23:03:38 and 23:01:52 PDT.
Both failed in `file_parsing` with `OCR_UNAVAILABLE:assignment`, before AI grading
or account usage reservation. Their rubric PDF bytes match; their assignment
uploads are different JPEG and PNG files. They share the same service failure.

The configured Vercel Google Vision key was invalid. A fixed synthetic 1-pixel
image returned HTTP 400, `INVALID_ARGUMENT`, `API_KEY_INVALID` with that key, but
HTTP 200 with the existing local key. Production logs corroborate the failure
stage. No credential values or student content are included here.

## Fix and release status

- Replaced the existing `GOOGLE_CLOUD_VISION_API_KEY` value with the verified
  working key, preserving its existing Production/Preview/Development targets.
- Redeployed the same production commit `046fc6b45c617d6be5f749bc92f608c9e50f092c`
  to apply the environment correction. Deployment
  `dpl_DesVDdSbnNy3GHji2TLhsDuMQVMY` is READY and assigned to `rubricheck.com`.
- The parser improvements in this working tree are **not part of that redeploy**.
  They add safe diagnostic categories, move the key from the URL to a header,
  bound OCR requests/body reads to 20 seconds, handle malformed provider replies,
  and classify per-image RPC `INVALID_ARGUMENT` (3) as unreadable input instead
  of incorrectly comparing RPC codes with HTTP status codes.

Google documents the [API key header](https://docs.cloud.google.com/docs/authentication/api-keys-use)
and the [per-image error status](https://docs.cloud.google.com/vision/docs/reference/rest/v1/AnnotateImageResponse).

## Verification

- After explicit approval, replayed both retained original images through the
  existing Google Vision service. Both succeeded: 3,151 and 3,152 assignment
  characters respectively. The shared PDF extracted 2,682 characters locally.
- The complete unit/route suite passed: **232 tests** at the initial full run.
  A subsequent focused test adds explicit deadline-abort coverage.
- Route regression verifies invalid-key and quota errors return 503, invalid
  image data returns 400, originals are retained, failures reserve no usage or
  purchased credit, and single/multiple-image retries succeed and settle once.
- Provider tests cover both OCR feature types, language hints, fallback text,
  short multipart image text, missing keys, safe diagnostics, HTTP failures,
  RPC authentication/quota failures, malformed JSON/responses and deadlines.
- Live synthetic image → Google Vision → actual rubric model → actual evaluation
  model → finalization succeeded (381 OCR characters, one holistic criterion).
  This isolated check did not charge an application account or persist results.
  Original student text was not sent to the grading model during this check.
- Local production build (including TypeScript) and changed-file lint passed.
- Browser checks passed in English and Korean: four error paths including OCR,
  retained inputs, stable retry keys, and a rendered successful result (10 checks).
  The admin failure inbox also passed its five browser checks, including exact
  original downloads, expiry, pagination, deletion confirmation and mobile layout.
  Browser API responses in these regression scripts are test doubles.
- A production HTTP probe after the redeploy used a synthetic account and blank
  image. It returned the expected `400 FILE_PARSE_FAILED` for empty recognized
  text instead of the previous credential failure (`503 OCR_UNAVAILABLE`). This
  verifies the deployed OCR path and credentials, without an AI call or usage
  reservation. Its single synthetic failure archive was deleted afterward; both
  original incident archives remain intact under their existing retention policy.

The production probe validates OCR configuration, not an entire live customer
grading request. Successful original OCR replay plus parser, route, browser and
live synthetic AI checks cover the repaired boundary and adjacent behavior.
