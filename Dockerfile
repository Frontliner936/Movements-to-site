FROM node:22-bookworm-slim
WORKDIR /app

# Local OCR for photos/scanned PDFs and Poppler for rendering PDF pages.
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    python3 \
    python3-pip \
    python3-venv \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-swa \
  && rm -rf /var/lib/apt/lists/*

# Use Argos Translate's CPU runtime without its optional Stanza/PyTorch/CUDA stack.
RUN python3 -m venv /opt/argos-venv
ENV PATH="/opt/argos-venv/bin:${PATH}" \
    ARGOS_DEVICE_TYPE=cpu \
    ARGOS_PACKAGES_DIR=/opt/argos-packages
RUN python3 -m pip install --no-cache-dir --no-deps \
    argostranslate==1.11.0 \
    ctranslate2==4.8.2 \
    minisbd==0.9.5 \
  && python3 -m pip install --no-cache-dir \
    packaging \
    'sacremoses>=0.0.53,<0.2' \
    'sentencepiece>=0.2,<0.3' \
    numpy \
    pyyaml \
    onnxruntime \
    filelock \
    requests

# Bake both translation directions into the image so app requests never call a translation API.
COPY server/getmchongo/install-translation-models.py /tmp/install-translation-models.py
RUN python3 /tmp/install-translation-models.py

RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN CI=1 pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/index.js"]
