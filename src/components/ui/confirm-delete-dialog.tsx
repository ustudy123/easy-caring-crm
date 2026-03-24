import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const STORAGE_KEY = "crm_skip_delete_confirm";

export function useSkipDeleteConfirm() {
  const skip = localStorage.getItem(STORAGE_KEY) === "true";
  return skip;
}

interface ConfirmDeleteDialogProps {
  trigger: React.ReactNode;
  title?: string;
  description?: string;
  onConfirm: () => void;
}

export function ConfirmDeleteDialog({
  trigger, title = "Tem certeza?", description = "Esta ação não pode ser desfeita. O registro será excluído permanentemente.",
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const skipConfirm = useSkipDeleteConfirm();

  const handleConfirm = () => {
    if (dontAskAgain) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    onConfirm();
  };

  // If user previously chose to skip, execute directly
  if (skipConfirm) {
    return <span onClick={onConfirm}>{trigger}</span>;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2 py-2">
          <Checkbox
            id="skip-confirm"
            checked={dontAskAgain}
            onCheckedChange={(v) => setDontAskAgain(v === true)}
          />
          <Label htmlFor="skip-confirm" className="text-sm text-muted-foreground cursor-pointer">
            Não perguntar novamente
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
