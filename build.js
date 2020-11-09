const fs = require("fs");
const {execSync, spawn} = require('child_process');

const buildDir = "dist/oh-portal/";
const targetFolder = "assets";
let baseHref = "";
let dev = '';

const excludedList = ["config", "LICENSE.txt", "contents", ".htaccess"];

let isUpdate = false;

let timeNow = getDateTimeString();
let version = "";

const packageText = fs.readFileSync("./package.json", {
  encoding: "utf8"
});
const json = JSON.parse(packageText);
version = json.version;

if (process.argv[2] === "dev=true") {
  dev = "-c dev";
}

if (process.argv[3] === "isUpdate=true") {
  isUpdate = true;
}

if (process.argv[4].indexOf("url=") > -1) {
  baseHref = process.argv[4].replace("url=", "");
}

console.log(`Building OH-Portal with dev=${dev}, isUpdate=${isUpdate} for ${baseHref}`);
console.log(`Remove dist...`);
execSync(`rm -rf "./${buildDir}"`);
const command = ['--max-old-space-size=12000', './node_modules/@angular/cli/bin/ng', 'build', '--prod', '-c', 'dev', '--base-href', baseHref];

if (dev === "") {
  command.splice(4, 2);
}

const node = spawn('node', command);
node.stdout.on('data', function (data) {
  console.log(data.toString());
});

node.stderr.on('data', function (data) {
  console.log(data.toString());
});
node.on('exit', function (code) {
  console.log('child process exited with code ' + code.toString());
  console.log(`Change index.html...`);
  let indexHTML = fs.readFileSync(`${buildDir}index.html`, {
    encoding: "utf8"
  });

  indexHTML = indexHTML.replace(/(scripts\.[0-9a-z]*\.js)/g, `${targetFolder}/$1`);
  indexHTML = indexHTML.replace(/(polyfills-es5\.[0-9a-z]*\.js)/g, `${targetFolder}/$1`);
  indexHTML = indexHTML.replace(/(polyfills-es2015\.[0-9a-z]*\.js)/g, `${targetFolder}/$1`);
  indexHTML = indexHTML.replace(/(polyfills\.[0-9a-z]*\.js)/g, `${targetFolder}/$1`);
  indexHTML = indexHTML.replace(/(src=")(-es2015\.[0-9a-z]*\.js)/g, `${targetFolder}/$2`);
  indexHTML = indexHTML.replace(/(src=")(-es5\.[0-9a-z]*\.js)/g, `${targetFolder}/$2`);
  indexHTML = indexHTML.replace(/(main-es2015\.[0-9a-z]*\.js)/g, `${targetFolder}/$1`);
  indexHTML = indexHTML.replace(/(main-es5\.[0-9a-z]*\.js)/g, `${targetFolder}/$1`);
  indexHTML = indexHTML.replace(/(main\.[0-9a-z]*\.js)/g, `${targetFolder}/$1`);
  indexHTML = indexHTML.replace(/(runtime-es2015\.[0-9a-z]*\.js)/g, `${targetFolder}/$1`);
  indexHTML = indexHTML.replace(/(runtime-es5\.[0-9a-z]*\.js)/g, `${targetFolder}/$1`);
  indexHTML = indexHTML.replace(/(runtime\.[0-9a-z]*\.js)/g, `${targetFolder}/$1`);
  indexHTML = indexHTML.replace(/(styles\.[0-9a-z]*\.css)/g, `${targetFolder}/$1`);
  indexHTML = indexHTML.replace(/(const ohPortalLastUpdated = ").*(";)/g, `$1${timeNow}$2`);
  indexHTML = indexHTML.replace(/(const ohPortalVersion = ").*(";)/g, `$1${version}$2`);

  fs.writeFileSync(`${buildDir}index.html`, indexHTML, {
    encoding: "utf8"
  });
  console.log(`indexed html changed!`);

  if (isUpdate) {
    execSync(`rm -rf "./${buildDir}config" "./${buildDir}media" "./${buildDir}.htaccess"`);
  }

  const items = fs.readdirSync(`./${buildDir}`, {
    encoding: "utf8"
  });

  for (const item of items) {
    let found = false;
    for (const excluded of excludedList) {
      if (excluded === item) {
        found = true;
        break;
      }
    }
    if (item !== "index.html" && item !== targetFolder && !found) {
      execSync(`mv "./${buildDir}${item}" "./${buildDir}${targetFolder}/${item}"`);
    }
  }

  if (!isUpdate) {
    execSync(`mv "./${buildDir}assets/.htaccess" "./${buildDir}.htaccess"`);
  } else {
    execSync(`rm "./${buildDir}assets/.htaccess"`);
  }
});

function getDateTimeString() {
  const today = new Date();
  let dd = today.getDate();
  let mm = today.getMonth() + 1;
  let h = today.getHours();
  let min = today.getMinutes();
  let sec = today.getSeconds();

  const yyyy = today.getFullYear();
  if (dd < 10) {
    dd = '0' + dd;
  }
  if (mm < 10) {
    mm = '0' + mm;
  }
  if (h < 10) {
    h = '0' + h;
  }
  if (min < 10) {
    min = '0' + min;
  }
  if (sec < 10) {
    sec = '0' + sec;
  }
  return `${yyyy}-${mm}-${dd} ${h}:${min}:${sec}`;
}
