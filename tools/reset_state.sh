#!/usr/bin/env bash

echo "ScreenLit local state reset"
echo "---------------------------"
echo
echo "This will clear all local ratings and dispositions"
echo "for the current browser and origin."
echo
echo "Steps:"
echo "1) Make sure ScreenLit is open in your browser:"
echo "   open http://localhost:8000/discover.html"
echo
echo "2) Open DevTools → Console"
echo
echo "3) Run this command exactly:"
echo "   localStorage.removeItem(\"screenlit-state-v1\")"
echo
echo "4) Refresh the page"
echo
echo "State reset complete."
