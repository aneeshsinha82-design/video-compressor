# FRAME / COMPRESS

A self-hosted, quality-first video compressor built with Node.js and FFmpeg. It streams uploads to disk rather than buffering the whole file in RAM, supports configurable large-file limits, and returns an MP4 download after compression.

## Run locally

Requirements: Node.js 20+ and FFmpeg installed and available as `ffmpeg`.

```bash
npm start
```

Open http://localhost:3000.

## Docker

```bash
docker compose up --build
```

The default upload cap is 5 GiB. Change `MAX_UPLOAD_GB` in the environment or `docker-compose.yml` to increase it, for example to `10`. The machine still needs enough free disk space for the input and output at the same time, and enough CPU time for FFmpeg.

## Quality profiles

- **Quality first:** H.264 CRF 18, slow preset, AAC 192 kb/s.
- **Balanced:** H.264 CRF 22, slow preset, AAC 192 kb/s.
- **Smaller file:** H.264 CRF 25, slow preset, AAC 128 kb/s.

CRF is a quality target, not a guaranteed file-size target. The compressor cannot guarantee mathematically identical quality or a smaller file for every source. Already highly compressed footage may shrink very little or even grow. For visually similar output, start with **Quality first**.

## Large uploads and deployment

The server streams the incoming request to a temporary file and disables Node's request timeout so long uploads and encodes are possible. For public deployment, configure your reverse proxy/load balancer to allow the desired body size and long request duration. The hosting platform must support persistent disk, FFmpeg processes, and long-running HTTP requests. GitHub Pages and static-only hosts cannot run this backend. Use HTTPS and add authentication/rate limits before exposing it publicly; this starter is not intended as an open anonymous public service.

`MAX_UPLOAD_GB` defaults to `5`. A 5 GB upload limit is not a promise that every host can accept 5 GB: proxy, platform, memory/disk quotas, and connection stability also matter.
