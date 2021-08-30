#!/bin/bash
sudo mkdir -p /opt/ghostscript
sudo tar -xvzf /tmp/ghostscript-9.21-linux-x86_64.tgz -C /opt/ghostscript
sudo chmod +x /opt/ghostscript/ghostscript-9.21-linux-x86_64/gs-921-linux-x86_64
sudo ln -sf /opt/ghostscript/ghostscript-9.21-linux-x86_64/gs-921-linux-x86_64 /usr/local/bin/gs
