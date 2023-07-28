#!/bin/bash
sudo mkdir -p /opt/ghostscript
sudo tar -xvzf /tmp/ghostscript-10.0.0-linux-x86_64.tgz -C /opt/ghostscript
sudo chmod +x /opt/ghostscript/ghostscript-10.0.0-linux-x86_64/gs-1000-linux-x86_64
sudo ln -sf /opt/ghostscript/ghostscript-10.0.0-linux-x86_64/gs-1000-linux-x86_64 /usr/local/bin/gs
