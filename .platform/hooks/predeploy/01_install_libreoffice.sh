#!/bin/bash
sudo mkdir -p /tmp/LibreOffice
sudo tar -xvzf /tmp/LibreOffice_5.3.6_Linux_x86-64_rpm.tar.gz -C /tmp/LibreOffice
sudo yum -y localinstall /tmp/LibreOffice/LibreOffice_5.3.6.1_Linux_x86-64_rpm/RPMS/*.rpm
sudo ln -sf /opt/libreoffice5.3/program/soffice /usr/local/bin/soffice
