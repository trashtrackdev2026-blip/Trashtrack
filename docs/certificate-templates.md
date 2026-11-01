# Certificate artwork

New certificate snapshots and staff previews use `balete-appreciation-v2`. The background is an exact, unmodified copy of the user's supplied blank `4.png`; the supplied completed `3.png` guides text placement. It includes the Balete municipal seal, gold border and green footer.

Full participant name, event title, event date, organizing office, signatory and position come from the verified certificate snapshot. The sample person's name and placeholder labels in the reference are not issued as participant data. Names use the bundled Great Vibes font; new-template signatory text uses bold capitals. Long fields fit within the text and signature areas.

| Snapshot template ID | Artwork |
| --- | --- |
| `balete-appreciation-v2` | `assets/certificates/balete-appreciation-v2.png` |
| `appreciation-v1` or missing on an older snapshot | `assets/certificates/appreciation-v1.png` |

The supplied PNG's SHA-256 is `d6c0d0eb874b0b44c283bae1438343c45c2e54664482310e9f135afc2164934b`. Both assets and the existing font/license must be traced into the certificate and preview server functions; deployment checks enforce this.

This is a server-side PDF update. The resident Android app previews and downloads the generated PDF, so this change needs no APK replacement. Attendance eligibility, permissions and audited name correction continue to apply. Existing issued records are not rewritten by a new template release.

Validation includes exact embedded-artwork comparisons for new and legacy snapshots, full-name and snapshot checks, and rendered normal/long-field/legacy PDF samples.
