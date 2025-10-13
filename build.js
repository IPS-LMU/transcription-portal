const fs = require("fs");
const {execSync, spawn} = require('child_process');
const { readFile, writeFile } = require('node:fs/promises');
const crypto = require('crypto');

const buildDir = "dist/apps/transcription-portal/";
const targetFolder = "assets";
let baseHref = "";
let dev = false;

const excludedList = ["config", "LICENSE.txt", "contents", ".htaccess", "3rdpartylicenses.txt", "manifest.json"];

let isUpdate = false;

let timeNow = getDateTimeString();
let version = "";

const packageText = fs.readFileSync("./package.json", {
  encoding: "utf8"
});
const json = JSON.parse(packageText);
version = json.version;

if (process.argv[2] === "dev=true") {
  console.log("dev is true!");
  dev = true;
}

if (process.argv[3] === "isUpdate=true") {
  isUpdate = true;
}

if (process.argv[4].indexOf("url=") > -1) {
  baseHref = process.argv[4].replace("url=", "");
}

console.log(`Building TranscriptionPortal with dev=${dev}, isUpdate=${isUpdate} for ${baseHref}`);
console.log(`Remove dist...`);
execSync(`rm -rf "./${buildDir}"`);
const command = ['node_modules/@nrwl/cli/bin/nx.js', 'build', 'transcription-portal', '--base-href', baseHref, "--deploy-url=assets/"];

if (dev) {
  command.push('--configuration', 'development');
} else {
  command.push('--configuration', 'production');
}

const node = spawn('node', command);
node.stdout.on('data', function (data) {
  console.log(data.toString());
});

node.stderr.on('data', function (data) {
  console.log(data.toString());
});
node.on('exit', async function (code) {
  console.log('child process exited with code ' + code.toString());
  console.log(`Change index.html...`);
  await setBuildVariable();
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

async function setBuildVariable() {
  let content = await readFile('./dist/apps/transcription-portal/index.html', {
    encoding: 'utf-8',
  });

  let pkg = await readFile('./package.json', {
    encoding: 'utf-8',
  });
  pkg = JSON.parse(pkg);
  const hash = crypto.randomUUID();

  content = content.replace(/\/\*.*var BUILD = ({[^}]+}).*\*\//gs, (g0, g1) => {
    const build = JSON.parse(g1);
    build.version = pkg.version;
    build.timestamp = new Date().toISOString();
    build.hash = hash;

    console.log(build);

    return `var BUILD = ${JSON.stringify(build)};`;
  });

  await writeFile('./dist/apps/transcription-portal/index.html', content, {
    encoding: 'utf-8',
  });

  console.log(`BUILD-HASH: ${hash}`);
}
