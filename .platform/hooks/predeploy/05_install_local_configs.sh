#!/bin/bash
aws s3 cp s3://squiggy-deploy-configs/squiggy/${EB_ENVIRONMENT}.json config/local-production.json
