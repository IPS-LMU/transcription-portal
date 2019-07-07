#!/usr/bin/env bash

buildDir="dist/"
targetFolder="assets"
baseHref="https://www.phonetik.uni-muenchen.de/apps/oh-portal/"

# change this list to your needs (for exclusion of files or folders in the dist folder)
excludedList='"config" "LICENCE.txt" "contents"'

# 1 = disable indexing, 2 = enable
disableRobots=0

timeNow=`date "+%Y-%m-%d %H:%M:%S"`
octraVersion="1.0.2"

echo "Building OH-Portal..."
node --max-old-space-size=12000 ./node_modules/@angular/cli/bin/ng build --prod --base-href "${baseHref}"
echo "Change index.html..."
indexHTML=$(<${buildDir}index.html)

indexHTML=$(echo "${indexHTML}" | sed -e "s/\(var ohPortalLastUpdated = \"\).*\(\";\)/\1${timeNow}\2/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(var ohPortalVersion = \"\).*\(\";\)/\1${octraVersion}\2/g")

if [[ ${disableRobots} == 0 ]]
then
  indexHTML=$(echo "${indexHTML}" | sed -e 's/\(<meta name="robots" content="noindex">\)/<\!--\1-->/g')
fi

echo "${indexHTML}" > ${buildDir}index.html

regEx=$(echo "${buildDir}" | sed 's:\/:\\/:g')
regEx="s|\.\/${regEx}||g"
echo ${regEx}

# you can add more jobs here
mv "./${buildDir}assets/.htaccess" "./${buildDir}.htaccess"

echo "Building COMPLETE"
