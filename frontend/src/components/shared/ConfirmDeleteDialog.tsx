// ===========================================
// Confirm Delete Dialog Component
// ===========================================
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDeleteDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCancel?: () => void;
  title?: string;
  itemName?: string;
  description?: string;
  onConfirm: () => Promise<void> | void;
  isDeleting?: boolean;
  isLoading?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  isOpen,
  onOpenChange,
  onCancel,
  title = '¿Eliminar elemento?',
  itemName,
  description,
  onConfirm,
  isDeleting = false,
  isLoading = false,
}: ConfirmDeleteDialogProps) {
  const isDialogOpen = open !== undefined ? open : !!isOpen;
  const loading = isDeleting || isLoading;

  const handleClose = () => {
    if (loading) return;
    onOpenChange?.(false);
    onCancel?.();
  };

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={(v) => (!v ? handleClose() : onOpenChange?.(true))}>
      <DialogContent className="sm:max-w-[440px] p-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mb-1">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <DialogHeader className="space-y-1 text-center sm:text-center">
            <DialogTitle className="text-lg font-bold text-primary-950">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-primary-600">
              {description ? (
                description
              ) : itemName ? (
                <>
                  ¿Estás seguro de que deseas eliminar{' '}
                  <span className="font-semibold text-primary-900">"{itemName}"</span>?
                  Esta acción no se puede deshacer.
                </>
              ) : (
                'Esta acción no se puede deshacer y eliminará permanentemente el registro.'
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
            className="w-full sm:w-auto gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Eliminando...' : 'Sí, eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
