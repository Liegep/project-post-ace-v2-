import { ReactNode } from "react";
import { Eye, Globe, Sparkles, BarChart3, Columns3, EyeOff } from "lucide-react";
import { Locale, LOCALE_FLAGS, LOCALE_LABELS } from "@/i18n/translations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type TrackerItem = {
  key: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void | Promise<void>;
  icon: ReactNode;
};

type TrackerColumn = {
  id: string;
  name: string;
  visibleToClient: boolean;
};

interface ClientTrackerPanelProps {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void | Promise<void>;
  trackingEnabled: boolean;
  onTrackingEnabledChange: (checked: boolean) => void | Promise<void>;
  viewItems: TrackerItem[];
  actionItems: TrackerItem[];
  columns: TrackerColumn[];
  onToggleColumn: (columnId: string, visible: boolean) => void | Promise<void>;
}

const itemBaseClass =
  "flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/85 px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur";

function TrackerToggleRow({ item }: { item: TrackerItem }) {
  return (
    <div className={itemBaseClass}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          {item.icon}
        </div>
        <span className="truncate text-sm font-medium text-slate-700">{item.label}</span>
      </div>
      <Switch checked={item.checked} onCheckedChange={item.onCheckedChange} />
    </div>
  );
}

export function ClientTrackerPanel({
  locale,
  onLocaleChange,
  trackingEnabled,
  onTrackingEnabledChange,
  viewItems,
  actionItems,
  columns,
  onToggleColumn,
}: ClientTrackerPanelProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Idioma do portal</h3>
              <p className="mt-1 text-sm text-slate-500">Selecione o idioma padrão da área do cliente.</p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-2 text-slate-500">
              <Globe className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-3">
            <div className={cn(itemBaseClass, "items-center")}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">Idioma padrão</p>
                  <p className="truncate text-xs text-slate-500">Isso define como o portal será exibido para o cliente.</p>
                </div>
              </div>
              <Select value={locale} onValueChange={(value) => onLocaleChange(value as Locale)}>
                <SelectTrigger className="h-10 w-[170px] rounded-xl border-slate-200 bg-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {LOCALE_FLAGS[loc]} {LOCALE_LABELS[loc]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={itemBaseClass}>
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700">Tracker ativo</p>
                  <p className="truncate text-xs text-slate-500">Liga ou desliga esse módulo para o cliente.</p>
                </div>
              </div>
              <Switch checked={trackingEnabled} onCheckedChange={onTrackingEnabledChange} />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">O que ele pode fazer</h3>
              <p className="mt-1 text-sm text-slate-500">Gerencie as ações e permissões disponíveis para o cliente.</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-500">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-3">
            {actionItems.map((item) => (
              <TrackerToggleRow key={item.key} item={item} />
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
        <section className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">O que ele vê</h3>
              <p className="mt-1 text-sm text-slate-500">Defina quais módulos e informações ficam visíveis no portal.</p>
            </div>
            <div className="rounded-2xl bg-blue-50 p-2 text-blue-500">
              <Eye className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-3">
            {viewItems.map((item) => (
              <TrackerToggleRow key={item.key} item={item} />
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50 to-slate-100/70 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Colunas visíveis</h3>
              <p className="mt-1 text-sm text-slate-500">Escolha quais colunas do board aparecem para o cliente.</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-2 text-violet-500">
              <Columns3 className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-3">
            {columns.map((column) => (
              <div key={column.id} className={itemBaseClass}>
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl",
                      column.visibleToClient ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-400"
                    )}
                  >
                    {column.visibleToClient ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{column.name}</p>
                    <p className="text-xs text-slate-500">
                      {column.visibleToClient ? "Aparece no portal do cliente." : "Fica oculta no portal do cliente."}
                    </p>
                  </div>
                </div>
                <Switch checked={column.visibleToClient} onCheckedChange={(checked) => onToggleColumn(column.id, checked)} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white/80 px-4 py-3 text-xs text-slate-500 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        Ações e módulos desativados deixam de aparecer ou de poder ser usados pelo cliente no portal.
      </div>
    </div>
  );
}
