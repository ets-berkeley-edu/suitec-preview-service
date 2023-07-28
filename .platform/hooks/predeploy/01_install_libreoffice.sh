#!/bin/bash
sudo mkdir -p /tmp/LibreOffice
sudo tar -xvzf /tmp/LibreOffice_7.5.4_Linux_x86-64_rpm.tar.gz -C /tmp/LibreOffice
sudo yum -y localinstall /tmp/LibreOffice/LibreOffice_7.5.4.2_Linux_x86-64_rpm/RPMS/*.rpm
sudo ln -sf /opt/libreoffice7.5/program/soffice /usr/local/bin/soffice
