const fs = require('fs');

let content = fs.readFileSync('src/components/admin/AdminMovements.tsx', 'utf8');

// The file has several syntax errors:
// 1. Missing `</Button>` tags
// 2. Missing `)}` after `return ( <TableRow ...> ... </TableRow> );` in `.map()`
// 3. Missing `</Select>` tags for the 'Sens Comptable' and 'Type d'opération'
// 4. Missing closing `</Button>` in Modal and `</Dialog>`
// 5. Missing `</SelectItem>` in TargetClientId map.

// Let's replace the whole TableBody for Desktop view:
// We can find `              <TableBody>` and `              </TableBody>`
// Actually it's easier to just write a simple version of AdminMovements.tsx

