#!/bin/sh
# Wrapper para capturar stderr de Node.js
exec node src/index.js 2>&1
