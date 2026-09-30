import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Landmark, Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import { toast } from 'sonner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`
      });
      if (error) throw error;
      setIsSent(true);
      toast.success("Email de récupération envoyé.");
    } catch (error: any) {
      toast.error("Erreur lors de l'envoi de l'email.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-card p-8 rounded-3xl shadow-xl shadow-primary/5 border border-border/50">
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="flex items-center gap-2 mb-6">
            <Landmark className="w-10 h-10 text-primary" />
          </Link>
          <h1 className="font-heading text-2xl font-bold text-center">Mot de passe oublié</h1>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            Entrez votre adresse email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        {isSent ? (
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
              <MailCheck className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Email envoyé</h3>
            <p className="text-sm text-muted-foreground">
              Vérifiez votre boîte de réception (et vos spams) pour réinitialiser votre mot de passe.
            </p>
            <Link to="/login" className="mt-4 w-full">
              <Button className="w-full rounded-xl bg-primary text-primary-foreground">
                Retour à la connexion
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="rounded-xl"
                placeholder="nom@exemple.com"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" 
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {loading ? "Envoi en cours..." : "Envoyer le lien"}
            </Button>
          </form>
        )}

        {!isSent && (
          <div className="mt-8">
            <Link to="/login" className="flex items-center justify-center text-sm text-primary hover:underline font-medium gap-2">
              <ArrowLeft className="w-4 h-4" /> Retour à la connexion
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
