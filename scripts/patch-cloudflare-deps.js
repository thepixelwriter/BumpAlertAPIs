const fs = require('node:fs');
const path = require('node:path');

const roots = [
  path.join(__dirname, '..', 'node_modules', 'iconv-lite', 'lib', 'index.js'),
  path.join(__dirname, '..', 'node_modules', 'body-parser', 'node_modules', 'iconv-lite', 'lib', 'index.js'),
  path.join(__dirname, '..', 'node_modules', 'raw-body', 'node_modules', 'iconv-lite', 'lib', 'index.js'),
];

for (const filePath of roots) {
  if (!fs.existsSync(filePath)) {
    continue;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const patched = source
    .replace('        require("./streams")(iconv);', '        // Workers do not provide the Node stream extensions used by iconv-lite.')
    .replace('    require("./extend-node")(iconv);', '    // Workers do not provide the Node extensions used by iconv-lite.');
  if (patched !== source) {
    fs.writeFileSync(filePath, patched);
  }
}