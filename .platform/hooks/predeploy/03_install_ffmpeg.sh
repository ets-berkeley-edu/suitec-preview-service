#!/bin/bash
sudo mkdir -p /opt/ffmpeg
sudo tar -xvf /tmp/ffmpeg-release-6.0-amd64-static.tar.xz -C /opt/ffmpeg
sudo ln -sf /opt/ffmpeg/ffmpeg-6.0-amd64-static/ffmpeg /usr/local/bin/ffmpeg
sudo ln -sf /opt/ffmpeg/ffmpeg-6.0-amd64-static/ffprobe /usr/local/bin/ffprobe
