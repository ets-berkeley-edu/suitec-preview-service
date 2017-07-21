#!/bin/bash

# Fail the entire script when one of the commands in it fails
set -e

log() {
  echo "${1}"; echo
}

# Kill ElasticMQ
elasticmqPid="$(cat elasticmq.pid)"
rm -f elasticmq.pid elasticmq-server.log

log "Kill the ElasticMQ process (pid: ${elasticmqPid})"
kill -9 ${elasticmqPid}

# Kill Fake S3
fakeS3Pid="$(cat fakeS3Pid.pid)"
rm -f fakeS3Pid.pid fakeS3.log

log "Kill the Fake S3 process (pid: ${fakeS3Pid})"
kill -9 ${fakeS3Pid}

log "We are done."

exit 0
