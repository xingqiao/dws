#!/bin/bash

# export HTTP_PROXY="http://127.0.0.1:12639"

# echo $HTTP_PROXY

case "$1" in
    start)
        deno run --allow-run --allow-net --allow-read --allow-env index.ts
        ;;
    dev)
        deno run --unstable --allow-run --allow-read --allow-env development.ts
        ;;
    *)
        echo ""
        echo "  Usage: ./admin.sh [command]"
        echo ""
        echo "  Commands:"
        echo ""
        echo "    start"
        echo "    dev"
        echo ""
        exit 1
        ;;
esac
exit 0