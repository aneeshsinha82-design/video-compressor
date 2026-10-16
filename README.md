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
- **Extreme size:** H.265/HEVC CRF 30, slow preset, AAC 96 kb/s. This aims for much larger reductions and may reach 90% on suitable high-bitrate footage, but can visibly reduce detail and needs a server FFmpeg build with `libx265` enabled.

CRF is a quality target, not a guaranteed file-size target. A 90% reduction means the output is only 10% of the original size; no encoder can promise that reduction while also preserving the same quality for every video. Already highly compressed footage may shrink very little or even grow. For visually similar output, start with **Quality first**. Use **Extreme size** only when file size matters more than visual fidelity.

## Sample compression test

The Extreme Size FFmpeg settings were run against a sample 1080 × 1920 H.264/AAC MP4:

| Measurement | Result |
|---|---:|
| Original size | 20,654,268 bytes (20.65 MB) |
| Output size | 1,812,485 bytes (1.81 MB) |
| Size reduction | 91.2% |
| Original duration | 12.074 seconds |
| Output duration | 12.074 seconds |
| Output video | H.265/HEVC, 1080 × 1920 |
| Output audio | AAC |

This is one sample result, not a guarantee for other videos. The output was probed successfully and its resolution and duration were preserved. A smaller file can still have visible quality loss; compare the result before deleting the original. This command-level test does not by itself verify the full browser upload/download flow or 5 GB uploads.

## Large uploads and deployment

The server streams the incoming request to a temporary file and disables Node's request timeout so long uploads and encodes are possible. For public deployment, configure your reverse proxy/load balancer to allow the desired body size and long request duration. The hosting platform must support persistent disk, FFmpeg processes, and long-running HTTP requests. GitHub Pages and static-only hosts cannot run this backend. Use HTTPS and add authentication/rate limits before exposing it publicly; this starter is not intended as an open anonymous public service.

`MAX_UPLOAD_GB` defaults to `5`. A 5 GB upload limit is not a promise that every host can accept 5 GB: proxy, platform, memory/disk quotas, and connection stability also matter.
