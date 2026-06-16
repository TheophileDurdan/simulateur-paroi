#!/bin/bash
cd "$(dirname "$0")/V2"
if [ ! -d node_modules ]; then
  npm install
fi
open "http://localhost:5174"
npm run dev
