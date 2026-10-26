#!/usr/bin/env bash
# 生成导入校验用的测试音频（依赖 macOS say 与 ffmpeg）
set -euo pipefail
cd "$(dirname "$0")/../test-assets"
say -v Tingting "大家好，今天想和你们分享一个关于声音的小故事。每一个声音都有自己的温度。" -o zh.aiff
say -v Samantha "Hello everyone, today I want to share a short story about voices." -o en.aiff
ffmpeg -y -loglevel error -i zh.aiff -ac 1 -b:a 96k zh-short.mp3
ffmpeg -y -loglevel error -i en.aiff -ac 1 -ar 16000 en-short.wav
ffmpeg -y -loglevel error -i en.aiff -ac 1 -c:a aac -b:a 64k en-short.m4a
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=440:duration=0.5" too-short.mp3
ffmpeg -y -loglevel error -stream_loop 15 -i zh.aiff -t 75 -ac 1 -b:a 64k too-long.mp3
ffmpeg -y -loglevel error -f lavfi -i "anoisesrc=d=58:c=white" -ac 2 -ar 48000 too-large.wav
ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=16000:cl=mono" -t 3 silence.wav
: > empty.mp3
head -c 4000 /dev/urandom > corrupt.mp3
cp zh-short.mp3 wrong-format.ogg
ffmpeg -y -loglevel error -i zh.aiff -c:a libvorbis -f ogg fake-ext.mp3
rm -f zh.aiff en.aiff
echo "测试音频已生成"
