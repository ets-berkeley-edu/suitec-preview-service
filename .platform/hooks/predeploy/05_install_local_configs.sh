#!/bin/bash
PYTHONPATH='' aws s3 cp s3://suitec-preview-service-config/${EB_ENVIRONMENT}.json config/local-production.json
