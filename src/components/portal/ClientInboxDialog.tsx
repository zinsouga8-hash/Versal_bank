import React, { useEffect, useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Button } from '../ui/button';
import { Bell, Mail, CheckCircle2, ChevronRight, Loader2, Inbox } from 'lucide-react';
import { format } from 'date-fns';

interface ClientMessageRecord {
  id: string;
  client_email: string;
  subject: string;
  body: string;
  html?: string;
  read: boolean;
  type?: string;
  createdAt: number;
}

export default function ClientInboxDialog() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ClientMessageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<ClientMessageRecord | null>(null);
  const [open, setOpen] = useState(false);

  const fetchMessages = () => {
    if (!user || !user.email) return;
    setLoading(true);
    try {
      const raw = localStorage.getItem('versalbank_client_messages');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (m: any) => m.client_email?.toLowerCase() === user.email?.toLowerCase()
          );
          filtered.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
          setMessages(filtered);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [user]);

  useEffect(() => {
    if (open) {
      fetchMessages();
    }
  }, [open]);

  const unreadCount = messages.filter(m => !m.read).length;

  const markAsRead = (msg: ClientMessageRecord) => {
    setSelectedMsg(msg);
    if (!msg.read) {
      const updated = messages.map(m => m.id === msg.id ? { ...m, read: true } : m);
      setMessages(updated);
      try {
        const raw = localStorage.getItem('versalbank_client_messages');
        if (raw) {
          const parsed = JSON.parse(raw);
          const newAll = parsed.map((m: any) => m.id === msg.id ? { ...m, read: true } : m);
          localStorage.setItem('versalbank_client_messages', JSON.stringify(newAll));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground cursor-pointer">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#0f2b5c] rounded-full ring-2 ring-background animate-pulse" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center justify-between text-base sm:text-lg">
            <span className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#0f2b5c]" />
              Notifications & Communications
            </span>
            {unreadCount > 0 && (
              <span className="text-xs bg-[#0f2b5c]/10 text-[#0f2b5c] px-2 py-0.5 rounded-full font-normal">
                {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#0f2b5c]" />
            </div>
          ) : selectedMsg ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setSelectedMsg(null)}
                className="text-xs text-[#0f2b5c] hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                ← Retour à la liste
              </button>
              <div className="bg-[#faf8f5] p-4 rounded-xl border border-[#eee8dd]">
                <h3 className="font-semibold text-[#1a1a1a] text-sm sm:text-base mb-1">{selectedMsg.subject}</h3>
                <p className="text-[11px] text-[#8a857e]">
                  {format(selectedMsg.createdAt, 'dd MMMM yyyy HH:mm')}
                </p>
              </div>
              <div className="p-2 text-sm text-[#444] whitespace-pre-line leading-relaxed">
                {selectedMsg.body}
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-[#8a857e]">
              <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30 text-[#0f2b5c]" />
              <p className="text-sm font-medium">Aucun message pour le moment</p>
              <p className="text-xs mt-1">Vous recevrez ici vos confirmations d'opérations et alertes de sécurité.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#eee8dd]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => markAsRead(msg)}
                  className={`p-3 sm:p-4 rounded-xl cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                    msg.read ? 'hover:bg-slate-50' : 'bg-[#0f2b5c]/5 hover:bg-[#0f2b5c]/10'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!msg.read && (
                        <span className="w-2 h-2 rounded-full bg-[#0f2b5c] shrink-0" />
                      )}
                      <h4 className={`text-xs sm:text-sm truncate ${msg.read ? 'text-[#444]' : 'font-bold text-[#1a1a1a]'}`}>
                        {msg.subject}
                      </h4>
                    </div>
                    <p className="text-xs text-[#8a857e] line-clamp-1 mt-1 pl-4">
                      {msg.body}
                    </p>
                    <p className="text-[10px] text-[#aaa] mt-1.5 pl-4">
                      {format(msg.createdAt, 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#8a857e] shrink-0 self-center" />
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
