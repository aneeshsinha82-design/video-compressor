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

## Deploy to Render

A Render Blueprint is included in `render.yaml`. To deploy it:

1. Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/aneeshsinha82-design/video-compressor).
2. Sign in to Render and connect your GitHub account if prompted.
3. Review the service and persistent disk plan before creating it. The configuration requests a paid Starter web service and a 20 GB persistent disk; Render charges may apply.
4. When prompted for `COMPRESSOR_USER` and `COMPRESSOR_PASSWORD`, set your own strong username and password. Do not publish these values or commit them to GitHub.
5. Wait for the Docker build and deploy to finish. Open the generated Render URL; the browser should request the credentials.
6. Check `https://YOUR-RENDER-HOST/api/health` to confirm the service is healthy. Then test with a small video before trying large uploads.

The deployment enables HTTP Basic Authentication for the web app and keeps the health endpoint public for Render health checks. Use a strong unique password. Render's disk is mounted at `/var/data`, with uploads and output stored there. The 5 GB app limit does not override any hosting, proxy, timeout, or disk restrictions; test large uploads before relying on them. Do not expose the compressor without authentication because video encoding consumes CPU and disk.

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

## Large uploads

The server streams the incoming request to disk and disables Node's request timeout so long uploads and encodes are possible. The host must support persistent disk, FFmpeg processes, and long-running HTTP requests. A 5 GB upload limit is not a promise that every host can accept 5 GB: proxy, platform, disk quotas, and connection stability also matter. The browser currently receives the compressed file as a Blob, so very large output files can consume significant browser memory.
