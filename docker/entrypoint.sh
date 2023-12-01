#!/bin/bash
# Set the correct permissions for /data
chown -R myuser:myuser /data
# Execute the main container command
exec "$@"

