const fs = require('fs');
let code = fs.readFileSync('src/components/portal/PortalLayout.tsx', 'utf8');
code = code.replace(/import \{\n  Menu,\n  X, /g, 'import { ');
fs.writeFileSync('src/components/portal/PortalLayout.tsx', code);
