#!/bin/sh

BUILDS=("imagery" "imagery-ol" "imagery-video" "imagery-cesium")
len=${#BUILDS[*]}
for (( i=0; i<len; i++ ))
do
    ng build @ansyn/${BUILDS[$i]} || exit 1
done
