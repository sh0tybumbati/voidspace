#!/bin/bash
# Make an existing account a site admin:  ./make-admin.sh <username>
exec npm run --silent make-admin -w apps/api -- "$@"
