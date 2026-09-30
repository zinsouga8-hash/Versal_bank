const fs = require('fs');
let code = fs.readFileSync('src/components/portal/PortalLayout.tsx', 'utf8');
code = code.replace(/import \{ Menu, X, /g, 'import { ');
// Add Menu, X to lucide-react import
code = code.replace(/from 'lucide-react';/, ", Menu, X } from 'lucide-react';");
// It might be like `import { ..., Menu, X } from 'lucide-react';` now.
fs.writeFileSync('src/components/portal/PortalLayout.tsx', code);
