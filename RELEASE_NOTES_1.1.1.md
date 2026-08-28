# v1.1.1

## What changed

- Added a GitHub Actions `publish.yml` workflow that publishes to npm on tagged releases (`v*`), with a tag↔version guard and npm provenance.
- Added a `.gitignore` that excludes `AGENTS.md` and `RELEASE_NOTES_1.0.1.md`.
- Removed `AGENTS.md` from git history.

## Install

```sh
dsh plugin --profile web add qrcode-hassle-free@latest --config.minimumReleaseAge=0
```

## License

MIT
