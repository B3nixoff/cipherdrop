# CipherDrop Pacman Repo

This folder helps publish a local pacman repository for CachyOS / Arch-style installs.

## Build the repo metadata

```bash
./packaging/repo/build-repo.sh
```

It will:

- take the latest `.pacman` package from `dist-desktop/`
- copy it into `packaging/repo/out/`
- generate `cipherdrop.db.tar.gz`

## Add the repo locally

Append this to `/etc/pacman.conf`:

```ini
[cipherdrop]
SigLevel = Optional TrustAll
Server = file:///absolute/path/to/packaging/repo/out
```

Then refresh and install:

```bash
sudo pacman -Sy
sudo pacman -S cipherdrop
```

If you host `packaging/repo/out` on HTTP(S), replace the `file://` URL with your hosted repo URL.
