#!/usr/bin/env bash
# Builds public/voiceover.wav: Kokoro voice (pitched down slightly, warmed, compressed) over a low bed.
# Usage: tools/build_audio.sh <python-with-kokoro-onnx> <model.onnx> <voices.bin> [voice]
set -euo pipefail
cd "$(dirname "$0")/.."
PY=$1; MODEL=$2; VOICES=$3; VOICE=${4:-am_onyx}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
"$PY" -I tools/make_voiceover.py "$MODEL" "$VOICES" "$TMP/voice.wav" "$VOICE"
# -1.5 semitones without changing timing (0.917 = 2^(-1.5/12)), then warmth, de-harsh and steady dynamics.
ffmpeg -v error -y -i "$TMP/voice.wav" -i "$TMP/voice.bed.wav" -filter_complex "\
[0]asetrate=24000*0.917,aresample=48000,atempo=1/0.917,\
equalizer=f=110:t=q:w=1:g=4,equalizer=f=3500:t=q:w=1.5:g=-2,\
acompressor=threshold=-20dB:ratio=3:attack=5:release=120,volume=1.6[v];\
[1]aresample=48000,lowpass=f=160[b];\
[v][b]amix=inputs=2:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=9" \
  -ar 48000 public/voiceover.wav
echo "wrote public/voiceover.wav"
