#!/bin/bash
# Deploy mySignage to Dev VPS
VPS="root@91.98.144.84"
REMOTE="/opt/mysignage"

echo "Building frontend..."
cd client && npx vite build || exit 1
cd ..

echo "Uploading client..."
ssh $VPS "rm -rf $REMOTE/client/dist"
scp -r client/dist $VPS:$REMOTE/client/dist

echo "Uploading server..."
scp -r server/services/ $VPS:$REMOTE/server/services/
scp -r server/controllers/ $VPS:$REMOTE/server/controllers/
scp server/server.js $VPS:$REMOTE/server/server.js

echo "Restarting..."
ssh $VPS "pm2 restart mysignage"

echo "Done!"
