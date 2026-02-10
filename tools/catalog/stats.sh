#!/usr/bin/env bash
set -e

echo "Catalog stats:"
echo "--------------"
echo "Total titles: $(grep -c 'id:' catalog.js)"
echo

echo "By type:"
grep 'type:' catalog.js | sort | uniq -c

echo
echo "By decade:"
grep 'year:' catalog.js | sed 's/.*year: \([0-9][0-9][0-9]\).*/\10s/' | sort | uniq -c
