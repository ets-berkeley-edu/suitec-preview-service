#!/bin/sh

# Make sure nothing else is running before we start the app server
./deploy/stop.sh

# Start the app server
forever -a -m 10 start app.js
