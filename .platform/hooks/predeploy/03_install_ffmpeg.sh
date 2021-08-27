#!/bin/bash
sudo mkdir -p /opt/ffmpeg
sudo tar -xvf /tmp/ffmpeg-release-3.3.3-64bit-static.tar.xz -C /opt/ffmpeg
sudo ln -sf /opt/ffmpeg/ffmpeg-3.3.3-64bit-static/ffmpeg /usr/local/bin/ffmpeg
sudo ln -sf /opt/ffmpeg/ffmpeg-3.3.3-64bit-static/ffprobe /usr/local/bin/ffprobe
