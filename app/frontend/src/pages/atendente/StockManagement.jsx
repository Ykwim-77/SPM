import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Download,
  Search,
  Building2,
  Lock,
  AlertTriangle,
} from "lucide-react";

// Dosagens comuns pré-definidas — o atendente pode escolher ou digitar outra
const DOSAGE_PRESETS = [
  "5mg", "10mg", "20mg", "25mg", "50mg", "75mg",
  "100mg", "150mg", "200mg", "250mg", "500mg",
  "750mg", "850mg", "1g", "5ml", "10ml", "15ml", "20ml",
];

const defaultForm = () => ({
  medicine: "",
  quantity: 1,
  dosage: "",
  lot: "",
  notes: "",
  selectedUnitId: "",
});

const ENTRY_STORAGE_KEY = "stock-entry-draft";
const EXIT_STORAGE_KEY = "stock-exit-draft";

export default function StockManagement({
  initialTab = "entry",
  mode = "atendente",
}) {
  const { user } = useAuth();
  const isSecretaryView = user?.role === "secretario" || mode === "secretario";
  const [activeTab, setActiveTab] = useState(
    isSecretaryView ? "stock" : initialTab,
  );
  const [entryForm, setEntryForm] = useState(defaultForm());
  const [exitForm, setExitForm] = useState(defaultForm());
  const [units, setUnits] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [stockFilter, setStockFilter] = useState({
    medicine: "",
    unit: "",
    unitId: "",
  });
  const [historyFilterMode, setHistoryFilterMode] = useState("all");
  const [historyFilterValue, setHistoryFilterValue] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const savedEntry = JSON.parse(
        window.localStorage.getItem(ENTRY_STORAGE_KEY) || "null",
      );
      const savedExit = JSON.parse(
        window.localStorage.getItem(EXIT_STORAGE_KEY) || "null",
      );
      if (savedEntry) setEntryForm((prev) => ({ ...prev, ...savedEntry }));
      if (savedExit) setExitForm((prev) => ({ ...prev, ...savedExit }));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ENTRY_STORAGE_KEY, JSON.stringify(entryForm));
  }, [entryForm]);

  useEffect(() => {
    window.localStorage.setItem(EXIT_STORAGE_KEY, JSON.stringify(exitForm));
  }, [exitForm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [unitsRes, stockRes, txRes] = await Promise.all([
        api.get("/health-units"),
        api.get("/stock/summary"),
        api.get("/stock/transactions"),
      ]);
      setUnits(unitsRes.data || []);
      setStockItems(stockRes.data || []);
      setMovements(txRes.data || []);

      const availableUnits = unitsRes.data || [];
      if (availableUnits.length && !entryForm.selectedUnitId) {
        const preferred =
          availableUnits.find((unit) => unit.id === user?.healthUnitId) ||
          availableUnits[0];
        setEntryForm((prev) => ({
          ...prev,
          selectedUnitId: preferred?.id || "",
        }));
      }
      if (availableUnits.length && !exitForm.selectedUnitId) {
        const preferred =
          availableUnits.find((unit) => unit.id === user?.healthUnitId) ||
          availableUnits[0];
        setExitForm((prev) => ({
          ...prev,
          selectedUnitId: preferred?.id || "",
        }));
      }
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível carregar o estoque agora");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.healthUnitId]);

  const filteredStock = useMemo(() => {
    const medicineTerm = stockFilter.medicine.toLowerCase();
    const unitTerm = stockFilter.unit.toLowerCase();
    return stockItems.filter((item) => {
      const matchesMedicine =
        !medicineTerm ||
        [item.medicineId, item.medicineName]
          .join(" ")
          .toLowerCase()
          .includes(medicineTerm);
      const matchesUnit =
        !stockFilter.unitId && !unitTerm
          ? true
          : stockFilter.unitId
            ? item.unitId === stockFilter.unitId
            : item.unitName.toLowerCase().includes(unitTerm);
      return matchesMedicine && matchesUnit;
    });
  }, [stockItems, stockFilter]);

  const formatDateTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  const filteredMovements = useMemo(() => {
    return movements.filter((item) => {
      const term = historyFilterValue.trim().toLowerCase();
      if (historyFilterMode === "user") {
        if (!term) return true;
        return (item.user?.name || "").toLowerCase().includes(term);
      }
      if (historyFilterMode === "unit") {
        if (!term) return true;
        return (item.unit || "").toLowerCase().includes(term);
      }
      if (historyFilterMode === "medicine") {
        if (!term) return true;
        return (item.medicineName || "").toLowerCase().includes(term);
      }
      if (historyFilterMode === "type") {
        if (!term) return true;
        const selected =
          term === "entrada" ? "ENTRY" : term === "saida" ? "EXIT" : "";
        return selected ? item.type === selected : true;
      }
      if (historyFilterMode === "period") {
        const ts = new Date(item.createdAt).getTime();
        const from = historyDateFrom
          ? new Date(`${historyDateFrom}T00:00:00`).getTime()
          : null;
        const to = historyDateTo
          ? new Date(`${historyDateTo}T23:59:59`).getTime()
          : null;
        if (from !== null && ts < from) return false;
        if (to !== null && ts > to) return false;
        return true;
      }
      if (!term) return true;
      return [item.medicineName, item.unit, item.user?.name, item.type]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [
    movements,
    historyFilterMode,
    historyFilterValue,
    historyDateFrom,
    historyDateTo,
  ]);

  const updateEntryForm = (changes) =>
    setEntryForm((prev) => ({ ...prev, ...changes }));
  const updateExitForm = (changes) =>
    setExitForm((prev) => ({ ...prev, ...changes }));

  const exportMovementsCsv = () => {
    const rows = filteredMovements.map((item) => ({
      dataHora: formatDateTime(item.createdAt),
      tipo: item.type === "ENTRY" ? "Entrada" : "Saída",
      medicamento: item.medicineName || "",
      unidade: item.unit || "",
      usuario: item.user?.name || "",
      quantidade: item.quantity || 0,
    }));

    const headers = [
      "dataHora",
      "tipo",
      "medicamento",
      "unidade",
      "usuario",
      "quantidade",
    ];
    const csv = [headers.join(",")]
      .concat(
        rows.map((row) =>
          headers
            .map(
              (header) => `"${String(row[header] ?? "").replace(/"/g, '""')}"`,
            )
            .join(","),
        ),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `movimentacoes-estoque-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso");
  };

  const handleHistoryDateFromChange = (value) => {
    setHistoryDateFrom(value);
    if (value && historyDateTo && value > historyDateTo) {
      setHistoryDateTo(value);
      toast.warning(
        "A data final foi ajustada para a data inicial, pois não pode ser anterior.",
      );
    }
  };

  const handleHistoryDateToChange = (value) => {
    if (historyDateFrom && value && historyDateFrom > value) {
      setHistoryDateTo(historyDateFrom);
      toast.warning(
        "A data final foi ajustada para a data inicial, pois não pode ser anterior.",
      );
      return;
    }
    setHistoryDateTo(value);
  };

  const submitEntry = async () => {
    if (!entryForm.medicine.trim() || entryForm.quantity <= 0) {
      return toast.warning("Informe o medicamento e uma quantidade válida");
    }
    if (!entryForm.selectedUnitId) {
      return toast.warning("Selecione uma unidade de saúde");
    }

    setSubmitting(true);
    try {
      await api.post("/stock/entry", {
        medicine_id: entryForm.medicine.trim(),
        medicine_name: entryForm.medicine.trim(),
        quantity: Number(entryForm.quantity),
        dosage: entryForm.dosage,
        lot: entryForm.lot,
        notes: entryForm.notes,
        health_unit_id: entryForm.selectedUnitId,
      });
      toast.success("Entrada registrada com sucesso");
      window.localStorage.removeItem(ENTRY_STORAGE_KEY);
      setEntryForm({
        ...defaultForm(),
        selectedUnitId: entryForm.selectedUnitId,
      });
      await loadData();
      setActiveTab("stock");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao registrar entrada");
    } finally {
      setSubmitting(false);
    }
  };

  const submitExit = async () => {
    if (!exitForm.medicine.trim() || exitForm.quantity <= 0) {
      return toast.warning("Informe o medicamento e uma quantidade válida");
    }
    if (!exitForm.selectedUnitId) {
      return toast.warning("Selecione uma unidade de saúde");
    }

    setSubmitting(true);
    try {
      await api.post("/stock/exit", {
        medicine_id: exitForm.medicine.trim(),
        medicine_name: exitForm.medicine.trim(),
        quantity: Number(exitForm.quantity),
        dosage: exitForm.dosage,
        lot: exitForm.lot,
        notes: exitForm.notes,
        health_unit_id: exitForm.selectedUnitId,
      });
      toast.success("Saída registrada com sucesso");
      window.localStorage.removeItem(EXIT_STORAGE_KEY);
      setExitForm({
        ...defaultForm(),
        selectedUnitId: exitForm.selectedUnitId,
      });
      await loadData();
      setActiveTab("stock");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao registrar saída");
    } finally {
      setSubmitting(false);
    }
  };

  // Lista de medicamentos já conhecidos (saldo + histórico), para autocomplete
  // — reduz erro de digitação e evita duplicar o mesmo remédio com nomes diferentes
  const knownMedicines = useMemo(() => {
    const names = new Set();
    stockItems.forEach((item) => item.medicineName && names.add(item.medicineName));
    movements.forEach((item) => item.medicineName && names.add(item.medicineName));
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [stockItems, movements]);

  // Medicamentos mais movimentados recentemente, para acesso rápido em 1 clique
  const topMedicines = useMemo(() => {
    const counts = new Map();
    movements.forEach((item) => {
      if (!item.medicineName) return;
      counts.set(item.medicineName, (counts.get(item.medicineName) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [movements]);

  const getBalance = (unitId, medicineName) => {
    if (!unitId || !medicineName?.trim()) return null;
    const term = medicineName.trim().toLowerCase();
    const match = stockItems.find(
      (item) =>
        item.unitId === unitId &&
        (item.medicineName || "").trim().toLowerCase() === term,
    );
    return match ? match.quantity : 0;
  };

  const userUnit = units.find((u) => u.id === user?.healthUnitId);

  const renderForm = (
    kind,
    form,
    updateForm,
    title,
    description,
    submitLabel,
    submitAction,
  ) => {
    const isExit = kind === "exit";
    const balance = isExit ? getBalance(form.selectedUnitId, form.medicine) : null;
    const overDraft = isExit && balance !== null && Number(form.quantity) > balance;
    const canSubmit = form.medicine.trim() && Number(form.quantity) > 0 && form.selectedUnitId;

    return (
      <div className="space-y-5">
        {/* Cabeçalho da operação */}
        <div
          className={`rounded-2xl p-5 flex items-start gap-4 border ${
            isExit ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 ${
              isExit ? "bg-amber-600" : "bg-emerald-600"
            }`}
          >
            {isExit ? <ArrowDownCircle className="w-6 h-6" /> : <ArrowUpCircle className="w-6 h-6" />}
          </div>
          <div>
            <div className="font-display font-bold text-lg text-[#1D3557]">{title}</div>
            <div className="text-sm text-slate-600">{description}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-[260px_1fr] gap-5">
          {/* Coluna lateral: contexto fixo (atendente / UBS / saldo) */}
          <div className="space-y-4">
            <div className="sc-card p-4">
              <div className="overline text-[#457B9D] mb-2">Atendente</div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#1D3557]/10 text-[#1D3557] flex items-center justify-center font-bold text-sm shrink-0">
                  {(user?.name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="font-semibold text-[#1D3557] text-sm leading-tight">
                  {user?.name || "Carregando..."}
                </div>
              </div>
            </div>

            <div className="sc-card p-4">
              <div className="overline text-[#457B9D] mb-2">Unidade de saúde</div>
              {userUnit ? (
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#1D3557] shrink-0" />
                    <span className="font-bold text-[#1D3557] text-sm">{userUnit.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1.5">
                    <Lock className="w-3 h-3" /> vinculada ao seu cadastro
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    value={form.selectedUnitId}
                    onChange={(e) => updateForm({ selectedUnitId: e.target.value })}
                    className="inp"
                  >
                    <option value="">Selecione a unidade</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-amber-600 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Seu usuário não tem uma UBS vinculada. Peça ao administrador para configurar.
                  </p>
                </div>
              )}
            </div>

            {isExit && form.medicine.trim() && (
              <div className={`sc-card p-4 ${overDraft ? "border-red-300 bg-red-50" : ""}`}>
                <div className="overline text-[#457B9D] mb-1">Saldo disponível</div>
                <div className={`text-3xl font-extrabold font-mono-nums ${overDraft ? "text-red-600" : "text-[#1D3557]"}`}>
                  {balance === null ? "—" : balance}
                </div>
                {overDraft && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-start gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Quantidade maior que o saldo em estoque.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Coluna principal: dados da movimentação */}
          <div className="sc-card p-5 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Medicamento
              </label>
              <input
                value={form.medicine}
                onChange={(e) => updateForm({ medicine: e.target.value })}
                list={`medicine-list-${kind}`}
                className="inp"
                placeholder="Digite ou selecione o nome do medicamento"
              />
              <datalist id={`medicine-list-${kind}`}>
                {knownMedicines.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {topMedicines.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {topMedicines.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => updateForm({ medicine: name })}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${
                        form.medicine === name
                          ? isExit
                            ? "border-amber-500 bg-amber-50 text-amber-700"
                            : "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[#457B9D] hover:text-[#457B9D]"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Dosagem
                </label>
                <input
                  value={form.dosage}
                  onChange={(e) => updateForm({ dosage: e.target.value })}
                  list={`dosage-list-${kind}`}
                  className="inp"
                  placeholder="Selecione ou digite"
                />
                <datalist id={`dosage-list-${kind}`}>
                  {DOSAGE_PRESETS.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Lote / Referência
                </label>
                <input
                  value={form.lot}
                  onChange={(e) => updateForm({ lot: e.target.value })}
                  className="inp"
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Quantidade
              </label>
              <div className="flex items-center gap-2 w-fit">
                <button
                  type="button"
                  onClick={() => updateForm({ quantity: Math.max(1, Number(form.quantity || 1) - 1) })}
                  className="w-10 h-10 rounded-lg border border-slate-200 text-lg font-bold text-[#1D3557] hover:bg-slate-50 transition"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => updateForm({ quantity: Number(e.target.value) })}
                  className="inp w-24 text-center font-mono-nums"
                />
                <button
                  type="button"
                  onClick={() => updateForm({ quantity: Number(form.quantity || 0) + 1 })}
                  className="w-10 h-10 rounded-lg border border-slate-200 text-lg font-bold text-[#1D3557] hover:bg-slate-50 transition"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Observações
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => updateForm({ notes: e.target.value })}
                className="inp min-h-[80px]"
                placeholder="Informações adicionais (opcional)"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-400">
                {overDraft ? "Revise a quantidade antes de confirmar." : " "}
              </div>
              <button
                onClick={submitAction}
                disabled={submitting || !canSubmit}
                className={`px-6 py-3 rounded-lg font-semibold text-sm text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  isExit ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {submitting ? "Processando..." : submitLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const tabs = isSecretaryView
    ? [{ id: "stock", label: "Estoque", icon: Boxes }]
    : [
        { id: "entry", label: "Entrada", icon: ArrowUpCircle },
        { id: "exit", label: "Saída", icon: ArrowDownCircle },
      ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="overline text-[#457B9D]">
          {isSecretaryView ? "Estoque · Visualização" : "Estoque · Gestão"}
        </div>
        <h1 className="font-display text-3xl font-extrabold text-[#1D3557]">
          {isSecretaryView
            ? "Visualização de estoque"
            : "Controle de entradas, saídas e saldo"}
        </h1>
        <p className="text-slate-500 mt-2">
          {isSecretaryView
            ? "Acompanhe o saldo atual e o histórico de movimentações por medicamento e unidade."
            : "Registre movimentações e acompanhe o estoque por medicamento e unidade em um único lugar."}
        </p>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-6">
        <aside className="sc-card p-4">
          <div className="mb-4">
            <div className="overline text-[#457B9D]">Estoque</div>
            <h2 className="font-display text-lg font-bold text-[#1D3557]">
              Controle de estoque
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Escolha a operação dentro do painel.
            </p>
          </div>

          {!isSecretaryView ? (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab("entry")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${activeTab === "entry" ? "bg-[#1D3557] text-white" : "bg-white text-[#1D3557] border border-slate-200"}`}
              >
                <ArrowUpCircle className="w-4 h-4" /> Entrada
              </button>
              <button
                onClick={() => setActiveTab("exit")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${activeTab === "exit" ? "bg-amber-600 text-white" : "bg-white text-[#1D3557] border border-slate-200"}`}
              >
                <ArrowDownCircle className="w-4 h-4" /> Saída
              </button>
              <button
                onClick={() => setActiveTab("stock")}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${activeTab === "stock" ? "bg-[#1D3557] text-white" : "bg-white text-[#1D3557] border border-slate-200"}`}
              >
                <Boxes className="w-4 h-4" /> Saldo / Histórico
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <button className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold bg-white text-[#1D3557] border border-slate-200">
                <Boxes className="w-4 h-4" /> Ver estoque
              </button>
            </div>
          )}
        </aside>

        <div>
          {activeTab === "entry" && (
            <div className="sc-card p-6">
              {renderForm(
                "entry",
                entryForm,
                updateEntryForm,
                "Registrar entrada",
                "Cadastre o recebimento de medicamentos e mantenha o histórico da movimentação.",
                "Registrar Entrada",
                submitEntry,
              )}
            </div>
          )}

          {activeTab === "exit" && (
            <div className="sc-card p-6">
              {renderForm(
                "exit",
                exitForm,
                updateExitForm,
                "Registrar saída",
                "Registre a entrega de medicamentos e atualize o estoque automaticamente.",
                "Confirmar Saída",
                submitExit,
              )}
            </div>
          )}

          {activeTab === "stock" && (
            <div className="space-y-6">
              <div className="sc-card p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="overline text-[#457B9D]">Saldo atual</div>
                    <h2 className="text-xl font-bold text-[#1D3557]">
                      Estoque por medicamento e unidade
                    </h2>
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={stockFilter.medicine}
                        onChange={(e) =>
                          setStockFilter((prev) => ({
                            ...prev,
                            medicine: e.target.value,
                          }))
                        }
                        placeholder="Filtrar por medicamento"
                        className="pl-10 inp min-w-[220px]"
                      />
                    </div>
                    <div className="relative">
                      <input
                        value={stockFilter.unit}
                        onChange={(e) => {
                          const value = e.target.value;
                          const matchingUnit = units.find(
                            (unit) =>
                              unit.name.toLowerCase() ===
                              value.trim().toLowerCase(),
                          );
                          setStockFilter((prev) => ({
                            ...prev,
                            unit: value,
                            unitId: matchingUnit?.id || "",
                          }));
                        }}
                        onBlur={() => {
                          const matchingUnit = units.find(
                            (unit) =>
                              unit.name.toLowerCase() ===
                              stockFilter.unit.trim().toLowerCase(),
                          );
                          if (!matchingUnit && stockFilter.unit.trim()) {
                            setStockFilter((prev) => ({ ...prev, unitId: "" }));
                          }
                        }}
                        list="stock-units-list"
                        placeholder="Selecionar ou pesquisar unidade"
                        className="inp min-w-[220px]"
                      />
                      <datalist id="stock-units-list">
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="mt-6 text-slate-500">
                    Carregando estoque...
                  </div>
                ) : (
                  <div className="mt-6 max-h-[420px] overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Medicamento</th>
                          <th className="px-4 py-3">Unidade</th>
                          <th className="px-4 py-3">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStock.map((item) => (
                          <tr
                            key={`${item.unitId}-${item.medicineId}`}
                            className="border-t border-slate-100"
                          >
                            <td className="px-4 py-3 font-semibold text-[#1D3557]">
                              {item.medicineName || item.medicineId}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {item.unitName}
                            </td>
                            <td
                              className={`px-4 py-3 font-semibold ${item.quantity <= 0 ? "text-amber-600" : "text-emerald-600"}`}
                            >
                              {item.quantity}
                            </td>
                          </tr>
                        ))}
                        {filteredStock.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-10 text-center text-slate-400"
                            >
                              Nenhum saldo encontrado para os filtros
                              selecionados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="sc-card p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="overline text-[#457B9D]">Histórico</div>
                    <h2 className="text-xl font-bold text-[#1D3557]">
                      Entradas e saídas
                    </h2>
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <button
                      type="button"
                      onClick={exportMovementsCsv}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#1D3557] transition hover:bg-slate-50"
                    >
                      <Download className="h-4 w-4" />
                      Exportar CSV
                    </button>
                    <select
                      value={historyFilterMode}
                      onChange={(e) => {
                        setHistoryFilterMode(e.target.value);
                        setHistoryFilterValue("");
                        setHistoryDateFrom("");
                        setHistoryDateTo("");
                      }}
                      className="inp h-10 min-w-[180px] bg-white"
                    >
                      <option value="all">Todos</option>
                      <option value="user">Por usuário</option>
                      <option value="unit">Por unidade</option>
                      <option value="medicine">Por medicamento</option>
                      <option value="type">Por tipo</option>
                      <option value="period">Por período</option>
                    </select>
                    {historyFilterMode === "type" ? (
                      <select
                        value={historyFilterValue}
                        onChange={(e) => setHistoryFilterValue(e.target.value)}
                        className="inp h-10 min-w-[140px] bg-white"
                      >
                        <option value="">Selecione</option>
                        <option value="entrada">Entrada</option>
                        <option value="saida">Saída</option>
                      </select>
                    ) : historyFilterMode === "period" ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          type="date"
                          value={historyDateFrom}
                          onChange={(e) =>
                            handleHistoryDateFromChange(e.target.value)
                          }
                          className="inp min-w-[140px]"
                        />
                        <input
                          type="date"
                          value={historyDateTo}
                          onChange={(e) =>
                            handleHistoryDateToChange(e.target.value)
                          }
                          className="inp min-w-[140px]"
                        />
                      </div>
                    ) : (
                      <input
                        value={historyFilterValue}
                        onChange={(e) => setHistoryFilterValue(e.target.value)}
                        placeholder={
                          historyFilterMode === "user"
                            ? "Nome do usuário"
                            : historyFilterMode === "unit"
                              ? "Nome da unidade"
                              : historyFilterMode === "medicine"
                                ? "Nome do medicamento"
                                : "Filtrar pelo texto"
                        }
                        className="inp min-w-[240px]"
                      />
                    )}
                  </div>
                </div>

                <div className="mt-6 max-h-[420px] overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Data/Hora</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Medicamento</th>
                        <th className="px-4 py-3">Unidade</th>
                        <th className="px-4 py-3">Usuário</th>
                        <th className="px-4 py-3">Quantidade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-slate-100 align-top"
                        >
                          <td className="px-4 py-3 font-mono-nums text-xs text-slate-500">
                            {formatDateTime(item.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded px-2 py-1 text-xs font-semibold ${item.type === "ENTRY" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                            >
                              {item.type === "ENTRY" ? "Entrada" : "Saída"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#1D3557]">
                              {item.medicineName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.medicineDetails?.dosage || ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.unit}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold">
                              {item.user?.name || "—"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.user?.role || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {item.quantity}
                          </td>
                        </tr>
                      ))}
                      {filteredMovements.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-10 text-center text-slate-400"
                          >
                            Nenhuma movimentação encontrada.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}