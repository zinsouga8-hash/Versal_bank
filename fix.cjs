const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminMovements.tsx', 'utf-8');
const snippet = `                    <select
                      value={move.status}
                      onChange={(e) => handleUpdateStatus(move, e.target.value as any)}
                      className="text-xs h-8 rounded-lg border border-slate-200 px-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-[#0f2b5c]/20"
                    >
                      <option value="pending">En attente</option>
                      <option value="completed">Approuvé</option>
                      <option value="failed">Rejeté</option>
                    </select>
`;
// Remove all occurrences of snippet
while (content.includes(snippet)) {
  content = content.replace(snippet, '');
}
// Manually add snippet before Trash button
content = content.replace(/<Button\s+variant="ghost"\s+size="sm"\s+onClick=\{.. => handleDelete/g, snippet + '<Button\n                            variant="ghost"\n                            size="sm"\n                            onClick={() => handleDelete');
fs.writeFileSync('src/components/admin/AdminMovements.tsx', content);
