const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminMovements.tsx', 'utf8');

const oldCall = `        notifyMovementStatusUpdated(
          move.user_email || move.client_email,
          newStatus,
          moveAmount,
          move.currency || 'CAD',
          move.reference || move.id,
          isCredit
        );`;

const newCall = `        notifyMovementStatusUpdated(
          { user_email: move.user_email || move.client_email },
          { id: move.reference || move.id, amount: moveAmount, currency: move.currency || 'CAD', type: isCredit ? 'credit' : 'debit', status: newStatus }
        );`;

code = code.replace(oldCall, newCall);
fs.writeFileSync('src/components/admin/AdminMovements.tsx', code);
