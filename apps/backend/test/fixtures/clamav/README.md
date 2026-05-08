# ClamAV test signatures

`lafken-test.ndb` is a custom ClamAV [extended signature][ndb-format] mounted
into the dev / test `clamav` container at `/var/lib/clamav/lafken-test.ndb`.
Both `apps/backend/docker-compose.yml` and `apps/backend/docker-compose.test.yml`
mount it; clamd auto-loads `*.ndb` from that directory at startup.

## What it matches

```
LafkenTest.Eicar-Anywhere:0:*:<hex-encoded EICAR string>
```

Target type `0` (any file), offset `*` (anywhere), pattern = the literal 68
bytes of the EICAR Anti-Virus Test File. ClamAV's stock `Eicar-Test-Signature`
fires only on EICAR-as-the-whole-file; it skips body-pattern scans on PNG /
JPEG content. This rule fires on the EICAR bytes appearing anywhere — in a
PNG `tEXt` chunk, after the IEND trailer, in EXIF, etc. — so we get
end-to-end coverage of the real `ClamAvVirusScanAdapter` against image
uploads.

It does **not** fire on `zTXt` (zlib-compressed) embeddings: the literal bytes
aren't on disk in those cases. That's a deeper limitation that would require
pre-decoding image chunks before scanning — addressed in production by the
Sharp re-decode pass during `image_inspection`, not by AV.

## Dev / test only

Never deploy this signature to staging or production. The presence of an
"infected"-flagged EICAR sequence in a hosted asset would be misleading at
best. The fixture lives under `test/fixtures/` and is mounted only by the
local docker-compose stacks.

[ndb-format]: https://docs.clamav.net/manual/Signatures/BodySignatureFormat.html
