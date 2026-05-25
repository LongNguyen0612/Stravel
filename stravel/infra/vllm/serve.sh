#!/bin/bash
# vLLM serving script for STravel
#
# Models (pick based on VRAM):
#   Qwen/Qwen2.5-7B       — 16GB VRAM (single GPU)
#   Qwen/Qwen2.5-7B-AWQ   — 8GB VRAM (quantized)
#   Qwen/Qwen2.5-3B       — 8GB VRAM (smaller model)
#
# Usage:
#   bash infra/vllm/serve.sh                    # Default: Qwen2.5-7B
#   MODEL=Qwen/Qwen2.5-3B bash infra/vllm/serve.sh  # Override model
#
# Stay on CUDA 12.x — known bug with CUDA 13.2 on Qwen models (as of 2026)

MODEL="${MODEL:-Qwen/Qwen2.5-7B}"
PORT="${PORT:-8001}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-4096}"

echo "Starting vLLM with model: $MODEL on port: $PORT"

vllm serve "$MODEL" \
    --port "$PORT" \
    --max-model-len "$MAX_MODEL_LEN" \
    --enable-prefix-caching \
    --dtype auto
