# qwen3-tts-ui

Simple web UI for `qwen3-tts-api`.

## Features
- Text input
- Speaker dropdown from `/speakers`
- Language selector
- Optional style/instruct input
- Reference audio upload + listing + selection
- Generate audio via `/api/tts`
- In-browser playback + download

## Local dev
Open `index.html` behind nginx proxy config in this repo.

## Kubernetes
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```
