import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Receipt, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnName: string;
  currency?: string;
  onConfirm: (values: { name: string; quantity: number; unit_price: number; description: string }) => Promise<void>;
}

export function InvoiceColumnDialog({ open, onOpenChange, columnName, currency, onConfirm }: Props) {
  const [name, setName] = useState(columnName);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(columnName);
      setQuantity(1);
      setUnitPrice(0);
      setDescription("");
    }
  }, [open, columnName]);

  const total = Number((quantity * unitPrice).toFixed(2));

  const handleConfirm = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onConfirm({ name: name.trim() || columnName, quantity, unit_price: unitPrice, description });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="border-white/10 bg-[#2f2f33] text-white shadow-2xl sm:max-w-2xl">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-3 text-2xl font-semibold leading-tight sm:text-3xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white">
              <Receipt className="h-5 w-5" />
            </span>
            Revisar item da fatura
          </DialogTitle>
          <DialogDescription className="max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            Confirme a quantidade e o preço antes de adicionar à fatura em aberto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid gap-2">
            <Label htmlFor="inv-item-name" className="text-base font-semibold text-white">
              Descrição do item
            </Label>
            <Input
              id="inv-item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={columnName}
              className="h-16 rounded-3xl border-white/15 bg-white text-xl text-slate-900 placeholder:text-slate-500 focus-visible:ring-white/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="inv-item-qty" className="text-base font-semibold text-white">
                Quantidade
              </Label>
              <Input
                id="inv-item-qty"
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="h-16 rounded-3xl border-white/15 bg-white text-xl text-slate-900 focus-visible:ring-white/30"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-item-price" className="text-base font-semibold text-white">
                Preço unitário
              </Label>
              <Input
                id="inv-item-price"
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value) || 0))}
                className="h-16 rounded-3xl border-white/15 bg-white text-xl text-slate-900 focus-visible:ring-white/30"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="inv-item-notes" className="text-base font-semibold text-white">
              Observações (opcional)
            </Label>
            <Textarea
              id="inv-item-notes"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[180px] rounded-3xl border-white/15 bg-white text-base text-slate-900 placeholder:text-slate-500 focus-visible:ring-white/30"
            />
          </div>

          <div className="flex items-center justify-between rounded-3xl border border-white/20 bg-white/30 px-5 py-4 text-lg">
            <span className="text-white/80">Total</span>
            <span className="font-semibold text-white">{formatCurrency(total, currency)}</span>
          </div>
        </div>

        <DialogFooter className="mt-2 flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="h-14 rounded-2xl border-white/20 bg-white text-lg font-semibold text-slate-950 hover:bg-white/90"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={saving || !name.trim()}
            className="h-14 rounded-2xl bg-gradient-to-r from-sky-400 via-blue-500 to-violet-600 px-6 text-lg font-semibold text-white shadow-[0_12px_30px_rgba(59,130,246,0.28)] hover:opacity-95"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
            Enviar para fatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
