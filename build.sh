#!/usr/bin/env bash

buildDir="dist/oh-portal/"
targetFolder="assets"
baseHref="https://www.phonetik.uni-muenchen.de/apps/oh-portal/"
dev=""
#dev="-c dev"

# change this list to your needs (for exclusion of files or folders in the dist folder)
excludedList='"config" "LICENCE.txt" "media"'

# 1 = disable indexing, 0 = enable
disableRobots=0
# 1 = enable isUpdate, 0 = disable
isUpdate=0

timeNow=`date "+%Y-%m-%d %H:%M:%S"`
octraVersion="1.0.3"

echo "Remove cache..."
rm -rf ./node_modules/.cache
echo "Building OH-Portal..."
node --max-old-space-size=12000 ./node_modules/@angular/cli/bin/ng build --prod ${dev} --base-href "${baseHref}"
echo "Change index.html..."
indexHTML=$(<${buildDir}index.html)
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(scripts\.[0-9a-z]*\.js\)/.\/${targetFolder}\/\1/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(polyfills-es5\.[0-9a-z]*\.js\)/.\/${targetFolder}\/\1/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(polyfills-es2015\.[0-9a-z]*\.js\)/.\/${targetFolder}\/\1/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(src=\"\)\(-es2015\.[0-9a-z]*\.js\)/\1.\/${targetFolder}\/\2/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(src=\"\)\(-es5\.[0-9a-z]*\.js\)/\1.\/${targetFolder}\/\2/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(main-es2015\.[0-9a-z]*\.js\)/.\/${targetFolder}\/\1/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(main-es5\.[0-9a-z]*\.js\)/.\/${targetFolder}\/\1/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(runtime-es2015\.[0-9a-z]*\.js\)/.\/${targetFolder}\/\1/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(runtime-es5\.[0-9a-z]*\.js\)/.\/${targetFolder}\/\1/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(styles\.[0-9a-z]*\.css\)/.\/${targetFolder}\/\1/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(const ohPortalLastUpdated = \"\).*\(\";\)/\1${timeNow}\2/g")
indexHTML=$(echo "${indexHTML}" | sed -e "s/\(const ohPortalVersion = \"\).*\(\";\)/\1${octraVersion}\2/g")

if [[ ${disableRobots} == 0 ]]
then
  indexHTML=$(echo "${indexHTML}" | sed -e 's/\(<meta name="robots" content="noindex">\)/<\!--\1-->/g')
fi

echo "${indexHTML}" > ${buildDir}index.html

regEx=$(echo "${buildDir}" | sed 's:\/:\\/:g')
regEx="s|\.\/${regEx}||g"
echo ${regEx}

for old in ./${buildDir}*; do
    entry=$(echo $old | sed -e "${regEx}")
    found=0

    if [[ ${excludedList} != '' ]]
    then
      for excluded in ${excludedList}; do
        echo "compare ${entry} with ${excluded}"
        if [[ "\"${entry}\"" == ${excluded} ]]
        then
          found=1
          break
        fi
      done
    fi

    if [[ ${entry} != 'index.html' ]] && [[ ${entry} != ${targetFolder} ]] && [[ ${found} == 0 ]]
    then
      mv "./${buildDir}${entry}" "./${buildDir}${targetFolder}/${entry}"
    fi
  done
# you can add more jobs here
mv "./${buildDir}assets/.htaccess" "./${buildDir}.htaccess"

if [[ ${isUpdate} == 1 ]]
then
  rm -rf "./${buildDir}config" "./${buildDir}media" "./${buildDir}.htaccess"
fi

echo "Building COMPLETE"
