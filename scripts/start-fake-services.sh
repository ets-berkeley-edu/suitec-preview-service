#!/bin/bash

# Fail the entire script when one of the commands in it fails
set -e

log() {
  echo "${1}"; echo
}

java -Dconfig.file=etc/sqs/elasticmq.conf -jar elasticmq-server-0.13.2.jar > elasticmq-server.log 2>&1 &
elasticmqPid=$!
echo ${elasticmqPid} > elasticmq.pid

log "Started ElasticMQ (pid: ${elasticmqPid})"

fakeS3 -r s3-data -p 4567 > fakeS3.log 2>&1 &
fakeS3Pid=$!
echo ${fakeS3Pid} > fakeS3Pid.pid

log "Started Fake S3 (pid: ${fakeS3Pid})"

log "We are done. You can stop fake services with stop-fake-services.sh."

exit 0
